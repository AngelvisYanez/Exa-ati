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
    console.log('\n═══ BUSCANDO COMPROBANTES CON CLAVE 03062026% ═══');
    const r = await client.query("SELECT id, clave_acceso, fecha_emision, tipo, emisor_ruc, emisor_razon_social, estado, created_at, updated_at FROM comprobantes WHERE clave_acceso LIKE '03062026%'");
    console.log(`Encontrados: ${r.rows.length}`);
    for (const row of r.rows) {
      console.log(JSON.stringify(row, null, 2));
    }
  } finally {
    client.release();
  }
  await pool.end();
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
