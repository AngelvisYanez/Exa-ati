const mysql = require('mysql2/promise');

(async () => {
  console.log('Running raw alter script for MySQL...');
  try {
    const conn = await mysql.createConnection({
      host: process.env.DB_HOST || 'localhost',
      port: parseInt(process.env.DB_PORT || '3306', 10),
      database: process.env.DB_NAME || 'db_sri',
      user: process.env.DB_USER || 'root',
      password: process.env.DB_PASSWORD || '',
    });

    const [columns] = await conn.execute(`
      SHOW COLUMNS FROM \`usuarios\` LIKE 'ruc'
    `);

    if (columns.length === 0) {
      await conn.execute(`
        ALTER TABLE \`usuarios\` ADD COLUMN \`ruc\` VARCHAR(20) DEFAULT NULL AFTER \`tenant_id\`
      `);
      console.log('MySQL: Column "ruc" successfully added to "usuarios" table.');
    } else {
      console.log('MySQL: Column "ruc" already exists in "usuarios" table.');
    }

    await conn.end();
    console.log('Done.');
    process.exit(0);
  } catch (err) {
    console.error('Failed to alter MySQL database:', err.message);
    process.exit(1);
  }
})();
