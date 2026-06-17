const mysql = require('mysql2/promise');
require('dotenv').config();

function extractFechaEmision(claveAcceso) {
  if (claveAcceso && claveAcceso.length === 49) {
    const d = claveAcceso.substring(0, 2);
    const m = claveAcceso.substring(2, 4);
    const y = claveAcceso.substring(4, 8);
    return `${y}-${m}-${d}`;
  }
  return null;
}

function classifyExpense(razonSocial) {
  if (!razonSocial) return 'Otros';
  const r = razonSocial.toLowerCase();
  if (r.includes('favorita') || r.includes('supermaxi') || r.includes('aliment') || r.includes('supermercado')) {
    return 'Alimentación';
  }
  if (r.includes('farmacia') || r.includes('hospital') || r.includes('salud') || r.includes('medico')) {
    return 'Salud';
  }
  if (r.includes('universidad') || r.includes('colegio') || r.includes('educa')) {
    return 'Educación';
  }
  if (r.includes('inmobiliaria') || r.includes('arriendo') || r.includes('vivienda')) {
    return 'Vivienda';
  }
  if (r.includes('ropa') || r.includes('textil') || r.includes('moda')) {
    return 'Vestimenta';
  }
  if (r.includes('telecom') || r.includes('claro') || r.includes('cnt') || r.includes('internet')) {
    return 'Negocio/Servicios';
  }
  return 'Otros';
}

(async () => {
  let conn;
  try {
    conn = await mysql.createConnection({
      host: process.env.DB_HOST || 'localhost',
      port: parseInt(process.env.DB_PORT || '3306', 10),
      user: process.env.DB_USER || 'root',
      password: process.env.DB_PASSWORD || '',
      database: process.env.DB_NAME || 'db_sri',
    });

    console.log('Obteniendo comprobantes...');
    const [rows] = await conn.execute('SELECT id, clave_acceso, emisor_razon_social, fecha_emision, categoria FROM comprobantes');

    console.log(`Corrigiendo ${rows.length} comprobantes...`);
    for (const row of rows) {
      const parsedDate = extractFechaEmision(row.clave_acceso);
      const targetCategory = classifyExpense(row.emisor_razon_social);
      
      const newDate = row.fecha_emision ? null : parsedDate;
      const newCategory = (row.categoria === 'Otros' || !row.categoria) ? targetCategory : null;

      if (newDate || newCategory) {
        let updateParts = [];
        let params = [];
        if (newDate) {
          updateParts.push('fecha_emision = ?');
          params.push(newDate);
        }
        if (newCategory) {
          updateParts.push('categoria = ?');
          params.push(newCategory);
        }
        params.push(row.id);
        
        await conn.execute(
          `UPDATE comprobantes SET ${updateParts.join(', ')} WHERE id = ?`,
          params
        );
        console.log(`Comprobante ${row.clave_acceso} actualizado: fecha_emision=${newDate || 'no-change'}, categoria=${newCategory || 'no-change'}`);
      }
    }
    console.log('✅ Corrección de comprobantes finalizada.');

  } catch (e) {
    console.error(e);
  } finally {
    if (conn) await conn.end();
  }
})();
