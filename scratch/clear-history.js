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
    
    console.log('Limpiando historial de tareas...');
    await conn.execute('TRUNCATE TABLE scraping_jobs');
    console.log('✅ Historial de scraping_jobs truncado.');
    
    await conn.execute('DELETE FROM comprobantes');
    console.log('✅ Tabla comprobantes vaciada.');
    
  } catch (e) {
    console.error('Error al limpiar el historial:', e);
  } finally {
    if (conn) await conn.end();
  }
})();
