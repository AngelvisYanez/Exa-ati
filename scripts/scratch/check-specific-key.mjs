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
    const key = '0306202601070324286700120010100003959941234567812';
    const r = await client.query('SELECT id, clave_acceso, fecha_emision, estado, created_at, updated_at FROM comprobantes WHERE clave_acceso = $1', [key]);
    console.log(JSON.stringify(r.rows[0], null, 2));
  } finally {
    client.release();
  }
  await pool.end();
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
