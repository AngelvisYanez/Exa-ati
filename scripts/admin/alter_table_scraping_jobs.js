const mysql = require('mysql2/promise');
(async () => {
  try {
    const conn = await mysql.createConnection({ host: 'localhost', user: 'root', database: 'db_sri' });
    await conn.execute('ALTER TABLE scraping_jobs ADD COLUMN fecha_desde DATE, ADD COLUMN fecha_hasta DATE, ADD COLUMN progress_message VARCHAR(255) DEFAULT "", MODIFY COLUMN mes INT NULL, MODIFY COLUMN anio INT NULL');
    console.log('Table altered successfully.');
    process.exit(0);
  } catch(e) {
    console.error(e);
    process.exit(1);
  }
})();
