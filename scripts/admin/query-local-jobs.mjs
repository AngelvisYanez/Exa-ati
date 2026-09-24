import mysql from 'mysql2/promise';
import { readFileSync, existsSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

function loadEnv() {
  const envPath = join(__dirname, '..', '.env');
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

async function main() {
  const conn = await mysql.createConnection({
    host: env.DB_HOST || 'localhost',
    port: parseInt(env.DB_PORT || '3306', 10),
    user: env.DB_USER || 'root',
    password: env.DB_PASSWORD || '',
    database: env.DB_NAME || 'db_sri',
  });

  const [rows] = await conn.query("SELECT id, ruc, fecha_desde, fecha_hasta, status, progress_message FROM scraping_jobs");
  console.log('📋 Trabajos de scraping actuales en MySQL local:');
  console.log(JSON.stringify(rows, null, 2));

  await conn.end();
}

main().catch(err => {
  console.error(err);
});
