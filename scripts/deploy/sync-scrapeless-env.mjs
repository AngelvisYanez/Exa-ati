/**
 * Copia SCRAPELESS_API_KEY al .env de producción vía SSH (sin imprimir el valor).
 * Uso: node scripts/deploy/sync-scrapeless-env.mjs
 */
import { execSync } from 'child_process';
import { existsSync, readFileSync, writeFileSync, unlinkSync } from 'fs';
import { join } from 'path';
import { homedir, tmpdir } from 'os';

const CPANEL_HOST = '66.29.132.199';
const CPANEL_USER = 'exackbqq';
const CPANEL_PORT = '21098';
const SSH_KEY = join(homedir(), '.ssh', 'cpanel_deploy');
const APP_DIR = `/home/${CPANEL_USER}/ati`;
const SSH = `ssh -o StrictHostKeyChecking=no -i "${SSH_KEY}" -p ${CPANEL_PORT} ${CPANEL_USER}@${CPANEL_HOST}`;
const SCP = `scp -o StrictHostKeyChecking=no -i "${SSH_KEY}" -P ${CPANEL_PORT}`;

function readLocalKey() {
  const envPath = join(process.cwd(), '.env');
  if (!existsSync(envPath)) throw new Error('.env local no encontrado');
  const lines = readFileSync(envPath, 'utf8').split(/\r?\n/);
  for (const line of lines) {
    const m = line.match(/^\s*#?\s*SCRAPELESS_API_KEY\s*=\s*(.+)\s*$/);
    if (m) {
      const val = m[1].trim().replace(/^["']|["']$/g, '');
      if (val) return val;
    }
  }
  return null;
}

function main() {
  if (!existsSync(SSH_KEY)) throw new Error(`SSH key missing: ${SSH_KEY}`);
  const key = readLocalKey();
  if (!key) {
    console.error('No se encontró SCRAPELESS_API_KEY en .env local (ni comentada)');
    process.exit(1);
  }
  console.log(`SCRAPELESS_API_KEY local: presente (${key.length} chars)`);

  const localSnippet = join(tmpdir(), `scrapeless-env-${Date.now()}.env`);
  writeFileSync(
    localSnippet,
    [
      `SCRAPELESS_API_KEY=${key}`,
      'SCRAPELESS_PROXY_COUNTRY=EC',
      'SCRAPING_USE_PROXY=false',
      '',
    ].join('\n'),
    { mode: 0o600 },
  );

  try {
    execSync(`${SCP} "${localSnippet}" ${CPANEL_USER}@${CPANEL_HOST}:/tmp/scrapeless.env`, {
      stdio: 'inherit',
      timeout: 60000,
    });
    const remote = [
      `cd ${APP_DIR}`,
      // Quitar claves previas y append nuevas
      `grep -vE '^(SCRAPELESS_API_KEY|SCRAPELESS_PROXY_COUNTRY|SCRAPING_USE_PROXY)=' .env > .env.tmp || true`,
      `cat /tmp/scrapeless.env >> .env.tmp`,
      `mv .env.tmp .env`,
      `rm -f /tmp/scrapeless.env`,
      `grep -E '^(SCRAPELESS_API_KEY|SCRAPELESS_PROXY_COUNTRY|SCRAPING_USE_PROXY)=' .env | sed 's/=.*/=***/'`,
      `touch tmp/restart.txt`,
      `echo SYNC_OK`,
    ].join(' && ');
    const out = execSync(`${SSH} "${remote}"`, { encoding: 'utf8', timeout: 60000 });
    console.log(out.trim());
  } finally {
    try {
      unlinkSync(localSnippet);
    } catch {}
  }
}

main();
