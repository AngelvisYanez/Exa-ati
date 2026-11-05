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
    // 1. Comprobantes existentes para el 3 de junio
    console.log('\n═══ COMPROBANTES FECHA 3 JUNIO 2026 ═══');
    const comps = await client.query(
      `SELECT id, clave_acceso, tipo, emisor_ruc, emisor_razon_social, 
              estado, importe_total, fecha_emision, categoria, 
              numero_autorizacion, fecha_autorizacion, created_at
       FROM comprobantes 
       WHERE fecha_emision = '2026-06-03' 
       ORDER BY id`
    );
    console.log(`Total comprobantes encontrados: ${comps.rows.length}`);
    for (const row of comps.rows) {
      console.log(`  [${row.id}]`);
      console.log(`    Clave: ${row.clave_acceso}`);
      console.log(`    Tipo: ${row.tipo} | Emisor: ${row.emisor_razon_social} | RUC: ${row.emisor_ruc}`);
      console.log(`    Total: $${row.importe_total} | Estado: ${row.estado} | Categoría: ${row.categoria}`);
      console.log(`    Autorización: ${row.numero_autorizacion ? 'SÍ' : 'NO'} | Fecha Auth: ${row.fecha_autorizacion || 'N/A'}`);
    }

    // 2. Verificar XMLs para esos comprobantes
    if (comps.rows.length > 0) {
      const ids = comps.rows.map(r => r.id);
      console.log('\n═══ XMLs GUARDADOS ═══');
      const xmls = await client.query(
        `SELECT id, comprobante_id, tipo, created_at 
         FROM comprobante_xmls WHERE comprobante_id = ANY($1::uuid[])`,
        [ids]
      );
      console.log(`Total XMLs: ${xmls.rows.length}`);
      for (const row of xmls.rows) {
        console.log(`  [XML ${row.id}] comp_id=${row.comprobante_id} | tipo=${row.tipo}`);
      }
    }

    // 3. Jobs existentes para junio 3
    console.log('\n═══ JOBS PARA JUNIO 3 ═══');
    const jobs = await client.query(
      `SELECT id, status, progress_message, tenant_id, ruc, clave_sri, created_at
       FROM scraping_jobs 
       WHERE fecha_desde::date = '2026-06-03'
       ORDER BY created_at DESC`
    );
    for (const row of jobs.rows) {
      console.log(`  [Job ${row.id}] ${row.status} | tenant: ${row.tenant_id} | ${row.progress_message}`);
    }

    // 4. Obtener tenant_id y clave_sri del emisor
    console.log('\n═══ INFO EMISOR ═══');
    const emisor = await client.query(
      `SELECT tenant_id, ruc FROM emisores WHERE ruc = '0704439892001' AND activo = true`
    );
    if (emisor.rows.length > 0) {
      console.log(`  Tenant: ${emisor.rows[0].tenant_id} | RUC: ${emisor.rows[0].ruc}`);
    } else {
      console.log('  ⚠️ No se encontró emisor activo');
    }

    // 5. Insertar nuevo job PENDING para junio 3
    console.log('\n═══ CREANDO NUEVO JOB PARA JUNIO 3 ═══');
    // Obtener clave_sri de un job anterior exitoso
    const prevJob = await client.query(
      `SELECT clave_sri, tenant_id FROM scraping_jobs WHERE ruc = '0704439892001' AND clave_sri IS NOT NULL LIMIT 1`
    );
    
    if (prevJob.rows.length > 0) {
      const tenantId = emisor.rows[0]?.tenant_id || prevJob.rows[0].tenant_id;
      const claveSri = prevJob.rows[0].clave_sri;
      
      const newJob = await client.query(
        `INSERT INTO scraping_jobs (ruc, clave_sri, fecha_desde, fecha_hasta, tipo_comprobante, status, action_type, tenant_id, progress_message)
         VALUES ($1, $2, '2026-06-03', '2026-06-03', 'todos', 'PENDING', 'DOWNLOAD_RECEIVED', $3, NULL)
         RETURNING id`,
        ['0704439892001', claveSri, tenantId]
      );
      console.log(`✅ Job creado con ID: ${newJob.rows[0].id}`);
      console.log(`   Fecha: 2026-06-03 | Tipo: todos | Status: PENDING`);
      console.log(`   Ahora ejecuta el worker para procesarlo: npx tsx scripts/worker/index.ts`);
    } else {
      console.log('❌ No se encontró clave_sri en jobs anteriores');
    }

  } finally {
    client.release();
  }
  await pool.end();
}

main().catch(err => {
  console.error('Error:', err.message);
  process.exit(1);
});
