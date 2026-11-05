import { Pool } from '@neondatabase/serverless';
import { config } from 'dotenv';
import bcrypt from 'bcrypt';
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
    const plainPassword = 'ClientePass123!';
    const hash = await bcrypt.hash(plainPassword, 12);
    
    const res = await client.query(
      "UPDATE usuarios SET password_hash = $1 WHERE email = 'clientedeprueba@example.com'",
      [hash]
    );
    
    console.log('✅ Contraseña actualizada en Neon. Filas afectadas:', res.rowCount);
  } finally {
    client.release();
  }
  await pool.end();
}

main().catch(console.error);
