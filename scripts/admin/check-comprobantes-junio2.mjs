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
    // 1. Comprobantes para la fecha 2 de junio 2026
    console.log('\n═══ COMPROBANTES FECHA 2 JUNIO 2026 ═══');
    const comps = await client.query(
      `SELECT id, clave_acceso, tipo, emisor_ruc, emisor_razon_social, 
              estado, importe_total, fecha_emision, categoria, 
              numero_autorizacion, fecha_autorizacion, created_at
       FROM comprobantes 
       WHERE fecha_emision = '2026-06-02' 
       ORDER BY id`
    );
    console.log(`Total comprobantes encontrados: ${comps.rows.length}`);
    for (const row of comps.rows) {
      console.log(`  [${row.id}]`);
      console.log(`    Clave: ${row.clave_acceso}`);
      console.log(`    Tipo: ${row.tipo} | Emisor: ${row.emisor_razon_social} | RUC: ${row.emisor_ruc}`);
      console.log(`    Total: $${row.importe_total} | Estado: ${row.estado} | Categoría: ${row.categoria}`);
      console.log(`    Autorización: ${row.numero_autorizacion ? 'SÍ' : 'NO'} | Fecha Auth: ${row.fecha_autorizacion || 'N/A'}`);
      console.log(`    Creado: ${row.created_at}`);
    }

    // 2. Verificar tabla comprobante_xmls - primero columnas
    console.log('\n═══ ESTRUCTURA comprobante_xmls ═══');
    const cols = await client.query(
      `SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'comprobante_xmls' ORDER BY ordinal_position`
    );
    for (const col of cols.rows) {
      console.log(`  ${col.column_name}: ${col.data_type}`);
    }

    // 3. XMLs guardados
    if (comps.rows.length > 0) {
      const ids = comps.rows.map(r => r.id);
      console.log('\n═══ XMLs GUARDADOS (comprobante_xmls) ═══');
      const xmls = await client.query(
        `SELECT * FROM comprobante_xmls WHERE comprobante_id = ANY($1::uuid[])`,
        [ids]
      );
      console.log(`Total XMLs guardados: ${xmls.rows.length}`);
      for (const row of xmls.rows) {
        const keys = Object.keys(row).filter(k => k !== 'xml_content');
        const display = {};
        for (const k of keys) display[k] = row[k];
        console.log(`  `, JSON.stringify(display));
      }
    }

    // 4. Limpiar job PENDING viejo (id=7)
    console.log('\n═══ LIMPIANDO JOB PENDING VIEJO ID=7 ═══');
    await client.query(
      `UPDATE scraping_jobs SET status = 'CANCELLED', progress_message = 'Limpiado automáticamente' WHERE id = 7 AND status = 'PENDING'`
    );
    console.log('✅ Job 7 marcado como CANCELLED');

    // 5. Jobs completados para fecha junio 2
    console.log('\n═══ JOBS COMPLETADOS PARA JUNIO 2 ═══');
    const completedJobs = await client.query(
      `SELECT id, status, progress_message, created_at, updated_at 
       FROM scraping_jobs 
       WHERE fecha_desde::date = '2026-06-02' AND status = 'COMPLETED'
       ORDER BY updated_at DESC`
    );
    for (const row of completedJobs.rows) {
      console.log(`  [Job ${row.id}] ${row.status} | ${row.progress_message} | ${row.updated_at}`);
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
