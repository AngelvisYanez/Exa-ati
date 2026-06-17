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
    
    // Resetear el trabajo 9 para buscar sólo el 1 de junio
    await conn.execute(
      "UPDATE scraping_jobs SET status = 'PENDING', progress_message = 'Prueba del 1 de junio de 2026', fecha_desde = '2026-06-01', fecha_hasta = '2026-06-01' WHERE id = ?",
      [9]
    );
    console.log('Trabajo 9 restablecido a PENDING para buscar el 1 de junio de 2026.');
    
  } catch (e) {
    console.error(e);
  } finally {
    if (conn) await conn.end();
  }
})();
