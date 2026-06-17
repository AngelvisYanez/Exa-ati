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
    
    await conn.execute(
      "UPDATE scraping_jobs SET status = 'PENDING', progress_message = 'Reset para pruebas' WHERE ruc = '0704439892001'"
    );
    console.log('Todos los trabajos de Torres resetados a PENDING.');
    
  } catch (e) {
    console.error(e);
  } finally {
    if (conn) await conn.end();
  }
})();
