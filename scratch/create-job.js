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
    
    // Inserción de un nuevo trabajo pendiente para el rango 2026-06-15 al 2026-06-16
    const [result] = await conn.execute(
      `INSERT INTO scraping_jobs (ruc, clave_sri, fecha_desde, fecha_hasta, tipo_comprobante, status, action_type) VALUES (?, ?, ?, ?, ?, 'PENDING', 'DOWNLOAD_RECEIVED')`,
      ['0704439892001', 'TorresC2024@', '2026-06-02', '2026-06-02', '1']
    );
    console.log('Trabajo encolado exitosamente con ID:', result.insertId);
    
  } catch (e) {
    console.error(e);
  } finally {
    if (conn) await conn.end();
  }
})();
