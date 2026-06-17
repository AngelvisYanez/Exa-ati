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
    
    const [columns] = await conn.execute('DESCRIBE comprobantes');
    console.log('--- Columns of table comprobantes ---');
    console.table(columns);
    
  } catch (e) {
    console.error(e);
  } finally {
    if (conn) await conn.end();
  }
})();
