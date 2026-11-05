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
    console.log('--- NEON USUARIOS ---');
    const usersRes = await client.query('SELECT id, email, nombre, rol, ruc, activo FROM usuarios');
    console.log(usersRes.rows);

    console.log('--- NEON EMISORES ---');
    const emisoresRes = await client.query('SELECT id, ruc, razon_social, activo FROM emisores');
    console.log(emisoresRes.rows);
  } finally {
    client.release();
  }
  await pool.end();
}

main().catch(console.error);
