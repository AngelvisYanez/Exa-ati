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
    
    const [jobs] = await conn.execute('SELECT * FROM scraping_jobs ORDER BY created_at DESC LIMIT 5');
    console.log('--- scraping_jobs (last 5) ---');
    console.log(JSON.stringify(jobs, null, 2));

    const [emisores] = await conn.execute('SELECT id, ruc, razon_social, activo, tenant_id FROM emisores LIMIT 5');
    console.log('--- emisores ---');
    console.log(JSON.stringify(emisores, null, 2));
    
  } catch (e) {
    console.error(e);
  } finally {
    if (conn) await conn.end();
  }
})();
