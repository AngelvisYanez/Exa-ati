const mysql = require('mysql2/promise');
(async () => {
  try {
    const conn = await mysql.createConnection({host: 'localhost', user: 'root', database: 'db_sri'});
    await conn.execute("INSERT INTO scraping_jobs (ruc, clave_sri, mes, anio, status) VALUES ('0704439892001', 'TorresC2024@', 6, 2026, 'PENDING')");
    console.log('✅ Job masivo insertado en la base de datos');
    process.exit(0);
  } catch(e) {
    console.error(e);
    process.exit(1);
  }
})();
