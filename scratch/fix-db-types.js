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

    console.log('Actualizando tipos de comprobante en DB...');
    await conn.execute("UPDATE comprobantes SET tipo = '01' WHERE tipo = '1'");
    await conn.execute("UPDATE comprobantes SET tipo = '03' WHERE tipo = '2'");
    await conn.execute("UPDATE comprobantes SET tipo = '04' WHERE tipo = '3'");
    await conn.execute("UPDATE comprobantes SET tipo = '05' WHERE tipo = '4'");
    await conn.execute("UPDATE comprobantes SET tipo = '07' WHERE tipo = '6'");
    console.log('✅ Tipos de comprobante actualizados correctamente.');

  } catch (e) {
    console.error(e);
  } finally {
    if (conn) await conn.end();
  }
})();
