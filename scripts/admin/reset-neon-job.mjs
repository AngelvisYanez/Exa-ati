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
    await client.query("UPDATE scraping_jobs SET status = 'PENDING', progress_message = 'Reset para pruebas' WHERE id = 3");
    console.log('✅ Job 3 reset to PENDING in Neon database!');
  } finally {
    client.release();
  }
  await pool.end();
}

main().catch(err => {
  console.error(err);
});
