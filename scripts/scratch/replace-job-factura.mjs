import { Pool } from '@neondatabase/serverless';
import { config } from 'dotenv';
import ws from 'ws';
config({ path: '.env' });
if (typeof globalThis.WebSocket === 'undefined') globalThis.WebSocket = ws;
const pool = new Pool({ connectionString: process.env.DIRECT_DATABASE_URL });
const client = await pool.connect();

// 1. Cancelar job 17
await client.query(`UPDATE scraping_jobs SET status = 'CANCELLED', progress_message = 'Reemplazado por job solo facturas' WHERE id = 17 AND status IN ('PENDING','PROCESSING')`);
console.log('✅ Job 17 cancelado');

// 2. Obtener clave_sri de job anterior
const prev = await client.query(`SELECT clave_sri, tenant_id FROM scraping_jobs WHERE ruc = '0704439892001' AND clave_sri IS NOT NULL LIMIT 1`);
const claveSri = prev.rows[0].clave_sri;
const tenantId = prev.rows[0].tenant_id;

// 3. Crear nuevo job solo FACTURAS
const newJob = await client.query(
  `INSERT INTO scraping_jobs (ruc, clave_sri, fecha_desde, fecha_hasta, tipo_comprobante, status, action_type, tenant_id)
   VALUES ($1, $2, '2026-06-03', '2026-06-03', '1', 'PENDING', 'DOWNLOAD_RECEIVED', $3)
   RETURNING id`,
  ['0704439892001', claveSri, tenantId]
);
console.log(`✅ Nuevo Job creado: ID ${newJob.rows[0].id} | tipo=Factura('1') | fecha=2026-06-03`);

client.release();
await pool.end();
