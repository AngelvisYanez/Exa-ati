#!/usr/bin/env node
/**
 * Preflight de solo lectura para el despliegue de EXA-ATI.
 *
 * No toca el servidor, no modifica el repositorio y no lee secretos.
 * Comprueba el SHA publicado, la salud del sitio, las rutas públicas y los
 * chunks de la página de login.
 *
 * Uso:
 *   node scripts/deploy/preflight.mjs
 *   node scripts/deploy/preflight.mjs --sha <sha-esperado>
 *   node scripts/deploy/preflight.mjs --json
 *   EXA_ATI_BASE_URL=https://ati.exacontable.com node scripts/deploy/preflight.mjs
 *
 * Código de salida: 0 si todo lo obligatorio pasa, 1 si algo falla.
 */

import { execFileSync } from 'node:child_process';

const BASE = (process.env.EXA_ATI_BASE_URL || 'https://ati.exacontable.com').replace(/\/+$/, '');
const argv = process.argv.slice(2);
const asJson = argv.includes('--json');
const shaFlag = argv.indexOf('--sha');
const expectedSha = shaFlag >= 0 ? (argv[shaFlag + 1] || '').trim() : null;

const checks = [];

function record(id, name, ok, detail, required = true) {
  checks.push({ id, name, ok, detail, required });
}

function git(...args) {
  return execFileSync('git', args, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim();
}

function safeGit(...args) {
  try {
    return git(...args);
  } catch {
    return null;
  }
}

async function request(url, method = 'GET') {
  const res = await fetch(url, { method, redirect: 'manual' });
  return res;
}

async function checkPage(id, path) {
  const url = `${BASE}${path}`;
  try {
    const res = await request(url);
    record(id, `GET ${path}`, res.status === 200, `HTTP ${res.status}`);
    return res;
  } catch (error) {
    record(id, `GET ${path}`, false, `error de red: ${error.message}`);
    return null;
  }
}

async function checkAsset(id, path) {
  const url = `${BASE}${path}`;
  try {
    let res = await request(url, 'HEAD');
    if (res.status === 405 || res.status === 501) res = await request(url, 'GET');
    const type = (res.headers.get('content-type') || '').toLowerCase();
    const ok = res.status === 200 && type.includes('javascript');
    record(id, `asset ${path}`, ok, `HTTP ${res.status} · ${type || 'sin content-type'}`);
    return ok;
  } catch (error) {
    record(id, `asset ${path}`, false, `error de red: ${error.message}`);
    return false;
  }
}

async function main() {
  // --- Repositorio ---------------------------------------------------------
  const remoteLine = safeGit('ls-remote', 'origin', 'refs/heads/main');
  const remoteSha = remoteLine ? remoteLine.split(/\s+/)[0] : null;
  record('G-1', 'SHA en origin/main', Boolean(remoteSha), remoteSha || 'no se pudo consultar origin');

  const headSha = safeGit('rev-parse', 'HEAD');
  record('G-2', 'SHA local (HEAD)', Boolean(headSha), headSha || 'no disponible');

  const dirty = safeGit('status', '--porcelain=v1');
  const clean = dirty !== null && dirty === '';
  record('G-3', 'árbol de trabajo limpio', clean, clean ? 'sin cambios' : 'hay cambios sin confirmar', false);

  const aligned = Boolean(headSha && remoteSha && headSha === remoteSha);
  record('G-4', 'HEAD == origin/main', aligned, aligned ? 'alineados' : 'HEAD y origin/main difieren', false);

  if (expectedSha) {
    record('G-5', 'SHA esperado == origin/main', remoteSha === expectedSha,
      remoteSha === expectedSha ? expectedSha : `esperado ${expectedSha}, remoto ${remoteSha}`);
  }

  // --- Salud ---------------------------------------------------------------
  try {
    const res = await request(`${BASE}/api/health`);
    const body = await res.text();
    let parsed = null;
    try { parsed = JSON.parse(body); } catch { /* respuesta no JSON */ }
    const dbOk = parsed?.checks?.database === 'ok';
    const ok = res.status === 200 && parsed?.status === 'healthy' && dbOk;
    record('H-1', 'GET /api/health', ok,
      `HTTP ${res.status} · status=${parsed?.status ?? '?'} · database=${parsed?.checks?.database ?? '?'}`);
  } catch (error) {
    record('H-1', 'GET /api/health', false, `error de red: ${error.message}`);
  }

  // --- Rutas públicas ------------------------------------------------------
  await checkPage('P-1', '/');
  await checkPage('P-2', '/precios');
  await checkPage('P-3', '/registro');
  const login = await checkPage('P-4', '/iniciar-sesion');

  // --- Chunks --------------------------------------------------------------
  if (login) {
    const html = await login.text();
    const found = [...html.matchAll(/\/_next\/static\/chunks\/[^"'<>\\ ]+?\.js/g)]
      .map((m) => m[0])
      .filter((p) => !p.includes('\\'));
    const unique = [...new Set(found)];

    record('C-1', 'chunks referenciados en el login', unique.length > 0,
      `${unique.length} chunk(s)`);

    let failures = 0;
    for (const chunk of unique) {
      const ok = await checkAsset('C-2', chunk);
      if (!ok) failures += 1;
    }
    record('C-3', 'todos los chunks del login', failures === 0 && unique.length > 0,
      failures === 0 ? 'todos 200 + javascript' : `${failures} chunk(s) con problemas`);

    const loginChunk = unique.find((p) => /app\/\(auth\)\/iniciar-sesion\/page-.*\.js$/.test(p));
    record('C-4', 'chunk de la página de login', Boolean(loginChunk),
      loginChunk || 'no se encontró app/(auth)/iniciar-sesion/page-*.js');
  } else {
    record('C-1', 'chunks referenciados en el login', false, 'no se pudo leer la página');
    record('C-3', 'todos los chunks del login', false, 'no se pudo leer la página');
    record('C-4', 'chunk de la página de login', false, 'no se pudo leer la página');
  }

  // --- Resultado -----------------------------------------------------------
  const required = checks.filter((c) => c.required);
  const failed = required.filter((c) => !c.ok);
  const warnings = checks.filter((c) => !c.required && !c.ok);

  if (asJson) {
    console.log(JSON.stringify({
      base: BASE,
      expectedSha,
      remoteSha,
      headSha,
      ok: failed.length === 0,
      checks,
    }, null, 2));
  } else {
    const width = Math.max(...checks.map((c) => c.name.length));
    console.log(`\nEXA-ATI preflight · ${BASE}`);
    console.log(`SHA remoto: ${remoteSha || '?'}   SHA local: ${headSha || '?'}`);
    if (expectedSha) console.log(`SHA esperado: ${expectedSha}`);
    console.log('');
    for (const c of checks) {
      const mark = c.ok ? 'OK  ' : c.required ? 'FAIL' : 'WARN';
      console.log(`  ${mark}  ${c.name.padEnd(width)}  ${c.detail}`);
    }
    console.log('');
    if (failed.length === 0) {
      console.log('Resultado: verificaciones obligatorias OK.');
      if (warnings.length) console.log(`Avisos: ${warnings.length} (no bloquean).`);
    } else {
      console.log(`Resultado: ${failed.length} verificación(es) obligatoria(s) fallaron:`);
      for (const c of failed) console.log(`  - ${c.name}: ${c.detail}`);
    }
    console.log('');
    console.log('Recuerda: este script NO distingue pruebas de producción.');
    console.log('Para eso usa las señales de docs/DESPLIEGUE_PRODUCCION.md, sección 4.');
    console.log('');
  }

  process.exit(failed.length === 0 ? 0 : 1);
}

main().catch((error) => {
  console.error(`preflight: error inesperado: ${error.message}`);
  process.exit(1);
});
