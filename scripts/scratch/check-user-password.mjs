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
    const res = await client.query("SELECT email, password_hash, rol, ruc, activo FROM usuarios WHERE email = 'clientedeprueba@example.com'");
    const user = res.rows[0];
    if (!user) {
      console.log('❌ El usuario clientedeprueba@example.com no existe en Neon.');
      return;
    }

    console.log('👤 Datos de usuario:', user);
    
    const plainPassword = 'ClientePass123!';
    const match = await bcrypt.compare(plainPassword, user.password_hash);
    console.log(`🔑 Comparación de contraseña "${plainPassword}":`, match ? '✅ COINCIDE' : '❌ NO COINCIDE');

  } finally {
    client.release();
  }
  await pool.end();
}

main().catch(console.error);
