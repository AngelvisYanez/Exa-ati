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
    
    console.log('Altering table scraping_jobs progress_message column to TEXT...');
    await conn.execute(`
      ALTER TABLE scraping_jobs MODIFY COLUMN progress_message TEXT NULL;
    `);
    console.log('Table altered successfully.');
    await conn.end();
    process.exit(0);
  } catch (e) {
    console.error('Error altering table:', e);
    process.exit(1);
  }
})();
