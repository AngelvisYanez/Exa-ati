import { Pool } from '@neondatabase/serverless';
import { config } from 'dotenv';
import ws from 'ws';

config({ path: '.env' });

if (typeof globalThis.WebSocket === 'undefined') {
  globalThis.WebSocket = ws;
}

const connectionString = process.env.DIRECT_DATABASE_URL || process.env.DATABASE_URL;
const pool = new Pool({ connectionString });

async function main() {
  const client = await pool.connect();
  try {
    const f1 = await client.query("SELECT COUNT(*) FROM comprobantes WHERE fecha_emision >= '2026-06-03T04:00:00.000Z'");
    const f2 = await client.query("SELECT COUNT(*) FROM comprobantes WHERE fecha_emision >= '2026-06-03'");
    console.log(`Using '2026-06-03T04:00:00.000Z': ${f1.rows[0].count}`);
    console.log(`Using '2026-06-03': ${f2.rows[0].count}`);
  } finally {
    client.release();
  }
  await pool.end();
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
