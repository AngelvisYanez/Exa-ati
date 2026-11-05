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
    console.log('\n═══ ESTADO DEL JOB 18 ═══');
    const job = await client.query('SELECT * FROM scraping_jobs WHERE id = 18');
    if (job.rows.length > 0) {
      console.log(JSON.stringify(job.rows[0], null, 2));
    } else {
      console.log('No se encontró el job 18.');
    }

    console.log('\n═══ COMPROBANTES DE FACTURA FECHA 3 JUNIO 2026 ═══');
    const comps = await client.query(
      `SELECT id, clave_acceso, tipo, emisor_ruc, emisor_razon_social, 
              estado, importe_total, fecha_emision, categoria, 
              numero_autorizacion, fecha_autorizacion, created_at
       FROM comprobantes 
       WHERE fecha_emision = '2026-06-03' 
       ORDER BY id`
    );
    console.log(`Total comprobantes de factura encontrados para 2026-06-03: ${comps.rows.length}`);
    for (const row of comps.rows) {
      console.log(`  [${row.id}]`);
      console.log(`    Clave: ${row.clave_acceso}`);
      console.log(`    Tipo: ${row.tipo} | Emisor: ${row.emisor_razon_social} | RUC: ${row.emisor_ruc}`);
      console.log(`    Total: $${row.importe_total} | Estado: ${row.estado} | Categoría: ${row.categoria}`);
      console.log(`    Autorización: ${row.numero_autorizacion ? 'SÍ' : 'NO'} | Fecha Auth: ${row.fecha_autorizacion || 'N/A'}`);
      console.log(`    Creado: ${row.created_at}`);
    }

    if (comps.rows.length > 0) {
      const ids = comps.rows.map(r => r.id);
      console.log('\n═══ XMLs GUARDADOS (comprobante_xmls) ═══');
      const xmls = await client.query(
        `SELECT comprobante_id, ruta_archivo, xml_autorizado_path, created_at FROM comprobante_xmls WHERE comprobante_id = ANY($1::uuid[])`,
        [ids]
      );
      console.log(`Total XMLs guardados: ${xmls.rows.length}`);
      for (const row of xmls.rows) {
        console.log(`  `, JSON.stringify(row));
      }
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
