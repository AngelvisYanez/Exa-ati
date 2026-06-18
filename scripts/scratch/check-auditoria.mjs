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
    const logs = await client.query('SELECT * FROM auditoria ORDER BY id DESC LIMIT 10');
    console.log(JSON.stringify(logs.rows, null, 2));
  } finally {
    client.release();
  }
  await pool.end();
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
