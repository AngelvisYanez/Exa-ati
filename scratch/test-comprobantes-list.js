const mysql = require('mysql2/promise');
require('dotenv').config();

(async () => {
  let conn;
  try {
    conn = await mysql.createConnection({
      host: process.env.DB_HOST || 'localhost',
      port: parseInt(process.env.DB_PORT || '3306', 10),
      user: process.env.DB_USER || 'root',
      password: process.env.DB_PASSWORD || '',
      database: process.env.DB_NAME || 'db_sri',
    });

    const tenantId = '00000000-0000-0000-0000-000000000001';
    const userRuc = '0704439892001';
    const fechaDesde = '2026-06-01';
    const fechaHasta = '2026-06-30';

    console.log('--- DB Config ---');
    console.log(`tenantId: ${tenantId}`);
    console.log(`userRuc: ${userRuc}`);
    console.log(`fechaDesde: ${fechaDesde}`);
    console.log(`fechaHasta: ${fechaHasta}`);

    // Emisores checklist
    const [emisores] = await conn.execute(
      'SELECT id, ruc, tenant_id FROM emisores WHERE tenant_id = ? AND activo = 1',
      [tenantId]
    );
    console.log('\n--- Emisores in tenant ---', emisores);
    const emisorIds = emisores.map(e => e.id);

    const conditions = [];
    const params = [];

    if (emisorIds.length > 0) {
      const placeholders = emisorIds.map(() => '?').join(', ');
      conditions.push(`(c.tenant_id = ? OR c.receptor_identificacion = ? OR c.emisor_ruc = ? OR c.emisor_id IN (${placeholders}))`);
      params.push(tenantId, userRuc, userRuc, ...emisorIds);
    } else {
      conditions.push('(c.tenant_id = ? OR c.receptor_identificacion = ? OR c.emisor_ruc = ?)');
      params.push(tenantId, userRuc, userRuc);
    }

    if (fechaDesde) {
      conditions.push('c.fecha_emision >= ?');
      params.push(fechaDesde);
    }
    if (fechaHasta) {
      conditions.push('c.fecha_emision <= ?');
      params.push(fechaHasta);
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
    
    // Count query
    const countQuery = `
      SELECT COUNT(*) as total
      FROM comprobantes c
      LEFT JOIN emisores e ON c.emisor_id = e.id
      ${whereClause}
    `;
    const [countResult] = await conn.execute(countQuery, params);
    console.log('\n--- Count result ---', countResult);

    // Data query
    const dataQuery = `
      SELECT c.id, c.clave_acceso, c.fecha_emision, c.receptor_identificacion, c.emisor_ruc, c.estado
      FROM comprobantes c
      LEFT JOIN emisores e ON c.emisor_id = e.id
      ${whereClause}
    `;
    const [dataResult] = await conn.execute(dataQuery, params);
    console.log('\n--- Data result ---', dataResult);

    // Sync query simulation (fetchComprobantesBatch)
    const syncConditions = ['(c.tenant_id = ? OR c.receptor_identificacion = ? OR c.emisor_ruc = ?)'];
    const syncParams = [tenantId, userRuc, userRuc];
    syncConditions.push("NOT (c.estado = 'AUTORIZADO' AND cx.id IS NOT NULL)");
    
    const syncQuery = `
      SELECT c.id, c.clave_acceso, c.secuencial, c.tipo, c.estado, c.fecha_emision, c.emisor_ruc,
             cx.id AS tiene_xml
      FROM comprobantes c
      LEFT JOIN comprobante_xmls cx ON cx.comprobante_id = c.id AND cx.tipo = 'autorizado'
      WHERE ${syncConditions.join(' AND ')}
      ORDER BY (cx.id IS NULL) DESC, FIELD(c.estado, 'PENDIENTE','FIRMADO','ENVIADO','DEVUELTA'), c.updated_at ASC, c.id ASC
      LIMIT 50 OFFSET 0
    `;
    const [syncResult] = await conn.execute(syncQuery, syncParams);
    console.log('\n--- Sync query (fetchComprobantesBatch) result ---', syncResult);

  } catch (e) {
    console.error(e);
  } finally {
    if (conn) await conn.end();
  }
})();
