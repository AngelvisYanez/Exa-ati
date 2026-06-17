import mysql from 'mysql2/promise';
import { readFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const envPath = resolve(__dirname, '../.env.local');
const env = Object.fromEntries(
  readFileSync(envPath, 'utf8')
    .split('\n')
    .filter((l) => l && !l.startsWith('#') && l.includes('='))
    .map((l) => {
      const i = l.indexOf('=');
      return [l.slice(0, i).trim(), l.slice(i + 1).trim()];
    })
);

const pool = mysql.createPool({
  host: env.DB_HOST || 'localhost',
  port: parseInt(env.DB_PORT || '3306', 10),
  database: env.DB_NAME || 'db_sri',
  user: env.DB_USER || 'root',
  password: env.DB_PASSWORD || '',
});

const ruc = '0704439892001';

const [upd] = await pool.query(
  `UPDATE emisores SET ambiente = '2', updated_at = NOW() WHERE ruc = ? AND activo = 1`,
  [ruc]
);

const [emisores] = await pool.query(
  `SELECT ruc, razon_social, ambiente FROM emisores WHERE ruc = ? AND activo = 1`,
  [ruc]
);

const [rows] = await pool.query(
  `SELECT clave_acceso, secuencial, fecha_emision, estado FROM comprobantes
   WHERE emisor_ruc = ? OR receptor_identificacion = ?
   ORDER BY fecha_emision DESC`,
  [ruc, ruc]
);

const stats = { prod: 0, prueba: 0, otro: 0 };
for (const r of rows) {
  const amb = r.clave_acceso?.charAt(23);
  if (amb === '2') stats.prod++;
  else if (amb === '1') stats.prueba++;
  else stats.otro++;
}

console.log(JSON.stringify({
  envAmbiente: env.SRI_AMBIENTE,
  emisorUpdated: upd.affectedRows,
  emisor: emisores[0] || null,
  totalComprobantes: rows.length,
  clavesPorAmbiente: stats,
  muestra: rows.slice(0, 5).map((r) => ({
    secuencial: r.secuencial,
    fecha: r.fecha_emision,
    estado: r.estado,
    ambClave: r.clave_acceso?.charAt(23),
    clave: r.clave_acceso?.slice(0, 20) + '...',
  })),
}, null, 2));

await pool.end();
