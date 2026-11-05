import mysql from 'mysql2/promise';
import { readFileSync, existsSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

function loadEnv() {
  const envPath = join(__dirname, '..', '..', '.env.local');
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

async function inspect() {
  const conn = await mysql.createConnection({
    host: env.DB_HOST || 'localhost',
    user: env.DB_USER || 'root',
    password: env.DB_PASSWORD || '',
    database: env.DB_NAME || 'db_sri',
  });

  console.log('--- USUARIOS ---');
  const [users] = await conn.query('SELECT id, email, nombre, rol, ruc, activo FROM usuarios');
  console.log(users);

  console.log('--- EMISORES ---');
  const [emisores] = await conn.query('SELECT id, ruc, razon_social, activo FROM emisores');
  console.log(emisores);

  await conn.end();
}

inspect().catch(console.error);
