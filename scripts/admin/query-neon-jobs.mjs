import { Pool } from '@neondatabase/serverless';
import { config } from 'dotenv';
import ws from 'ws';

config({ path: '.env' });

if (typeof globalThis.WebSocket === 'undefined') {
  globalThis.WebSocket = ws;
}

const connectionString = process.env.DIRECT_DATABASE_URL || process.env.DATABASE_URL;
if (!connectionString) {
  console.error('❌ No se encontró DATABASE_URL en .env');
  process.exit(1);
}

const pool = new Pool({ connectionString });

async function main() {
  const client = await pool.connect();
  try {
    const res = await client.query('SELECT id, ruc, fecha_desde, fecha_hasta, status, progress_message FROM scraping_jobs');
    console.log('📋 Trabajos de scraping actuales en Neon PostgreSQL:');
    console.log(JSON.stringify(res.rows, null, 2));
  } finally {
    client.release();
  }
  await pool.end();
}

main().catch(err => {
  console.error(err);
});
