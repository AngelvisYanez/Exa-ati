const mysql = require('mysql2/promise');
require('dotenv').config({ path: '.env.local' });

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
    
    const [rows] = await conn.execute(
      "SELECT * FROM comprobantes WHERE clave_acceso = '0106202601092124087500120049010000021955198098811'"
    );
    console.log('--- COMPROBANTE ---');
    console.log(JSON.stringify(rows[0], null, 2));
    
    const [jobs] = await conn.execute(
      "SELECT * FROM scraping_jobs WHERE id = 9"
    );
    console.log('--- JOB 9 ---');
    console.log(JSON.stringify(jobs[0], null, 2));
    
  } catch (e) {
    console.error(e);
  } finally {
    if (conn) await conn.end();
  }
})();
