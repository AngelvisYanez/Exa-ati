import { config } from 'dotenv';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import { Pool, neonConfig } from '@neondatabase/serverless';
import ws from 'ws';

const __dirname = dirname(fileURLToPath(import.meta.url));
config({ path: resolve(__dirname, '../../.env') });
neonConfig.webSocketConstructor = ws;

const pool = new Pool({
  connectionString: process.env.DIRECT_DATABASE_URL || process.env.DATABASE_URL,
});

const tables = [
  'asiento_lineas',
  'inventario_movimientos',
  'posiciones_fiscales_lineas',
  'secuenciales',
  'pagos_cuentas',
  'motivos_traslado',
  'tipos_documento_sri',
];

const client = await pool.connect();
try {
  for (const t of tables) {
    const r = await client.query(
      `SELECT column_name FROM information_schema.columns
       WHERE table_schema='public' AND table_name=$1
       ORDER BY ordinal_position`,
      [t]
    );
    console.log(
      t + ':',
      r.rows.length ? r.rows.map((x) => x.column_name).join(', ') : '(missing)'
    );
  }
} finally {
  client.release();
  await pool.end();
}
