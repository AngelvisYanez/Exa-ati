const mysql = require('mysql2/promise');
require('dotenv').config({ path: require('path').resolve(__dirname, '../.env.local') });
require('dotenv').config({ path: require('path').resolve(__dirname, '../.env') });

(async () => {
  try {
    const conn = await mysql.createConnection({
      host: process.env.DB_HOST || 'localhost',
      port: parseInt(process.env.DB_PORT || '3306', 10),
      user: process.env.DB_USER || 'root',
      password: process.env.DB_PASSWORD || '',
      database: process.env.DB_NAME || 'db_sri',
    });
    
    await conn.execute("TRUNCATE TABLE scraping_jobs");
    console.log("Historial de tareas (tabla scraping_jobs) vaciado correctamente.");
    
    await conn.end();
    process.exit(0);
  } catch(e) {
    console.error("Error al vaciar el historial:", e);
    process.exit(1);
  }
})();
