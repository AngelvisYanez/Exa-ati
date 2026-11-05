import mysql from 'mysql2/promise';
import { Pool } from '@neondatabase/serverless';
import { readFileSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import ws from 'ws';

const __dirname = dirname(fileURLToPath(import.meta.url));

function loadEnv() {
  const envPath = join(__dirname, '..', '.env');
  if (!existsSync(envPath)) return {};
  return Object.fromEntries(
    readFileSync(envPath, 'utf8').split('\n')
      .filter(l => l.trim() && !l.startsWith('#'))
      .map(l => [l.slice(0, l.indexOf('=')).trim(), l.slice(l.indexOf('=') + 1).trim()])
  );
}
const env = loadEnv();
if (typeof globalThis.WebSocket === 'undefined') globalThis.WebSocket = ws;

async function main() {
  const ruc = '0704439892001';
  const claveSri = 'TorresC2024@';
  const fecha = '2026-06-01';

  console.log('=== Sincronización Masiva Facturas SRI ===');
  console.log(`RUC: ${ruc} | Fecha: ${fecha}`);

  // 1. Insertar en MySQL (local worker)
  try {
    const conn = await mysql.createConnection({
      host: env.DB_HOST || 'localhost',
      port: parseInt(env.DB_PORT || '3306', 10),
      user: env.DB_USER || 'root',
      password: env.DB_PASSWORD || '',
      database: env.DB_NAME || 'db_sri',
    });

    await conn.query("DELETE FROM scraping_jobs WHERE ruc = ? AND fecha_desde = ?", [ruc, fecha]);

    const [res] = await conn.query(
      `INSERT INTO scraping_jobs 
        (ruc, clave_sri, fecha_desde, fecha_hasta, tipo_comprobante, action_type, status, progress_message, created_at, updated_at) 
       VALUES (?, ?, ?, ?, '1', 'DOWNLOAD_RECEIVED', 'PENDING', 'Sincronización facturas 01/06/2026', NOW(), NOW())`,
      [ruc, claveSri, fecha, fecha]
    );
    const mysqlId = res.insertId;
    console.log(`\n1. Job MySQL creado: ID ${mysqlId}`);

    console.log('   Esperando 15s para que el worker local procese...');
    await new Promise(r => setTimeout(r, 15000));

    const [rows] = await conn.query('SELECT id, status, progress_message FROM scraping_jobs WHERE id = ?', [mysqlId]);
    console.log(`   Estado MySQL: ${JSON.stringify(rows[0])}`);

    const [comprobantes] = await conn.query('SELECT COUNT(*) as total FROM comprobantes WHERE ruc_emisor = ?', [ruc]);
    console.log(`   Comprobantes en MySQL: ${comprobantes[0].total}`);
    await conn.end();
  } catch (e) {
    console.log(`\nMySQL local no disponible: ${e.message}`);
  }

  // 2. Insertar en Neon y disparar via API
  try {
    const cs = env.DIRECT_DATABASE_URL || env.DATABASE_URL;
    if (!cs) { console.log('\nNo DATABASE_URL definida'); return; }

    const pool = new Pool({ connectionString: cs });

    await pool.query('DELETE FROM scraping_jobs WHERE ruc = $1 AND fecha_desde = $2', [ruc, fecha]);

    const res = await pool.query(
      `INSERT INTO scraping_jobs 
        (ruc, clave_sri, fecha_desde, fecha_hasta, tipo_comprobante, action_type, status, progress_message, created_at, updated_at) 
       VALUES ($1, $2, $3, $4, '1', 'DOWNLOAD_RECEIVED', 'PENDING', 'Sincronización facturas 01/06/2026', NOW(), NOW()) RETURNING id`,
      [ruc, claveSri, fecha, fecha]
    );
    const neonId = res.rows[0].id;
    console.log(`\n2. Job Neon creado: ID ${neonId}`);

    console.log('   Disparando vía API /api/sri/sync...');
    const fetch = (await import('node-fetch')).default;
    const apiRes = await fetch('http://localhost:3000/api/sri/sync', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ jobId: neonId }),
      signal: AbortSignal.timeout(300000)
    });
    const apiData = await apiRes.json();
    console.log(`   API response: ${JSON.stringify(apiData)}`);

    if (apiData.success) {
      await new Promise(r => setTimeout(r, 3000));
      const comps = await pool.query('SELECT COUNT(*) as total FROM comprobantes WHERE ruc_emisor = $1', [ruc]);
      console.log(`\n3. Comprobantes en Neon: ${comps.rows[0].total}`);

      if (comps.rows[0].total > 0) {
        const docs = await pool.query(
          `SELECT clave_acceso, tipo_documento, fecha_emision, razon_social_origen, numero_documento, total, estado 
           FROM comprobantes WHERE ruc_emisor = $1 ORDER BY fecha_emision DESC LIMIT 20`,
          [ruc]
        );
        console.log('\n4. Documentos sincronizados:');
        docs.rows.forEach((d, i) => {
          console.log(`   ${i + 1}. ${d.tipo_documento} | ${d.numero_documento} | ${d.razon_social_origen} | $${d.total} | ${d.estado}`);
        });
      }
    }

    await pool.end();
  } catch (e) {
    console.error(`\nError Neon/API: ${e.message}`);
  }

  console.log('\n=== Proceso completado ===');
}

main();
