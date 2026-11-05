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
    
    // Check if column already exists
    const [columns] = await conn.execute("SHOW COLUMNS FROM scraping_jobs LIKE 'tipo_comprobante'");
    if (columns.length === 0) {
      await conn.execute("ALTER TABLE scraping_jobs ADD COLUMN tipo_comprobante VARCHAR(50) DEFAULT 'todos'");
      console.log("Columna 'tipo_comprobante' añadida correctamente.");
    } else {
      console.log("La columna 'tipo_comprobante' ya existe.");
    }
    
    // Also make sure create_table.js schema has this column so it doesn't break if run on clean setup
    await conn.end();
    process.exit(0);
  } catch(e) {
    console.error("Error al alterar la tabla:", e);
    process.exit(1);
  }
})();
