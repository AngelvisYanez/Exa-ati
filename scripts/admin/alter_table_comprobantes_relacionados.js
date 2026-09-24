const mysql = require('mysql2/promise');
require('dotenv').config();

(async () => {
  try {
    const conn = await mysql.createConnection({
      host: process.env.DB_HOST || 'localhost',
      port: parseInt(process.env.DB_PORT || '3306', 10),
      user: process.env.DB_USER || 'root',
      password: process.env.DB_PASSWORD || '',
      database: process.env.DB_NAME || 'db_sri',
    });
    
    console.log('Adding documentos_relacionados column to comprobantes table...');
    await conn.execute(`
      ALTER TABLE comprobantes ADD COLUMN documentos_relacionados TEXT NULL;
    `);
    console.log('Column added successfully.');
    await conn.end();
    process.exit(0);
  } catch (e) {
    console.error('Error altering table:', e.message);
    process.exit(1);
  }
})();
