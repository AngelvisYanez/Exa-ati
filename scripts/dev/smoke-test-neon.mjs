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

async function runTest() {
  console.log('📡 Conectando a Neon PostgreSQL para prueba de salud de las tablas...');
  const client = await pool.connect();
  const checks = [];

  const tables = ['tenants', 'usuarios', 'emisores', 'auditoria', 'secuenciales', 'comprobantes', 'comprobante_xmls', 'scraping_jobs', 'tenant_settings', 'notificaciones'];
  for (const table of tables) {
    try {
      const res = await client.query(`SELECT COUNT(*) AS c FROM "${table}"`);
      checks.push({ table, ok: true, count: res.rows[0].c });
    } catch (e) {
      checks.push({ table, ok: false, error: e.message });
    }
  }

  const queries = [
    ['emisores.tipo_contribuyente', 'SELECT "tipo_contribuyente" FROM "emisores" LIMIT 1'],
    ['emisores.notificaciones', 'SELECT "notif_documentos", "notif_generacion", "notif_email" FROM "emisores" LIMIT 1'],
    ['emisores.whatsapp', 'SELECT "whatsapp_numero", "whatsapp_estado" FROM "emisores" LIMIT 1'],
    ['tenant_settings.sync', 'SELECT "last_sync_at", "last_sync_result" FROM "tenant_settings" LIMIT 1'],
    ['notificaciones.cols', 'SELECT "dedupe_key", "channel", "unread", "event_at" FROM "notificaciones" LIMIT 1'],
  ];

  for (const [name, sql] of queries) {
    try {
      await client.query(sql);
      checks.push({ query: name, ok: true });
    } catch (e) {
      checks.push({ query: name, ok: false, error: e.message });
    }
  }

  client.release();
  await pool.end();

  console.log(JSON.stringify(checks, null, 2));
  const failed = checks.filter(c => !c.ok);
  if (failed.length > 0) {
    console.error(`❌ Fallaron ${failed.length} pruebas de humo en Neon.`);
    process.exit(1);
  } else {
    console.log('✅ Todas las pruebas de humo en Neon pasaron exitosamente.');
  }
}

runTest().catch(err => {
  console.error('Error fatal:', err);
  process.exit(1);
});
