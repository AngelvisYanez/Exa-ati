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
    const colsRes = await client.query(
      `SELECT column_name, data_type, is_nullable, column_default FROM information_schema.columns
       WHERE table_name = 'auditoria' ORDER BY ordinal_position`
    );
    console.log('📋 Columnas de auditoria:');
    colsRes.rows.forEach(c => console.log(`  ${c.column_name}: ${c.data_type} (nullable: ${c.is_nullable}, default: ${c.column_default})`));

    const jobRes = await client.query("SELECT id, tenant_id, ruc, status, progress_message, tipo_comprobante FROM scraping_jobs WHERE id = 3");
    console.log('📋 Job 3:');
    console.log(JSON.stringify(jobRes.rows, null, 2));

    const auditRes = await client.query("SELECT * FROM auditoria ORDER BY created_at DESC LIMIT 5");
    console.log('📋 Últimos registros de auditoría:');
    console.log(JSON.stringify(auditRes.rows, null, 2));
  } finally {
    client.release();
  }
  await pool.end();
}

main().catch(console.error);
