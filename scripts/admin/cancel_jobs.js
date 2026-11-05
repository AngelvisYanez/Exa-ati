const mysql = require('mysql2/promise');

(async () => {
  let conn;
  try {
    conn = await mysql.createConnection({ host: 'localhost', user: 'root', database: 'db_sri' });
    
    // 1. Mirar historial
    const [rows] = await conn.execute('SELECT * FROM scraping_jobs ORDER BY created_at DESC LIMIT 5');
    console.log('--- Historial Reciente ---');
    console.table(rows);
    
    // 2. Cancelar pendientes o procesando
    const [updateResult] = await conn.execute("UPDATE scraping_jobs SET status = 'CANCELLED', progress_message = 'Cancelado por el usuario' WHERE status IN ('PENDING', 'PROCESSING')");
    console.log(`\nTareas canceladas: ${updateResult.affectedRows}`);
    
    // 3. (Opcional) Hacer una nueva: es mejor que el usuario la haga desde la UI para que ponga su RUC y Clave reales.
    // Pero si queremos insertar una de prueba:
    // await conn.execute("INSERT INTO scraping_jobs (ruc, clave_sri, fecha_desde, fecha_hasta, status) VALUES ('1790000000001', 'clave_falsa', '2023-10-01', '2023-10-05', 'PENDING')");
    
    process.exit(0);
  } catch (e) {
    console.error('Error:', e);
    process.exit(1);
  } finally {
    if (conn) await conn.end();
  }
})();
