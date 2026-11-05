#!/usr/bin/env node
/**
 * deploy-cpanel.mjs — Deploy automatizado a cPanel via SSH/SCP
 * 
 * Uso:
 *   node scripts/deploy/deploy-cpanel.mjs
 * 
 * Requiere:
 *   - SSH key en ~/.ssh/cpanel_deploy
 *   - Build previo: npm run build
 */

import { execSync, spawn } from 'child_process';
import { existsSync, mkdirSync, writeFileSync, readFileSync } from 'fs';
import { join } from 'path';
import { homedir } from 'os';

// ─── Configuración ──────────────────────────────────────────────
const CPANEL_HOST = '66.29.132.199';
const CPANEL_USER = 'exackbqq';
const CPANEL_PORT = '21098';
const SSH_KEY = join(homedir(), '.ssh', 'cpanel_deploy');
const APP_DIR = `/home/${CPANEL_USER}/ati`;
const DEPLOY_TGZ = 'deploy-ati.tgz';

const SSH_OPTS = `-o StrictHostKeyChecking=no -o ConnectTimeout=15 -i "${SSH_KEY}" -p ${CPANEL_PORT}`;
const SCP_OPTS = `-o StrictHostKeyChecking=no -o ConnectTimeout=15 -i "${SSH_KEY}" -P ${CPANEL_PORT}`;
const SSH_CMD = `ssh ${SSH_OPTS} ${CPANEL_USER}@${CPANEL_HOST}`;
const SCP_CMD = `scp ${SCP_OPTS}`;

// ─── Helpers ────────────────────────────────────────────────────
function run(cmd, opts = {}) {
  console.log(`  $ ${cmd.substring(0, 120)}${cmd.length > 120 ? '...' : ''}`);
  try {
    return execSync(cmd, { stdio: 'pipe', encoding: 'utf-8', timeout: 300000, ...opts });
  } catch (e) {
    console.error(`  ✗ Error: ${e.stderr?.substring(0, 200) || e.message}`);
    throw e;
  }
}

function ssh(remoteCmd) {
  return run(`${SSH_CMD} "${remoteCmd.replace(/"/g, '\\"')}"`);
}

function step(n, label) {
  console.log(`\n[${'='.repeat(40)}]`);
  console.log(`  PASO ${n}: ${label}`);
  console.log(`[${'='.repeat(40)}]\n`);
}

// ─── Main ───────────────────────────────────────────────────────
async function main() {
  console.log('╔══════════════════════════════════════╗');
  console.log('║  OFSERCONT IA — Deploy cPanel        ║');
  console.log('║  ati.exacontable.com                 ║');
  console.log('╚══════════════════════════════════════╝\n');

  // ─── Paso 0: Verificaciones ──────────────────────────────
  if (!existsSync(SSH_KEY)) {
    console.error(`✗ SSH key no encontrada: ${SSH_KEY}`);
    process.exit(1);
  }
  if (!existsSync('.next/standalone')) {
    console.error('✗ No existe .next/standalone/. Ejecuta primero: npm run build');
    process.exit(1);
  }

  // ─── Paso 1: Empaquetar ──────────────────────────────────
  step(1, 'Empaquetando build standalone');

  // Verificar que server.js existe en standalone
  if (!existsSync('.next/standalone/server.js')) {
    console.error('✗ .next/standalone/server.js no encontrado');
    process.exit(1);
  }

  // Empaquetar standalone completo + static + public + app.js + deps scraper
  // (webpack externaliza chromium/playwright; hay que subirlos aparte si no van en tracing)
  const tarItems = [
    '.next/standalone',
    '.next/static',
    'public',
    'app.js',
    'package.json',
    'scripts/deploy/entrypoint.sh',
  ].filter(f => existsSync(f));

  const scraperPkgs = [
    'node_modules/@sparticuz',
    'node_modules/playwright',
    'node_modules/playwright-core',
    'node_modules/playwright-extra',
    'node_modules/puppeteer-core',
    'node_modules/puppeteer-extra',
    'node_modules/puppeteer-extra-plugin-stealth',
    'node_modules/@scrapeless-ai',
    'node_modules/@antiadmin',
    'node_modules/2captcha-ts',
  ].filter(f => existsSync(f));

  console.log(`  Archivos a empaquetar: ${[...tarItems, ...scraperPkgs].join(', ')}`);

  const tarCmd = `tar czf ${DEPLOY_TGZ} ${[...tarItems, ...scraperPkgs].join(' ')}`;
  run(tarCmd);

  const fs = await import('fs');
  const size = fs.statSync(DEPLOY_TGZ).size;
  console.log(`  ✓ ${DEPLOY_TGZ} creado (${(size / 1024 / 1024).toFixed(1)} MB)`);

  // ─── Paso 2: Test SSH ────────────────────────────────────
  step(2, 'Verificando conexión SSH');
  const sshTest = ssh('echo SSH_OK');
  if (!sshTest.includes('SSH_OK')) {
    console.error('✗ No se pudo conectar al servidor');
    process.exit(1);
  }
  console.log('  ✓ Conexión SSH establecida');

  // ─── Paso 3: Backup ──────────────────────────────────────
  step(3, 'Backup del deploy actual');
  try {
    ssh(`cd ${APP_DIR} && cp -r .next .next.bak 2>/dev/null; cp server.js server.js.bak 2>/dev/null; echo BACKUP_OK`);
    console.log('  ✓ Backup creado (.next.bak, server.js.bak)');
  } catch { console.log('  ⚠ No había deploy previo, saltando backup'); }

  // ─── Paso 4: Upload ──────────────────────────────────────
  step(4, `Subiendo ${DEPLOY_TGZ} al servidor`);
  run(`${SCP_CMD} ${DEPLOY_TGZ} ${CPANEL_USER}@${CPANEL_HOST}:/tmp/${DEPLOY_TGZ}`);
  console.log('  ✓ Upload completado');

  // ─── Paso 5: Extraer y configurar ────────────────────────
  step(5, 'Extrayendo y configurando en el servidor');

  // Extraer (el tgz trae .next/standalone + .next/static + public + app.js + scraper pkgs)
  ssh(`cd ${APP_DIR} && rm -rf .next/standalone .next/static 2>/dev/null; tar xzf /tmp/${DEPLOY_TGZ} && echo EXTRACT_OK`);
  console.log('  ✓ Archivos extraídos');

  // Promover standalone a la raíz de la app Passenger
  ssh(`cd ${APP_DIR} && mkdir -p node_modules .next && cp -f .next/standalone/server.js ./server.js && cp -f .next/standalone/package.json ./package.json 2>/dev/null; cp -rf .next/standalone/.next/* .next/ 2>/dev/null; cp -rf .next/standalone/node_modules/. node_modules/ 2>/dev/null; echo MOVE_OK`);
  console.log('  ✓ server.js / .next / node_modules actualizados');

  // Asegurar static assets junto al server
  ssh(`cd ${APP_DIR} && mkdir -p .next/static && test -d .next/static/_next || true; echo STATIC_OK`);
  console.log('  ✓ static listo');

  // ─── Paso 6: Asegurar claves de scraping en .env ─────────
  // Comandos simples (sin heredoc) para que funcionen vía ssh en Windows.
  step(6, 'Asegurando variables de scraping en .env (sin sobrescribir secretos)');
  ssh(`cd ${APP_DIR} && grep -q '^HEADLESS=' .env || echo 'HEADLESS=true' >> .env; grep -q '^CRON_SECRET=' .env || echo 'CRON_SECRET=cambiar-por-un-secreto-seguro' >> .env; grep -q '^NEXT_PUBLIC_APP_URL=' .env || echo 'NEXT_PUBLIC_APP_URL=https://ati.exacontable.com' >> .env; sed -i 's|^HEADLESS=.*|HEADLESS=true|; s|^NEXT_PUBLIC_APP_URL=.*|NEXT_PUBLIC_APP_URL=https://ati.exacontable.com|; s|^NEXT_PUBLIC_DEV_MODE=.*|NEXT_PUBLIC_DEV_MODE=false|; s|^NODE_ENV=.*|NODE_ENV=production|' .env; echo ENV_OK`);
  console.log('  ✓ .env preservado + HEADLESS/URL asegurados');

  // ─── Paso 7: Actualizar .htaccess (Node 22) ──────────────
  // Evitar heredoc vía ssh "..." (en Windows deja el archivo vacío).
  step(7, 'Configurando Passenger con Node.js 22');
  ssh(`printf '%s\\n' '# DO NOT REMOVE. CLOUDLINUX PASSENGER CONFIGURATION BEGIN' 'PassengerEnabled on' 'PassengerAppEnv production' 'PassengerAppRoot ${APP_DIR}' 'PassengerStartupFile app.js' 'PassengerNodejs /opt/alt/alt-nodejs22/root/usr/bin/node' '# DO NOT REMOVE. CLOUDLINUX PASSENGER CONFIGURATION END' > ${APP_DIR}/.htaccess && wc -c ${APP_DIR}/.htaccess`);
  console.log('  ✓ .htaccess configurado con Node.js 22');

  // ─── Paso 8: Crear directorios + Chromium ejecutable ──────
  ssh(`cd ${APP_DIR} && mkdir -p downloads/xmls downloads/certs downloads/pdfs downloads/templates downloads/debug downloads/RIDE tmp/bin tmp/browser_session logs && chmod +x tmp/bin/chromium 2>/dev/null; ls -la tmp/bin/chromium 2>/dev/null | head -1; echo DIRS_OK`);
  console.log('  ✓ Directorios creados + chmod chromium');

  // ─── Paso 9: Limpiar logs y reiniciar ────────────────────
  step(8, 'Reiniciando aplicación');

  ssh(`cd ${APP_DIR} && > stderr.log && echo LOG_CLEARED`);
  console.log('  ✓ stderr.log limpiado');

  // Touch tmp/restart.txt para forzar restart de Passenger
  ssh(`touch ${APP_DIR}/tmp/restart.txt && echo RESTART_OK`);
  console.log('  ✓ Passenger reiniciado (touch tmp/restart.txt)');

  // ─── Paso 10: Limpieza ───────────────────────────────────
  step(9, 'Limpieza');
  ssh(`rm -f /tmp/${DEPLOY_TGZ}`);
  try { fs.unlinkSync(DEPLOY_TGZ); } catch {}
  console.log('  ✓ Archivos temporales eliminados');

  // ─── Paso 10: Verificación ───────────────────────────────
  step(10, 'Verificación');
  console.log('  Esperando 15s para que Passenger inicie...');
  await new Promise(r => setTimeout(r, 15000));

  try {
    const health = run(`curl -sk --max-time 15 https://ati.exacontable.com/api/health`);
    console.log(`  Respuesta: ${health.trim().substring(0, 200)}`);
    console.log('  ✓ Healthcheck OK');
  } catch {
    console.log('  ⚠ Healthcheck no respondió. Verificar logs:');
    console.log(`    ssh -p ${CPANEL_PORT} ${CPANEL_USER}@${CPANEL_HOST} "tail -20 ~/ati/stderr.log"`);
  }

  console.log('\n╔══════════════════════════════════════╗');
  console.log('║  ✅ Deploy completado                ║');
  console.log('║  https://ati.exacontable.com         ║');
  console.log('╚══════════════════════════════════════╝\n');
}

main().catch(err => {
  console.error('\n✗ Deploy falló:', err.message);
  process.exit(1);
});
