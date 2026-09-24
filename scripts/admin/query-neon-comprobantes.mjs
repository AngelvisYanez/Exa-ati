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
  const cs = env.DIRECT_DATABASE_URL || env.DATABASE_URL;
  const pool = new Pool({ connectionString: cs });

  // Columnas de comprobantes
  const cols = await pool.query(
    `SELECT column_name, data_type FROM information_schema.columns
     WHERE table_name = 'comprobantes' ORDER BY ordinal_position`
  );
  console.log('Columnas comprobantes:');
  cols.rows.forEach(c => console.log('  ' + c.column_name + ' (' + c.data_type + ')'));

  // Contar
  const count = await pool.query('SELECT COUNT(*) as total FROM comprobantes');
  console.log('\nTotal comprobantes:', count.rows[0].total);

  // Estado del job
  const jobs = await pool.query(
    "SELECT id, status, progress_message, updated_at FROM scraping_jobs WHERE ruc = $1 ORDER BY id DESC LIMIT 5",
    ['0704439892001']
  );
  console.log('\nJobs scraping:');
  jobs.rows.forEach(j => console.log(`  ID ${j.id}: ${j.status} | ${j.progress_message} | ${j.updated_at}`));

  // Datos si existen
  if (count.rows[0].total > 0) {
    const docs = await pool.query('SELECT * FROM comprobantes ORDER BY fecha_emision DESC LIMIT 10');
    console.log('\nDocumentos sincronizados:');
    docs.rows.forEach((d, i) => {
      console.log(`\n--- Documento ${i + 1} ---`);
      for (const [k, v] of Object.entries(d)) {
        if (v !== null && v !== undefined) {
          const val = typeof v === 'object' ? JSON.stringify(v).slice(0, 100) : String(v).slice(0, 80);
          console.log(`  ${k}: ${val}`);
        }
      }
    });
  }

  await pool.end();
}

main().catch(e => console.error(e));
