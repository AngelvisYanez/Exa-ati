import { Pool } from '@neondatabase/serverless';
import { config } from 'dotenv';
import ws from 'ws';

config({ path: '.env' });

if (typeof globalThis.WebSocket === 'undefined') {
  globalThis.WebSocket = ws;
}

const connectionString = process.env.DIRECT_DATABASE_URL || process.env.DATABASE_URL;
if (!connectionString) {
  console.error('❌ No se encontró DATABASE_URL en .env');
  process.exit(1);
}

const pool = new Pool({ connectionString });

async function main() {
  const client = await pool.connect();
  try {
    const cols = await client.query(
      `SELECT column_name, data_type FROM information_schema.columns
       WHERE table_name = 'auditoria' ORDER BY ordinal_position`
    );
    console.log('Columnas auditoria:');
    cols.rows.forEach(c => console.log('  ' + c.column_name + ' (' + c.data_type + ')'));

    const res = await client.query("SELECT * FROM auditoria ORDER BY created_at DESC LIMIT 20");
    console.log('\n📋 Últimos logs de auditoría en Neon PostgreSQL:');
    console.log(JSON.stringify(res.rows, null, 2));
  } finally {
    client.release();
  }
  await pool.end();
}

main().catch(err => {
  console.error(err);
});
