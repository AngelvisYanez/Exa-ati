#!/usr/bin/env node
/** Native Plesk deployment. See docs/DESPLIEGUE_PRODUCCION.md. */
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { createHash, randomUUID } from 'node:crypto';
import { fileURLToPath } from 'node:url';

const ROOT = '/opt/exa-ati';
export const AUTHORIZED_REPOS = Object.freeze([
  'https://github.com/AngelvisYanez/Exa-ati.git',
  'https://gitlab.com/exacontable1/exa-ati.git',
  'git@gitlab.com:exacontable1/exa-ati.git',
]);
const NODE = '/opt/plesk/node/26/bin/node';
const APP = 'https://ati.exacontable.com';
const SHA = /^[a-f0-9]{40}$/;
const hash = data => createHash('sha256').update(data).digest('hex');
const assert = (ok, message) => { if (!ok) throw new Error(message); };
const normalizeHost = host => host.toLowerCase().replace('-pooler.', '.');
const progress = message => console.log(`${new Date().toISOString()} ${message}`);

function updateHashFromFile(digest, filePath) {
  const fd = fs.openSync(filePath, 'r');
  try {
    const buf = Buffer.alloc(1024 * 1024);
    let bytes = 0;
    while ((bytes = fs.readSync(fd, buf, 0, buf.length, null)) > 0) digest.update(buf.subarray(0, bytes));
  } finally { fs.closeSync(fd); }
}

function updateHashFromTree(digest, root, subdir) {
  for (const item of fs.readdirSync(subdir, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name))) {
    const name = path.join(subdir, item.name);
    assert(!item.isSymbolicLink(), 'Artefacto con enlace inesperado.');
    if (item.isDirectory()) updateHashFromTree(digest, root, name);
    else {
      digest.update('\0');
      digest.update(path.relative(root, name).split(path.sep).join('/'));
      digest.update('\0');
      updateHashFromFile(digest, name);
    }
  }
}

/** Runtime artifact fingerprint: BUILD_ID + package-lock + .next/standalone + .next/static. */
export function artifactHash(dir) {
  const digest = createHash('sha256');
  const buildIdPath = path.join(dir, '.next', 'BUILD_ID');
  const buildId = fs.readFileSync(buildIdPath, 'utf8').trim();
  assert(buildId, 'Falta BUILD_ID válido.');
  digest.update('BUILD_ID\0');
  digest.update(buildId);
  const lockPath = path.join(dir, 'package-lock.json');
  assert(fs.existsSync(lockPath), 'Falta package-lock.json.');
  digest.update('\0package-lock.json\0');
  updateHashFromFile(digest, lockPath);
  for (const rel of ['.next/standalone', '.next/static']) {
    const abs = path.join(dir, rel);
    assert(fs.existsSync(abs), `Falta ${rel}.`);
    digest.update(`\0${rel}\0`);
    updateHashFromTree(digest, dir, abs);
  }
  return digest.digest('hex');
}

export function isAuthorizedRepo(url) {
  return AUTHORIZED_REPOS.includes(String(url || '').trim());
}

export function parseEnv(raw) {
  const values = Object.create(null);
  for (const line of raw.replace(/^\uFEFF/, '').split(/\r?\n/)) {
    if (!line.trim() || line.trimStart().startsWith('#')) continue;
    const match = /^([A-Za-z_][A-Za-z_0-9]*)=(.*)$/.exec(line);
    assert(match && !(match[1] in values), 'Entorno inválido: sintaxis o variable duplicada.');
    let value = match[2];
    if (value.startsWith('"') || value.startsWith("'")) {
      assert(value.at(-1) === value[0], 'Entorno inválido: comillas sin cerrar.');
      value = value.slice(1, -1);
    } else assert(value === value.trim() && !/\s/.test(value), 'Usa comillas para valores con espacios.');
    // No expansion: the same literal values are passed to npm and systemd.
    assert(!/[\r\n\0]/.test(value), 'Entorno inválido: valor multilínea.');
    assert(!/["'\\]/.test(value), 'Usa valores literales sin escapes ni comillas internas.');
    values[match[1]] = value;
  }
  return values;
}

function dbHost(value) {
  try {
    const url = new URL(value);
    assert(['postgres:', 'postgresql:'].includes(url.protocol) && url.username && url.password && url.pathname.length > 1, 'db');
    return normalizeHost(url.hostname);
  } catch { throw new Error('URL PostgreSQL ausente o inválida (valor oculto).'); }
}

export function validateEnv(values, mode, testValues) {
  assert(['test', 'production'].includes(mode), 'Indica --mode test|production explícitamente.');
  assert(values.EXA_ATI_ENV === mode && values.NODE_ENV === 'production', 'EXA_ATI_ENV o NODE_ENV incorrecto.');
  assert(SHA.test(values.EXA_ATI_RELEASE_SHA || ''), 'EXA_ATI_RELEASE_SHA debe ser un SHA completo.');
  assert(values.NEXT_PUBLIC_APP_URL === APP, 'NEXT_PUBLIC_APP_URL incorrecta.');
  assert(values.EXA_ATI_DB_ISOLATED === 'true', 'Falta EXA_ATI_DB_ISOLATED=true.');
  const host = dbHost(values.DATABASE_URL);
  assert(host === dbHost(values.DIRECT_DATABASE_URL), 'Las URLs de base no usan el mismo endpoint.');
  assert(values.EXA_ATI_SOURCE_DB_HOST && host !== normalizeHost(values.EXA_ATI_SOURCE_DB_HOST), 'No se demuestra aislamiento del origen cPanel.');
  for (const name of ['JWT_SECRET', 'ENCRYPTION_KEY', 'ENCRYPTION_SALT', 'CRON_SECRET']) {
    assert(values[name] && !/REEMPLAZAR|CHANGE_ME|USUARIO|CLAVE/.test(values[name]), `Configura ${name}.`);
  }
  const sriHost = mode === 'production' ? 'cel.sri.gob.ec' : 'celcer.sri.gob.ec';
  for (const [name, endpoint] of [['SRI_RECEPTION_WSDL', 'RecepcionComprobantesOffline'], ['SRI_AUTHORIZATION_WSDL', 'AutorizacionComprobantesOffline']]) {
    assert(values[name] === `https://${sriHost}/comprobantes-electronicos-ws/${endpoint}?wsdl`, `${name} no corresponde al endpoint autorizado.`);
  }
  assert(!values.SRI_PROXY_HOST, 'SRI_PROXY_HOST requiere revisión específica; activación bloqueada.');
  assert(values.SRI_ENVIRONMENT === (mode === 'production' ? 'production' : 'development'), 'SRI_ENVIRONMENT incorrecto.');
  if (mode === 'production') {
    assert(values.EXA_ATI_PRODUCTION_READY === 'true', 'Falta la compuerta EXA_ATI_PRODUCTION_READY.');
    assert(testValues, 'Se requiere test.env para comparar aislamiento.');
    assert(host !== dbHost(testValues.DATABASE_URL) && host !== dbHost(testValues.DIRECT_DATABASE_URL), 'Producción apunta a la base de pruebas.');
  } else assert(values.EXA_ATI_PRODUCTION_READY !== 'true', 'Pruebas no debe marcar producción lista.');
  for (const name of ['XMLS_DIR', 'CERTS_DIR', 'PDFS_DIR', 'TEMPLATES_DIR']) {
    const value = values[name];
    assert(value && path.posix.normalize(value) === value && value.startsWith(`${ROOT}/shared/downloads/`), `${name} debe estar bajo shared/downloads.`);
  }
}

export function healthy(body) {
  try { const data = JSON.parse(body); return data.status === 'healthy' && data.checks?.database === 'ok'; }
  catch { return false; }
}

export function healthyHttp(response) {
  const boundary = response.lastIndexOf('\n');
  return boundary >= 0 && response.slice(boundary + 1).trim() === '200' && healthy(response.slice(0, boundary));
}

export function atomicLink(target, link) {
  if (fs.existsSync(link)) assert(fs.lstatSync(link).isSymbolicLink(), 'Se rechazó reemplazar un archivo o directorio por un enlace.');
  const temp = `${link}.${randomUUID()}.tmp`;
  try { fs.symlinkSync(target, temp); fs.renameSync(temp, link); }
  finally { fs.rmSync(temp, { force: true }); }
}

export function withLock(root, action) {
  const lock = path.join(root, '.deploy.lock');
  try { fs.mkdirSync(lock); } catch { throw new Error('Despliegue bloqueado: bloqueo existente o directorio inaccesible. No retirarlo automáticamente.'); }
  try {
    fs.writeFileSync(path.join(lock, 'owner.json'), JSON.stringify({ pid: process.pid, started: new Date().toISOString() }), { mode: 0o600 });
    return action();
  } finally { fs.rmSync(lock, { recursive: true }); }
}

// A failed recovery must never be reported as a successful deployment.
export function activationTransaction({ activate, verify, restore, verifyRestored, evidence }) {
  try {
    activate();
    verify();
    evidence.result = 'TECHNICAL_CHECKS_OK';
  } catch {
    evidence.result = 'FAILED';
    try {
      restore();
      verifyRestored();
      evidence.rollback = 'VERIFIED';
    } catch { evidence.rollback = 'FAILED_REQUIRES_OPERATOR'; }
    throw new Error(`Activación fallida; recuperación: ${evidence.rollback}. Consultar el registro protegido.`);
  }
}

export function createDeployer({ root = ROOT, execute, sleep = () => execFileSync('sleep', ['2']) } = {}) {
  const run = execute || ((command, args, options = {}) => {
    try { return (execFileSync(command, args, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], timeout: 30000, maxBuffer: 1024 * 1024, ...options }) || '').trim(); }
    catch { throw new Error(`Falló ${path.basename(command)}; salida omitida para proteger secretos.`); }
  });
  const file = (...parts) => path.join(root, ...parts);
  const read = name => fs.readFileSync(name, 'utf8');
  const json = name => JSON.parse(read(name));
  const envFile = mode => file('env', `${mode}.env`);
  function environment(mode) {
    const name = envFile(mode);
    assert(['production', 'test'].includes(mode), 'Indica --mode test|production.');
    if (process.platform !== 'win32') assert((fs.statSync(name).mode & 0o077) === 0, 'El entorno requiere permisos 600.');
    const values = parseEnv(read(name));
    validateEnv(values, mode, mode === 'production' ? parseEnv(read(envFile('test'))) : undefined);
    return values;
  }
  function release(sha) {
    assert(SHA.test(sha || ''), 'Indica --sha con 40 caracteres hexadecimales.');
    const dir = file('releases', sha);
    assert(fs.realpathSync(dir) === dir, 'La release debe ser un directorio real dentro de releases.');
    const origin = run('git', ['-C', dir, 'remote', 'get-url', 'origin']);
    assert(isAuthorizedRepo(origin), 'Origen Git no autorizado.');
    assert(run('git', ['-C', dir, 'rev-parse', 'HEAD']) === sha, 'HEAD no coincide con SHA.');
    assert(run('git', ['-C', dir, 'status', '--porcelain=v1', '--untracked-files=all']) === '', 'La release contiene cambios o archivos sin seguimiento.');
    assert(run('git', ['ls-remote', origin, 'refs/heads/main']).split(/\s+/)[0] === sha, 'SHA distinto del main remoto o remoto inaccesible.');
    // Prevent Next.js loading additional environment values from the release.
    for (const name of ['.env', '.env.local', '.env.production', '.env.production.local']) assert(!fs.existsSync(path.join(dir, name)), 'La release contiene un entorno local no autorizado.');
    return dir;
  }
  const configHash = values => hash(JSON.stringify(Object.entries(values).sort(([a], [b]) => a.localeCompare(b))));
  function findNodeModulesDonor(dir) {
    const lockPath = path.join(dir, 'package-lock.json');
    if (!fs.existsSync(lockPath)) return null;
    const lockDigest = hash(fs.readFileSync(lockPath));
    const candidates = [];
    const current = file('current');
    if (fs.existsSync(current) && fs.lstatSync(current).isSymbolicLink()) {
      try { candidates.push(fs.realpathSync(current)); } catch { /* ignore broken current */ }
    }
    for (const candidate of candidates) {
      if (candidate === dir) continue;
      const donorLock = path.join(candidate, 'package-lock.json');
      const donorMods = path.join(candidate, 'node_modules');
      if (!fs.existsSync(donorLock) || !fs.existsSync(donorMods)) continue;
      if (hash(fs.readFileSync(donorLock)) === lockDigest) return candidate;
    }
    return null;
  }
  function validate(args) {
    const values = environment(args.mode);
    const dir = release(args.sha);
    assert(values.EXA_ATI_RELEASE_SHA === args.sha, 'El entorno no coincide con la release.');
    assert(fs.existsSync(NODE) && fs.existsSync('/usr/bin/google-chrome'), 'Falta Node o Chrome del host.');
    for (const name of ['XMLS_DIR', 'CERTS_DIR', 'PDFS_DIR', 'TEMPLATES_DIR']) {
      const resolved = fs.realpathSync(values[name]);
      assert(resolved.startsWith(`${ROOT}/shared/downloads/`), `${name} resuelve fuera de los datos compartidos.`);
      run('/usr/sbin/runuser', ['-u', 'exaati', '--', '/usr/bin/test', '-r', resolved]);
      run('/usr/sbin/runuser', ['-u', 'exaati', '--', '/usr/bin/test', '-w', resolved]);
    }
    return { values, dir };
  }
  const manifestPath = sha => file('shared', 'logs', `build-${sha}.json`);
  function build(args) {
    return withLock(root, () => {
      const { values, dir } = validate(args);
      assert(!fs.existsSync(file('current')) || fs.realpathSync(file('current')) !== dir, 'No compilar la release activa.');
      assert(!fs.existsSync(path.join(dir, '.next')), 'La release ya tiene artefactos; no se reconstruye ni reutiliza un build incompleto.');
      assert(!fs.existsSync(manifestPath(args.sha)), 'Ya existe evidencia de un build para este SHA.');
      run('/usr/sbin/runuser', ['-u', 'exaati', '--', '/usr/bin/test', '-w', dir]);
      const available = Number(run(NODE, ['-e', 'console.log(require("node:os").freemem())']));
      assert(available >= 3 * 1024 ** 3, 'Menos de 3 GiB disponibles: build bloqueado.');
      const nodeVersion = run(NODE, ['--version']);
      const npm = '/opt/plesk/node/26/bin/npm';
      const npmCache = file('shared', 'npm-cache');
      fs.mkdirSync(npmCache, { recursive: true });
      try { run('chown', ['-R', 'exaati:psacln', npmCache]); } catch { /* best-effort on non-Plesk fixtures */ }
      const buildEnv = {
        PATH: '/opt/plesk/node/26/bin:/usr/bin:/bin',
        HOME: file('shared', 'tmp'),
        XDG_CACHE_HOME: file('shared', 'tmp', '.cache'),
        npm_config_cache: npmCache,
        ...values,
        NEXT_TELEMETRY_DISABLED: '1',
        PUPPETEER_SKIP_DOWNLOAD: '1',
        PUPPETEER_EXECUTABLE_PATH: '/usr/bin/google-chrome',
      };
      fs.mkdirSync(file('shared', 'logs'), { recursive: true });
      fs.mkdirSync(file('shared', 'tmp'), { recursive: true });
      const log = fs.openSync(file('shared', 'logs', `build-${args.sha}.log`), 'wx', 0o600);
      try {
        const options = { cwd: dir, env: buildEnv, stdio: ['ignore', log, log], timeout: 20 * 60 * 1000 };
        let depsMode = 'npm-ci';
        const donor = findNodeModulesDonor(dir);
        if (donor) {
          progress(`build deps=reuse from ${path.basename(donor)}`);
          try {
            run('/usr/sbin/runuser', ['-u', 'exaati', '--', 'cp', '-a', path.join(donor, 'node_modules'), dir], options);
            // Refresh generated Prisma client when schema changed without lockfile churn.
            run('/usr/sbin/runuser', ['-u', 'exaati', '--', npm, 'run', 'postinstall'], options);
            depsMode = 'reuse';
            fs.writeSync(log, `\ndeps=reuse donor=${path.basename(donor)}\n`);
          } catch {
            fs.rmSync(path.join(dir, 'node_modules'), { recursive: true, force: true });
            progress('build deps=reuse-failed falling back to npm-ci');
            depsMode = 'npm-ci';
          }
        }
        if (depsMode === 'npm-ci') {
          progress('build deps=npm-ci');
          fs.writeSync(log, '\ndeps=npm-ci\n');
          // production.env sets NODE_ENV=production; still need build-time devDependencies (e.g. @tailwindcss/postcss).
          run('/usr/sbin/runuser', ['-u', 'exaati', '--', npm, 'ci', '--include=dev', '--prefer-offline'], options);
        }
        progress('build next-build start');
        run('/usr/sbin/runuser', ['-u', 'exaati', '--', npm, 'run', 'build'], options);
        progress('build next-build done');
        const standalone = path.join(dir, '.next', 'standalone');
        assert(fs.existsSync(path.join(standalone, 'server.js')), 'Falta server.js standalone tras el build.');
        run('/usr/sbin/runuser', ['-u', 'exaati', '--', 'cp', '-a', path.join(dir, '.next', 'static'), path.join(standalone, '.next', 'static')], options);
        run('/usr/sbin/runuser', ['-u', 'exaati', '--', 'cp', '-a', path.join(dir, 'public'), path.join(standalone, 'public')], options);
        release(args.sha);
        progress('build artifact-hash start');
        const artifactDigest = artifactHash(dir);
        progress('build artifact-hash done');
        const manifest = { sha: args.sha, mode: args.mode, configHash: configHash(values), artifactHash: artifactDigest, nodeVersion, depsMode, completed: new Date().toISOString() };
        fs.writeFileSync(manifestPath(args.sha), JSON.stringify(manifest), { flag: 'wx', mode: 0o600 });
        return manifest;
      } finally { fs.closeSync(log); }
    });
  }
  function runtime(dir, values) {
    assert(run('systemctl', ['is-active', 'exa-ati']) === 'active', 'Servicio inactivo.');
    const pid = run('systemctl', ['show', 'exa-ati', '--property=MainPID', '--value']);
    assert(/^[1-9]\d*$/.test(pid), 'PID del servicio inválido.');
    const cwd = fs.realpathSync(`/proc/${pid}/cwd`);
    const standalone = path.join(dir, '.next', 'standalone');
    assert(cwd === dir || cwd === standalone, 'El proceso ejecuta otra release.');
    assert(fs.realpathSync(`/proc/${pid}/exe`) === fs.realpathSync(NODE), 'El proceso no utiliza el Node autorizado.');
    // Next.js may rewrite process.title/cmdline; verify exe, cwd, env and socket instead.
    const actual = Object.fromEntries(read(`/proc/${pid}/environ`).split('\0').filter(Boolean).map(entry => { const at = entry.indexOf('='); return [entry.slice(0, at), entry.slice(at + 1)]; }));
    assert(Object.entries(values).every(([name, value]) => actual[name] === value), 'El entorno efectivo del proceso difiere del validado.');
    const listeners = run('ss', ['-ltnp', 'sport = :3101']);
    assert(listeners.includes('127.0.0.1:3101') && listeners.includes(`pid=${pid},`) && !listeners.includes('0.0.0.0:3101') && !listeners.includes('[::]:3101'), 'Puerto no pertenece al servicio o expuesto públicamente.');
  }
  function wait(dir, values) {
    for (let attempt = 0; attempt < 15; attempt++) {
      try {
        runtime(dir, values);
        const response = run('curl', ['--fail', '--silent', '--max-time', '15', '--write-out', '\n%{http_code}', 'http://127.0.0.1:3101/api/health']);
        if (healthyHttp(response)) return;
      } catch { /* retry without disclosing process data */ }
      sleep();
    }
    throw new Error('Servicio, identidad o health no alcanzaron el estado esperado.');
  }
  function activate(args) {
    return withLock(root, () => {
      const { values, dir } = validate(args);
      const manifest = json(manifestPath(args.sha));
      assert(manifest.sha === args.sha && manifest.mode === args.mode && manifest.configHash === configHash(values) && manifest.artifactHash === artifactHash(dir) && manifest.nodeVersion === run(NODE, ['--version']), 'Build ausente, alterado o construido con otra configuración/Node.');
      assert(run('systemctl', ['is-enabled', 'exa-ati']) === 'enabled', 'Servicio nativo no preparado; requiere aprovisionamiento/migración independiente.');
      for (const [property, expected] of [['User', 'exaati'], ['Restart', 'always'], ['MemoryMax', '1073741824'], ['MemorySwapMax', '0']]) {
        assert(run('systemctl', ['show', 'exa-ati', `--property=${property}`, '--value']) === expected, `Unidad systemd: ${property} no cumple el contrato.`);
      }
      const current = file('current');
      const active = file('env', 'active.env');
      assert(fs.lstatSync(current).isSymbolicLink() && fs.lstatSync(active).isSymbolicLink(), 'No hay estado nativo anterior recuperable.');
      const previousDir = fs.realpathSync(current);
      const previousEnv = fs.realpathSync(active);
      assert(previousDir.startsWith(file('releases') + path.sep) && previousEnv.startsWith(file('env') + path.sep), 'Estado anterior fuera del directorio permitido.');
      assert(previousDir !== dir, 'Esta release ya está activa.');
      const previousValues = parseEnv(read(previousEnv));
      runtime(previousDir, previousValues);
      // Explicit, expiring operator evidence; never infer backup/schema safety.
      assert(args.approval, 'Indica --approval con evidencia de respaldo, compuerta y compatibilidad.');
      const approval = json(args.approval);
      assert(approval.sha === args.sha && approval.mode === args.mode && approval.previousSha === path.basename(previousDir) && approval.backupVerified === true && approval.rollbackCompatible === true && approval.backupReference && approval.productionGateVerified === true && Date.parse(approval.expiresAt) > Date.now() && Date.parse(approval.expiresAt) < Date.now() + 24 * 3600000, 'Evidencia de autorización incompleta, incompatible o vencida.');
      const previousCopy = file('env', `rollback-${randomUUID()}.env`);
      fs.copyFileSync(previousEnv, previousCopy, fs.constants.COPYFILE_EXCL);
      fs.chmodSync(previousCopy, 0o600);
      const snapshot = file('env', `${args.mode}-${args.sha}-${randomUUID()}.env`);
      // Canonical literal file: no inherited env or dotenv interpolation.
      fs.writeFileSync(snapshot, Object.entries(values).map(([key, value]) => `${key}='${value}'`).join('\n') + '\n', { flag: 'wx', mode: 0o600 });
      const owner = fs.statSync(previousEnv);
      fs.chownSync(previousCopy, owner.uid, owner.gid);
      fs.chownSync(snapshot, owner.uid, owner.gid);
      // The service must be pre-provisioned for this exact environment file and cwd.
      assert(run('systemctl', ['show', 'exa-ati', '--property=WorkingDirectory', '--value']) === file('current'), 'WorkingDirectory del servicio incorrecto.');
      const envFiles = run('systemctl', ['show', 'exa-ati', '--property=EnvironmentFiles', '--value']);
      assert(envFiles.trim() === `${active} (ignore_errors=no)`, 'EnvironmentFile del servicio incorrecto o ambiguo.');
      release(args.sha); // main may have advanced during preparation.
      const journal = file('shared', 'logs', `deploy-${randomUUID()}.json`);
      const evidence = { sha: args.sha, mode: args.mode, previousSha: path.basename(previousDir), previousEnv: previousCopy, snapshot, started: new Date().toISOString(), result: 'ACTIVATING' };
      fs.writeFileSync(journal, JSON.stringify(evidence), { flag: 'wx', mode: 0o600 });
      try {
        activationTransaction({
          evidence,
          activate() {
            atomicLink(snapshot, active);
            atomicLink(dir, current);
            run('systemctl', ['restart', 'exa-ati']);
          },
          verify() {
            wait(dir, values);
            run(NODE, [path.join(dir, 'scripts', 'deploy', 'preflight.mjs'), '--sha', args.sha], {
              cwd: dir,
              env: {
                PATH: '/opt/plesk/node/26/bin:/usr/bin:/bin',
                GIT_SSH_COMMAND: 'ssh -i /opt/exa-ati/private/gitlab-ci/id_ed25519_clone -o IdentitiesOnly=yes -o StrictHostKeyChecking=accept-new -o BatchMode=yes',
                GIT_CONFIG_COUNT: '1',
                GIT_CONFIG_KEY_0: 'safe.directory',
                GIT_CONFIG_VALUE_0: dir,
              },
              timeout: 90000,
            });
            runtime(dir, values);
          },
          restore() {
            atomicLink(previousCopy, active);
            atomicLink(previousDir, current);
            run('systemctl', ['restart', 'exa-ati']);
          },
          verifyRestored() { wait(previousDir, previousValues); },
        });
        return { result: evidence.result, journal, pending: 'Sesión legítima, integraciones y evidencia externa completa según el procedimiento.' };
      } finally {
        evidence.finished = new Date().toISOString();
        fs.writeFileSync(journal, JSON.stringify(evidence), { mode: 0o600 });
      }
    });
  }
  function status(args) {
    const { values, dir } = validate(args);
    assert(fs.realpathSync(file('current')) === dir, 'current no coincide con SHA esperado.');
    const actual = parseEnv(read(fs.realpathSync(file('env', 'active.env'))));
    assert(configHash(actual) === configHash(values), 'El enlace de entorno activo no coincide con el preparado.');
    runtime(dir, values);
    assert(healthyHttp(run('curl', ['--fail', '--silent', '--max-time', '15', '--write-out', '\n%{http_code}', 'http://127.0.0.1:3101/api/health'])), 'Health o base no saludables.');
    return { sha: args.sha, mode: args.mode, result: 'LOCAL_CHECKS_OK', pending: 'Verificación externa y funcional obligatoria.' };
  }
  return { validate, build, activate, status, validateRelease: release };
}

export function main(argv = process.argv.slice(2)) {
  const [command, ...rest] = argv;
  assert(['validate', 'build', 'activate', 'status'].includes(command), 'Uso: deploy.mjs validate|build|activate|status --mode production|test --sha <sha> [--approval <json>]');
  const args = {};
  for (let i = 0; i < rest.length; i += 2) {
    assert(['--mode', '--sha', '--approval'].includes(rest[i]) && typeof rest[i + 1] === 'string' && !rest[i + 1].startsWith('--') && !(rest[i].slice(2) in args), 'Argumento desconocido, duplicado o incompleto.');
    args[rest[i].slice(2)] = rest[i + 1];
  }
  assert(['production', 'test'].includes(args.mode) && SHA.test(args.sha || ''), 'Se requieren --mode y --sha explícitos.');
  assert(process.platform === 'linux', 'Este comando de servidor solo se ejecuta en Linux/Plesk.');
  const result = createDeployer()[command](args);
  console.log(JSON.stringify(command === 'validate' ? { result: 'VALIDATED', sha: args.sha, mode: args.mode } : result));
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try { main(); } catch (error) {
    // File/JSON errors may embed environment text: never print those messages.
    console.error(error.constructor === Error ? error.message : 'Error de archivo, configuración o proceso; detalles ocultos para proteger secretos.');
    process.exitCode = 1;
  }
}
