const mysql = require('mysql2/promise');

async function monitor() {
  const conn = await mysql.createConnection({host: 'localhost', user: 'root', database: 'db_sri'});
  console.log("Iniciando monitoreo de tabla comprobantes...");
  
  let retries = 0;
  while(retries < 24) { // 2 minutos máximo
    const [rows] = await conn.execute("SELECT COUNT(*) as count FROM comprobantes");
    const count = rows[0].count;
    
    if (count > 0) {
      console.log(`\n🎉 ¡ÉXITO! Se han descargado e insertado ${count} comprobantes en la base de datos.`);
      const [latest] = await conn.execute("SELECT clave_acceso, fecha_emision, importe_total FROM comprobantes LIMIT 5");
      console.table(latest);
      process.exit(0);
    }
    
    await new Promise(r => setTimeout(r, 5000));
    retries++;
  }
  
  console.log("Tiempo de espera agotado. No se detectaron nuevos comprobantes.");
  process.exit(1);
}

monitor().catch(console.error);
