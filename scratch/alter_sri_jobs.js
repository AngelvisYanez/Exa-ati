const mysql = require('mysql2/promise');
require('dotenv').config({ path: '.env.local' });

async function run() {
  const conn = await mysql.createConnection({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME
  });
  
  try {
    // Add action_type column if it doesn't exist
    await conn.query("ALTER TABLE sri_jobs ADD COLUMN action_type VARCHAR(50) DEFAULT 'DOWNLOAD_RECEIVED' AFTER tipo_comprobante");
    console.log('Column action_type added to sri_jobs.');
  } catch (e) {
    if (e.code === 'ER_DUP_FIELDNAME') {
      console.log('Column action_type already exists.');
    } else {
      console.error(e);
    }
  }
  await conn.end();
}
run();
