const mysql = require('mysql2/promise');

(async () => {
  try {
    const conn = await mysql.createConnection({host:'localhost', user:'root', database:'db_sri'});
    
    // reset failed jobs from previous run to PENDING for testing
    await conn.execute("UPDATE scraping_jobs SET status = 'PENDING' WHERE ruc = '0704439892001' AND status != 'COMPLETED'");
    
    const [jobs] = await conn.execute("SELECT * FROM scraping_jobs WHERE status = 'PENDING'");
    console.log('Pending Jobs:');
    console.table(jobs);
    
    if (jobs.length === 0) {
      await conn.execute("INSERT INTO scraping_jobs (ruc, clave_sri, mes, anio, status) VALUES (?, ?, ?, ?, 'PENDING')", ['0704439892001', 'TorresC2024@', 6, 2026]);
      console.log("Inserted a test job.");
    }
    process.exit(0);
  } catch(e) {
    console.error(e);
    process.exit(1);
  }
})();
