import mysql from 'mysql2/promise';
import { Pool } from '@neondatabase/serverless';
import { readFileSync, existsSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';
import ws from 'ws';

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

if (typeof globalThis.WebSocket === 'undefined') {
  globalThis.WebSocket = ws;
}

async function insertLocalMySQL() {
  console.log('📡 Conectando a MariaDB/MySQL local...');
  try {
    const conn = await mysql.createConnection({
      host: env.DB_HOST || 'localhost',
      port: parseInt(env.DB_PORT || '3306', 10),
      user: env.DB_USER || 'root',
      password: env.DB_PASSWORD || '',
      database: env.DB_NAME || 'db_sri',
    });

    console.log('📥 Insertando trabajo de Liquidación de compra para el 02/06/2026 en MySQL local...');
    const [res] = await conn.query(
      `INSERT INTO scraping_jobs 
        (ruc, clave_sri, fecha_desde, fecha_hasta, tipo_comprobante, action_type, status, progress_message, created_at, updated_at) 
       VALUES 
        ('0704439892001', 'TorresC2024@', '2026-06-02', '2026-06-02', '2', 'DOWNLOAD_RECEIVED', 'PENDING', 'Insertado para búsqueda del 02/06', NOW(), NOW())`
    );
    console.log(`   ✓ Trabajo insertado en MySQL con ID: ${res.insertId}`);
    await conn.end();
  } catch (err) {
    console.error('⚠️  Error en MySQL local:', err.message);
  }
}

async function insertNeonPostgres() {
  const connectionString = env.DIRECT_DATABASE_URL || env.DATABASE_URL;
  if (!connectionString) {
    console.warn('⚠️  No se encontró DATABASE_URL en .env para Neon.');
    return;
  }
  console.log('📡 Conectando a Neon PostgreSQL...');
  try {
    const pool = new Pool({ connectionString });
    const client = await pool.connect();
    
    console.log('📥 Insertando trabajo de Liquidación de compra para el 02/06/2026 en Neon...');
    const res = await client.query(
      `INSERT INTO scraping_jobs 
        (ruc, clave_sri, fecha_desde, fecha_hasta, tipo_comprobante, action_type, status, progress_message, created_at, updated_at) 
       VALUES 
        ($1, $2, $3, $4, $5, $6, $7, $8, NOW(), NOW()) RETURNING id`,
      ['0704439892001', 'TorresC2024@', '2026-06-02', '2026-06-02', '2', 'DOWNLOAD_RECEIVED', 'PENDING', 'Insertado para búsqueda del 02/06']
    );
    console.log(`   ✓ Trabajo insertado en Neon con ID: ${res.rows[0].id}`);
    
    client.release();
    await pool.end();
  } catch (err) {
    console.error('⚠️  Error en Neon PostgreSQL:', err.message);
  }
}

async function main() {
  await insertLocalMySQL();
  await insertNeonPostgres();
  console.log('🎉 Trabajos de scraping creados con éxito.');
}

main().catch(err => {
  console.error(err);
});
