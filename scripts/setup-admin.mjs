import mysql from 'mysql2/promise';
import bcrypt from 'bcrypt';
import { readFileSync, existsSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

function loadEnv() {
  const envPath = join(__dirname, '..', '.env.local');
  if (!existsSync(envPath)) return {};
  const lines = readFileSync(envPath, 'utf8').split('\n');
  const env = {};
  for (const line of lines) {
    const t = line.trim();
    if (!t || t.startsWith('#')) continue;
    const i = t.indexOf('=');
    if (i === -1) continue;
    env[t.slice(0, i).trim()] = t.slice(i + 1).trim();
  }
  return env;
}

async function columnExists(conn, dbName, table, column) {
  const [rows] = await conn.query(
    `SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS
     WHERE TABLE_SCHEMA = ? AND TABLE_NAME = ? AND COLUMN_NAME = ?`,
    [dbName, table, column]
  );
  return rows.length > 0;
}

async function indexExists(conn, dbName, table, indexName) {
  const [rows] = await conn.query(
    `SELECT INDEX_NAME FROM INFORMATION_SCHEMA.STATISTICS
     WHERE TABLE_SCHEMA = ? AND TABLE_NAME = ? AND INDEX_NAME = ?`,
    [dbName, table, indexName]
  );
  return rows.length > 0;
}

async function tableExists(conn, dbName, table) {
  const [rows] = await conn.query(
    `SELECT TABLE_NAME FROM INFORMATION_SCHEMA.TABLES
     WHERE TABLE_SCHEMA = ? AND TABLE_NAME = ?`,
    [dbName, table]
  );
  return rows.length > 0;
}

async function addColumnIfMissing(conn, dbName, table, column, definition) {
  if (!(await columnExists(conn, dbName, table, column))) {
    await conn.query(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`);
    console.log(`  + ${table}.${column}`);
  }
}

async function runMigration002(conn, dbName) {
  console.log('\n--- Migración 002: alinear schema ---');

  await addColumnIfMissing(conn, dbName, 'comprobantes', 'categoria', "VARCHAR(50) NULL");
  await addColumnIfMissing(conn, dbName, 'comprobantes', 'moneda', "VARCHAR(10) DEFAULT 'USD'");
  await addColumnIfMissing(conn, dbName, 'comprobantes', 'estado_sri', 'VARCHAR(30) NULL');
  await addColumnIfMissing(conn, dbName, 'comprobantes', 'tipo_emision', "CHAR(1) DEFAULT '1'");

  await addColumnIfMissing(conn, dbName, 'emisores', 'notif_documentos', 'TINYINT(1) DEFAULT 1');
  await addColumnIfMissing(conn, dbName, 'emisores', 'notif_generacion', 'TINYINT(1) DEFAULT 1');
  await addColumnIfMissing(conn, dbName, 'emisores', 'whatsapp_numero', 'VARCHAR(20) NULL');
  await addColumnIfMissing(conn, dbName, 'emisores', 'whatsapp_estado', "VARCHAR(20) DEFAULT 'DESCONECTADO'");

  if (!(await columnExists(conn, dbName, 'emisores', 'sri_password_encrypted'))) {
    await conn.query(
      `ALTER TABLE emisores ADD COLUMN sri_password_encrypted VARCHAR(500) NULL
       COMMENT 'Contraseña del portal SRI en línea, cifrada AES-256'`
    );
    console.log('  + emisores.sri_password_encrypted');
  }

  const indexes = [
    ['comprobantes', 'idx_comp_tenant_fecha', '(tenant_id, fecha_emision)'],
    ['comprobantes', 'idx_comp_emisor_ruc', '(emisor_ruc)'],
    ['comprobantes', 'idx_comp_receptor', '(receptor_identificacion)'],
  ];
  for (const [table, name, cols] of indexes) {
    if (!(await indexExists(conn, dbName, table, name))) {
      await conn.query(`CREATE INDEX ${name} ON ${table} ${cols}`);
      console.log(`  + index ${name}`);
    }
  }

  if (!(await tableExists(conn, dbName, 'tenant_settings'))) {
    await conn.query(`
      CREATE TABLE tenant_settings (
        id CHAR(36) NOT NULL DEFAULT (UUID()),
        tenant_id CHAR(36) NOT NULL,
        llm_provider ENUM('gemini','claude') DEFAULT 'gemini',
        llm_model VARCHAR(100) NULL,
        gemini_api_key_encrypted VARCHAR(500) NULL,
        claude_api_key_encrypted VARCHAR(500) NULL,
        llm_configured_at TIMESTAMP NULL,
        last_sync_at TIMESTAMP NULL,
        last_sync_result JSON NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        PRIMARY KEY (id),
        UNIQUE KEY uq_tenant_settings_tenant (tenant_id),
        FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `);
    console.log('  + tabla tenant_settings');
  }

  console.log('Migración 002 OK');
}

const env = loadEnv();
const ADMIN_EMAIL = process.env.ADMIN_EMAIL || 'admin@ofsercont.com';
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'Ofsercont2026';
const ADMIN_NOMBRE = process.env.ADMIN_NOMBRE || 'Administrador OFSERCONT';

async function main() {
  const dbName = env.DB_NAME || 'db_sri';
  const conn = await mysql.createConnection({
    host: env.DB_HOST || 'localhost',
    port: parseInt(env.DB_PORT || '3306', 10),
    user: env.DB_USER || 'root',
    password: env.DB_PASSWORD || '',
    database: dbName,
    multipleStatements: true,
  });

  console.log('Conectado a MariaDB:', dbName);
  await runMigration002(conn, dbName);

  const [existing] = await conn.query(
    'SELECT id, email, rol FROM usuarios WHERE email = ?',
    [ADMIN_EMAIL]
  );

  if (existing.length > 0) {
    const hash = await bcrypt.hash(ADMIN_PASSWORD, 12);
    await conn.query(
      `UPDATE usuarios SET password_hash = ?, rol = 'ADMIN', nombre = ?, activo = 1, updated_at = NOW()
       WHERE email = ?`,
      [hash, ADMIN_NOMBRE, ADMIN_EMAIL]
    );
    console.log('Usuario admin actualizado:', ADMIN_EMAIL);
  } else {
    const [tenantRows] = await conn.query(
      'SELECT id FROM tenants WHERE activo = 1 ORDER BY created_at ASC LIMIT 1'
    );
    let tenantId = tenantRows[0]?.id;

    if (!tenantId) {
      await conn.query(`INSERT INTO tenants (nombre, activo) VALUES (?, 1)`, ['Tenant Admin']);
      const [newTenant] = await conn.query('SELECT id FROM tenants ORDER BY created_at DESC LIMIT 1');
      tenantId = newTenant[0]?.id;
    }

    const hash = await bcrypt.hash(ADMIN_PASSWORD, 12);
    await conn.query(
      `INSERT INTO usuarios (email, password_hash, nombre, rol, tenant_id, activo)
       VALUES (?, ?, ?, 'ADMIN', ?, 1)`,
      [ADMIN_EMAIL, hash, ADMIN_NOMBRE, tenantId]
    );
    console.log('Usuario admin creado:', ADMIN_EMAIL);
  }

  await conn.end();

  console.log('\n--- Credenciales de acceso ---');
  console.log('Email:    ', ADMIN_EMAIL);
  console.log('Password: ', ADMIN_PASSWORD);
  console.log('Rol:       ADMIN');
  console.log('Login:     http://localhost:3000/login');
}

main().catch((err) => {
  console.error('Error:', err.message);
  process.exit(1);
});
