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
    const emisorRes = await client.query(
      `SELECT id, tenant_id, ruc, razon_social, nombre_comercial, activo, ambiente, created_at, updated_at 
       FROM emisores WHERE ruc = '0704439892001'`
    );
    console.log('📋 Emisores con RUC 0704439892001:');
    console.log(JSON.stringify(emisorRes.rows, null, 2));

    const receivedRes = await client.query(
      `SELECT id, receptor_identificacion, receptor_razon_social, emisor_ruc, emisor_razon_social 
       FROM comprobantes WHERE receptor_identificacion = '0704439892001' LIMIT 5`
    );
    console.log('📋 Primeros 5 comprobantes recibidos:');
    console.log(JSON.stringify(receivedRes.rows, null, 2));

    const emittedCount = await client.query(
      `SELECT COUNT(*) FROM comprobantes WHERE emisor_ruc = '0704439892001'`
    );
    console.log(`📋 Comprobantes emitidos: ${emittedCount.rows[0].count}`);

    const receivedCount = await client.query(
      `SELECT COUNT(*) FROM comprobantes WHERE receptor_identificacion = '0704439892001'`
    );
    console.log(`📋 Comprobantes recibidos: ${receivedCount.rows[0].count}`);

    const lastJobs = await client.query(
      `SELECT id, tenant_id, ruc, status, progress_message, created_at, updated_at 
       FROM scraping_jobs WHERE ruc = '0704439892001' ORDER BY created_at DESC LIMIT 5`
    );
    console.log('📋 Últimos Scraping Jobs para este RUC:');
    console.log(JSON.stringify(lastJobs.rows, null, 2));

  } finally {
    client.release();
  }
  await pool.end();
}

main().catch(console.error);
