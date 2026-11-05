import mysql from 'mysql2/promise';
import { readFileSync, existsSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

function loadEnv() {
  const envPath = join(__dirname, '..', '.env.local');
  if (!existsSync(envPath)) return {};
  const lines = readFileSync(envPath, 'utf8').split('\n');
  const env = {};
  for (const line of lines) {
    const t = line.trim();
    if (!t || t.startsWith('#')) continue;
    const i = t.indexOf('=');
    if (i === -1) continue;
    env[t.slice(0, i).trim()] = t.slice(i + 1).trim();
  }
  return env;
}

const env = loadEnv();

async function smokeTest() {
  const conn = await mysql.createConnection({
    host: env.DB_HOST || 'localhost',
    user: env.DB_USER || 'root',
    password: env.DB_PASSWORD || '',
    database: env.DB_NAME || 'db_sri',
  });

  const checks = [];

  const tables = ['emisores', 'comprobantes', 'tenant_settings', 'usuarios'];
  for (const table of tables) {
    const [rows] = await conn.query(`SELECT COUNT(*) AS c FROM ${table}`);
    checks.push({ table, ok: true, count: rows[0].c });
  }

  const queries = [
    ['comprobantes.tipo', 'SELECT tipo, total_sin_impuesto FROM comprobantes LIMIT 1'],
    ['tenant_settings', 'SELECT llm_provider FROM tenant_settings LIMIT 1'],
    ['emisores.whatsapp', 'SELECT whatsapp_estado, notif_documentos FROM emisores LIMIT 1'],
  ];

  for (const [name, sql] of queries) {
    try {
      await conn.query(sql);
      checks.push({ query: name, ok: true });
    } catch (e) {
      checks.push({ query: name, ok: false, error: e.message });
    }
  }

  await conn.end();

  const failed = checks.filter((c) => c.ok === false);
  console.log(JSON.stringify(checks, null, 2));
  if (failed.length) {
    console.error('Smoke tests FAILED:', failed.length);
    process.exit(1);
  }
  console.log('Smoke tests OK:', checks.length);
}

smokeTest().catch((e) => {
  console.error(e.message);
  process.exit(1);
});
