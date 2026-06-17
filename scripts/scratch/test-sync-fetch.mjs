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
    const tenantId = 'c5a176cb-e41b-4030-bc5b-e885822cf0f5';
    const userRuc = '0704439892001';
    const fechaDesde = '2026-06-03';
    const fechaHasta = '2026-06-03';

    // Build conditions
    const conditions = ['(c.tenant_id = $1 OR c.receptor_identificacion = $2 OR c.emisor_ruc = $3)'];
    const params = [tenantId, userRuc, userRuc];

    conditions.push('c.fecha_emision >= $4');
    params.push(fechaDesde);

    conditions.push('c.fecha_emision <= $5');
    params.push(fechaHasta);

    const query = `
      SELECT c.id, c.clave_acceso, c.secuencial, c.tipo, c.estado, c.fecha_emision, c.emisor_ruc,
             cx.id AS tiene_xml
      FROM comprobantes c
      LEFT JOIN comprobante_xmls cx ON cx.comprobante_id = c.id AND cx.tipo = 'autorizado'
      WHERE ${conditions.join(' AND ')}
      ORDER BY c.fecha_emision ASC, c.secuencial ASC, c.id ASC
    `;

    console.log('Query:', query);
    console.log('Params:', params);
    
    const r = await client.query(query, params);
    console.log(`Results: ${r.rows.length}`);
    console.log(JSON.stringify(r.rows, null, 2));

  } finally {
    client.release();
  }
  await pool.end();
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
