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

    console.log('--- Step 1: simple select ---');
    const [step1] = await conn.execute('SELECT id, tenant_id, receptor_identificacion FROM comprobantes');
    console.log(step1);

    console.log('--- Step 2: select with left join ---');
    const [step2] = await conn.execute(
      `SELECT c.id, c.estado, cx.id AS tiene_xml 
       FROM comprobantes c 
       LEFT JOIN comprobante_xmls cx ON cx.comprobante_id = c.id AND cx.tipo = 'autorizado'`
    );
    console.log(step2);

    console.log('--- Step 3: select with left join + where RUC/Tenant ---');
    const [step3] = await conn.execute(
      `SELECT c.id, c.estado, cx.id AS tiene_xml 
       FROM comprobantes c 
       LEFT JOIN comprobante_xmls cx ON cx.comprobante_id = c.id AND cx.tipo = 'autorizado'
       WHERE (c.tenant_id = ? OR c.receptor_identificacion = ? OR c.emisor_ruc = ?)`,
      [tenantId, userRuc, userRuc]
    );
    console.log(step3);

    console.log('--- Step 4: select with left join + where RUC/Tenant + NOT condition ---');
    const [step4] = await conn.execute(
      `SELECT c.id, c.estado, cx.id AS tiene_xml 
       FROM comprobantes c 
       LEFT JOIN comprobante_xmls cx ON cx.comprobante_id = c.id AND cx.tipo = 'autorizado'
       WHERE (c.tenant_id = ? OR c.receptor_identificacion = ? OR c.emisor_ruc = ?)
         AND NOT (c.estado = 'AUTORIZADO' AND cx.id IS NOT NULL)`,
      [tenantId, userRuc, userRuc]
    );
    console.log(step4);

  } catch (e) {
    console.error(e);
  } finally {
    if (conn) await conn.end();
  }
})();
