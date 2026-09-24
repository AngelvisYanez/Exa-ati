/**
 * scripts/admin/apply-all-migrations.mjs
 *
 * Aplica migraciones SQL idempotentes a Neon (PostgreSQL) y/o MySQL local.
 *
 * Uso:
 *   node scripts/admin/apply-all-migrations.mjs           # ambos si hay credenciales
 *   node scripts/admin/apply-all-migrations.mjs --neon     # solo Neon
 *   node scripts/admin/apply-all-migrations.mjs --mysql    # solo MySQL
 */
import { config } from 'dotenv';
import { readFileSync, existsSync } from 'fs';
import { resolve, dirname, basename } from 'path';
import { fileURLToPath } from 'url';
import { Pool, neonConfig } from '@neondatabase/serverless';
import ws from 'ws';
import mysql from 'mysql2/promise';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, '../..');
config({ path: resolve(root, '.env') });

neonConfig.webSocketConstructor = ws;

const args = new Set(process.argv.slice(2));

const PG_FILES = [
  '001_init_postgres.sql',
  '002_add_contable_embeddings.sql',
  '002_empleados.sql',
  '003_add_cuentas_por_cobrar_pagar.sql',
  '003_asientos_inventario.sql',
  'add_whatsapp_notif_columns.sql',
  '006_hot_table_indexes.sql',
];

const MYSQL_FILES = [
  '001_init_mysql.sql',
  '002_add_contable_embeddings_mysql.sql',
  '002_empleados_mysql.sql',
  '003_add_cuentas_por_cobrar_pagar_mysql.sql',
  '003_asientos_inventario_mysql.sql',
  'add_whatsapp_notif_columns_mysql.sql',
];

const EXPECTED_TABLES = [
  'asientos',
  'asiento_lineas',
  'inventario_movimientos',
  'empleados',
  'cuentas_por_cobrar',
  'cuentas_por_pagar',
  'pagos_cuentas',
  'contable_embeddings',
];

function maskUrl(url) {
  return String(url).replace(/:([^@/]+)@/, ':****@');
}

/** Split SQL into statements, keeping DO $$ ... $$ blocks intact. */
function splitSql(sql) {
  const cleaned = sql
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .split('\n')
    .map((line) => (line.trimStart().startsWith('--') ? '' : line))
    .join('\n');

  const statements = [];
  let buf = '';
  let inDollar = false;

  for (let i = 0; i < cleaned.length; i++) {
    const ch = cleaned[i];
    const next2 = cleaned.slice(i, i + 2);

    if (next2 === '$$') {
      inDollar = !inDollar;
      buf += '$$';
      i++;
      continue;
    }

    if (ch === ';' && !inDollar) {
      const stmt = buf.trim();
      if (stmt.length > 0) statements.push(stmt);
      buf = '';
      continue;
    }

    buf += ch;
  }

  const tail = buf.trim();
  if (tail.length > 0) statements.push(tail);
  return statements;
}

async function applyPostgresFile(client, filePath) {
  const name = basename(filePath);
  let sql = readFileSync(filePath, 'utf-8');
  // Strip UTF-8 BOM
  if (sql.charCodeAt(0) === 0xfeff) sql = sql.slice(1);
  const statements = splitSql(sql);
  let ok = 0;
  let warn = 0;

  for (const stmt of statements) {
    try {
      await client.query(stmt);
      ok++;
    } catch (err) {
      const msg = err.message || String(err);
      if (
        /already exists|duplicate/i.test(msg) ||
        (err.code === '42701') // duplicate_column
      ) {
        ok++;
      } else {
        console.error(`    ❌ ${name}: ${msg.split('\n')[0]}`);
        warn++;
      }
    }
  }

  console.log(`  ✅ ${name} — stmts OK/skip: ${ok}, errores: ${warn}`);
  return warn;
}

async function migrateNeon() {
  const url = process.env.DIRECT_DATABASE_URL || process.env.DATABASE_URL;
  if (!url) {
    console.log('⏭️  Neon: sin DATABASE_URL / DIRECT_DATABASE_URL');
    return { skipped: true };
  }

  console.log(`\n🚀 Neon PostgreSQL → ${maskUrl(url)}`);
  const pool = new Pool({ connectionString: url });
  const client = await pool.connect();
  let errors = 0;

  try {
    for (const file of PG_FILES) {
      const path = resolve(root, 'prisma/migrations', file);
      if (!existsSync(path)) {
        console.log(`  ⚠️  faltante: ${file}`);
        continue;
      }
      errors += await applyPostgresFile(client, path);
    }

    const res = await client.query(
      `SELECT table_name FROM information_schema.tables
       WHERE table_schema = 'public' AND table_name = ANY($1::text[])
       ORDER BY table_name`,
      [EXPECTED_TABLES]
    );
    const present = new Set(res.rows.map((r) => r.table_name));
    console.log('\n  📋 Tablas clave:');
    for (const t of EXPECTED_TABLES) {
      console.log(`     ${present.has(t) ? '✓' : '✗'} ${t}`);
      if (!present.has(t)) errors++;
    }

    // Columna whatsapp
    const cols = await client.query(
      `SELECT column_name FROM information_schema.columns
       WHERE table_name = 'emisores'
         AND column_name IN ('whatsapp_notif_documentos','whatsapp_notif_generacion','password_certificado')`
    );
    console.log(
      `  📋 Columnas emisores: ${cols.rows.map((r) => r.column_name).join(', ') || '(ninguna)'}`
    );
  } finally {
    client.release();
    await pool.end();
  }

  return { skipped: false, errors };
}

function readMysqlConfig() {
  // Prefer explicit env; fall back to common local defaults (even if commented in .env)
  const host = process.env.DB_HOST || process.env.MYSQL_HOST || 'localhost';
  const port = parseInt(process.env.DB_PORT || process.env.MYSQL_PORT || '3306', 10);
  const database = process.env.DB_NAME || process.env.MYSQL_DATABASE || 'db_sri';
  const user = process.env.DB_USER || process.env.MYSQL_USER || 'root';
  const password = process.env.DB_PASSWORD ?? process.env.MYSQL_PASSWORD ?? '';

  // Also try parsing commented MySQL lines from .env for password if empty
  let pass = password;
  if (!process.env.DB_PASSWORD && !process.env.MYSQL_PASSWORD) {
    try {
      const envText = readFileSync(resolve(root, '.env'), 'utf-8');
      const m = envText.match(/^\s*#?\s*DB_PASSWORD=(.*)$/m);
      if (m) pass = m[1].trim().replace(/^["']|["']$/g, '');
    } catch {
      /* ignore */
    }
  }

  return { host, port, database, user, password: pass };
}

async function migrateMysql() {
  const cfg = readMysqlConfig();
  console.log(`\n🚀 MySQL → ${cfg.user}@${cfg.host}:${cfg.port}/${cfg.database}`);

  let conn;
  try {
    conn = await mysql.createConnection({
      host: cfg.host,
      port: cfg.port,
      user: cfg.user,
      password: cfg.password,
      multipleStatements: true,
    });
  } catch (err) {
    console.log(`⏭️  MySQL no disponible: ${(err.message || err).split('\n')[0]}`);
    return { skipped: true, reason: err.message };
  }

  let errors = 0;
  try {
    await conn.query(
      `CREATE DATABASE IF NOT EXISTS \`${cfg.database}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`
    );
    await conn.changeUser({ database: cfg.database });

    for (const file of MYSQL_FILES) {
      const path = resolve(root, 'prisma/migrations', file);
      if (!existsSync(path)) {
        console.log(`  ⚠️  faltante: ${file}`);
        continue;
      }
      let sql = readFileSync(path, 'utf-8');
      if (sql.charCodeAt(0) === 0xfeff) sql = sql.slice(1);
      try {
        await conn.query(sql);
        console.log(`  ✅ ${file}`);
      } catch (err) {
        const msg = err.message || String(err);
        if (/already exists|Duplicate/i.test(msg)) {
          console.log(`  ⏭️  ${file} (ya aplicado / parcial)`);
        } else {
          // Fallback: ejecutar statement a statement (útil si el dump tiene BOM/orden raro)
          const stmts = splitSql(sql);
          let fileErrs = 0;
          for (const stmt of stmts) {
            try {
              await conn.query(stmt);
            } catch (e2) {
              const m2 = e2.message || String(e2);
              if (!/already exists|Duplicate/i.test(m2)) {
                console.error(`    ❌ ${file}: ${m2.split('\n')[0]}`);
                fileErrs++;
              }
            }
          }
          if (fileErrs === 0) {
            console.log(`  ✅ ${file} (por statements)`);
          } else {
            console.error(`  ❌ ${file}: ${fileErrs} error(es) — ${msg.split('\n')[0]}`);
            errors += fileErrs;
          }
        }
      }
    }

    const [rows] = await conn.query(
      `SELECT table_name AS name FROM information_schema.tables
       WHERE table_schema = ? AND table_name IN (?)`,
      [cfg.database, EXPECTED_TABLES]
    );
    const present = new Set(rows.map((r) => r.name));
    console.log('\n  📋 Tablas clave:');
    for (const t of EXPECTED_TABLES) {
      console.log(`     ${present.has(t) ? '✓' : '✗'} ${t}`);
      if (!present.has(t)) errors++;
    }
  } finally {
    await conn.end();
  }

  return { skipped: false, errors };
}

async function main() {
  const onlyNeon = args.has('--neon') && !args.has('--mysql');
  const onlyMysql = args.has('--mysql') && !args.has('--neon');
  const doNeon = onlyNeon || !onlyMysql;
  const doMysql = onlyMysql || !onlyNeon;

  console.log('OFSERCONT — apply-all-migrations');
  console.log(`Targets: ${[doNeon && 'neon', doMysql && 'mysql'].filter(Boolean).join(' + ')}`);

  let totalErrors = 0;

  if (doNeon) {
    const r = await migrateNeon();
    if (!r.skipped) totalErrors += r.errors || 0;
  }

  if (doMysql) {
    const r = await migrateMysql();
    if (!r.skipped) totalErrors += r.errors || 0;
  }

  console.log(
    totalErrors === 0
      ? '\n✅ Migraciones aplicadas / verificadas sin errores bloqueantes'
      : `\n⚠️  Completado con ${totalErrors} incidencia(s) — revisa el log`
  );
  process.exit(totalErrors > 0 ? 1 : 0);
}

main().catch((err) => {
  console.error('❌ Fatal:', err.message);
  process.exit(1);
});
