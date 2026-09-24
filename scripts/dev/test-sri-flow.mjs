import { Pool } from '@neondatabase/serverless';
import { config } from 'dotenv';
import ws from 'ws';
import bcrypt from 'bcrypt';
import fetch from 'node-fetch';

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
const BASE = 'http://localhost:3000';

async function setupAdminUser(client) {
  // 1. Obtener o crear tenant
  let tenantId;
  const tenantsRes = await client.query('SELECT id FROM tenants LIMIT 1');
  if (tenantsRes.rows.length > 0) {
    tenantId = tenantsRes.rows[0].id;
  } else {
    const newTenant = await client.query(
      'INSERT INTO tenants (nombre, activo) VALUES ($1, true) RETURNING id',
      ['Tenant Test']
    );
    tenantId = newTenant.rows[0].id;
    console.log('  + Creado tenant de prueba:', tenantId);
  }

  // 2. Obtener o crear admin
  const adminEmail = 'admin@ofsercont.com';
  const adminPass = 'Ofsercont2026';
  const userRes = await client.query('SELECT id FROM usuarios WHERE email = $1', [adminEmail]);

  if (userRes.rows.length === 0) {
    const hash = await bcrypt.hash(adminPass, 12);
    await client.query(
      `INSERT INTO usuarios (email, password_hash, nombre, rol, tenant_id, activo)
       VALUES ($1, $2, 'Administrador de Pruebas', 'ADMIN', $3, true)`,
      [adminEmail, hash, tenantId]
    );
    console.log('  + Creado usuario administrador de prueba:', adminEmail);
  } else {
    // Asegurar contraseña y activación
    const hash = await bcrypt.hash(adminPass, 12);
    await client.query(
      `UPDATE usuarios SET password_hash = $1, activo = true, tenant_id = $2 WHERE email = $3`,
      [hash, tenantId, adminEmail]
    );
    console.log('  + Saneado usuario administrador existente:', adminEmail);
  }

  return { email: adminEmail, password: adminPass };
}

async function runTest() {
  const client = await pool.connect();
  let adminCredentials;
  try {
    console.log('🔒 Preparando usuario administrador de prueba en Neon...');
    adminCredentials = await setupAdminUser(client);
  } finally {
    client.release();
  }

  console.log('📡 Realizando Login para obtener JWT...');
  const loginRes = await fetch(`${BASE}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(adminCredentials),
  });

  const loginData = await loginRes.json();
  if (!loginRes.ok) {
    console.error('❌ Login fallido:', loginRes.status, loginData);
    process.exit(1);
  }

  const token = loginData.accessToken;
  console.log('✅ Login exitoso. JWT obtenido.');

  const authHeader = {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json'
  };

  const linkPayload = {
    ruc: '0704439892001',
    sriPassword: 'TorresC2024@'
  };

  console.log('\n🔗 Iniciando flujo de Vinculación y Sincronización SRI...');
  console.log(`📡 Enviando POST a ${BASE}/api/sri/vincular con RUC ${linkPayload.ruc}...`);

  const t0 = Date.now();
  const vincularRes = await fetch(`${BASE}/api/sri/vincular`, {
    method: 'POST',
    headers: authHeader,
    body: JSON.stringify(linkPayload),
  });

  const vincularData = await vincularRes.json();
  const duration = ((Date.now() - t0) / 1000).toFixed(2);

  console.log(`⏱️ Petición completada en ${duration}s.`);
  console.log('=== RESULTADO DE VINCULACIÓN ===');
  console.log(JSON.stringify({
    status: vincularRes.status,
    ok: vincularRes.ok,
    message: vincularData.message,
    portalValidation: vincularData.portalValidation,
    sync: vincularData.sync ? {
      procesados: vincularData.sync.procesados,
      importados: vincularData.sync.importados,
      actualizados: vincularData.sync.actualizados,
      errores: vincularData.sync.errores
    } : null
  }, null, 2));

  // Verificar la base de datos Neon
  console.log('\n📊 Validando registros guardados en Neon PostgreSQL...');
  const verifyClient = await pool.connect();
  try {
    const emisor = await verifyClient.query('SELECT ruc, razon_social, activo FROM emisores WHERE ruc = $1', [linkPayload.ruc]);
    console.log('   ✓ Emisor en DB:', emisor.rows[0]);

    const comprobantes = await verifyClient.query('SELECT COUNT(*) AS c FROM comprobantes WHERE emisor_ruc = $1 OR receptor_identificacion = $1', [linkPayload.ruc]);
    console.log('   ✓ Total comprobantes vinculados en DB:', comprobantes.rows[0].c);

    const settings = await verifyClient.query('SELECT last_sync_at, last_sync_result FROM tenant_settings LIMIT 1');
    console.log('   ✓ Historial de sincronización guardado:', settings.rows[0]);

    const logs = await verifyClient.query('SELECT COUNT(*) AS c FROM auditoria');
    console.log('   ✓ Registro de auditoría guardado:', logs.rows[0].c);

  } finally {
    verifyClient.release();
  }

  await pool.end();
  console.log('\n🎉 Flujo de prueba completado exitosamente.');
}

runTest().catch(err => {
  console.error('❌ Error general durante el test:', err);
  pool.end();
  process.exit(1);
});
