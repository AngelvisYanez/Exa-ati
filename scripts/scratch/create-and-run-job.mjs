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
    // 1. Obtener clave_sri de job anterior
    const prev = await client.query(`SELECT clave_sri, tenant_id FROM scraping_jobs WHERE ruc = '0704439892001' AND clave_sri IS NOT NULL LIMIT 1`);
    if (prev.rows.length === 0) {
      throw new Error('No se encontró clave_sri previa en la base de datos.');
    }
    const claveSri = prev.rows[0].clave_sri;
    const tenantId = prev.rows[0].tenant_id;

    // 2. Crear nuevo job para el 3 de junio 2026
    const newJob = await client.query(
      `INSERT INTO scraping_jobs (ruc, clave_sri, fecha_desde, fecha_hasta, tipo_comprobante, status, action_type, tenant_id)
       VALUES ($1, $2, '2026-06-03', '2026-06-03', '1', 'PENDING', 'DOWNLOAD_RECEIVED', $3)
       RETURNING id`,
      ['0704439892001', claveSri, tenantId]
    );
    const jobId = newJob.rows[0].id;
    console.log(`✅ Job ${jobId} creado en la base de datos.`);

    // 3. Trigger API sync
    console.log(`🚀 Disparando sync para Job ${jobId}...`);
    const response = await fetch(`http://localhost:3000/api/sri/sync`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ jobId })
    });
    
    const data = await response.json();
    console.log('Respuesta de la API:', JSON.stringify(data, null, 2));

  } catch (error) {
    console.error('Error:', error);
  } finally {
    client.release();
  }
  await pool.end();
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
