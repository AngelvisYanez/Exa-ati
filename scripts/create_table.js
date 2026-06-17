const mysql = require('mysql2/promise');

(async () => {
  try {
    const conn = await mysql.createConnection({
      host: 'localhost',
      user: 'root',
      database: 'db_sri'
    });
    await conn.execute(`
      CREATE TABLE IF NOT EXISTS scraping_jobs (
        id INT AUTO_INCREMENT PRIMARY KEY,
        ruc VARCHAR(20) NOT NULL,
        clave_sri VARCHAR(255) NOT NULL,
        fecha_desde DATE,
        fecha_hasta DATE,
        mes INT,
        anio INT,
        tipo_comprobante VARCHAR(50) DEFAULT 'todos',
        status VARCHAR(50) DEFAULT 'PENDING',
        progress_message TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
      )
    `);
    await conn.execute(`
      CREATE TABLE IF NOT EXISTS comprobantes (
        clave_acceso VARCHAR(49) PRIMARY KEY,
        tipo VARCHAR(2),
        serie VARCHAR(7),
        secuencial VARCHAR(9),
        estado VARCHAR(50) DEFAULT 'PENDIENTE',
        fecha_emision DATE,
        numero_autorizacion VARCHAR(49),
        importe_total DECIMAL(10,2),
        receptor_identificacion VARCHAR(20),
        emisor_ruc VARCHAR(20),
        documentos_relacionados TEXT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
      )
    `);
    console.log('Table scraping_jobs is ready.');
    process.exit(0);
  } catch (e) {
    console.error(e);
    process.exit(1);
  }
})();
