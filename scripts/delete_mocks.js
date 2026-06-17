const mysql = require('mysql2/promise');

(async () => {
  try {
    const conn = await mysql.createConnection({
      host: 'localhost',
      user: 'root',
      database: 'db_sri'
    });
    const [result] = await conn.execute("DELETE FROM comprobantes WHERE id LIKE '10000000-%'");
    console.log(`Deleted ${result.affectedRows} mock comprobantes`);
    process.exit(0);
  } catch (e) {
    console.error(e);
    process.exit(1);
  }
})();
