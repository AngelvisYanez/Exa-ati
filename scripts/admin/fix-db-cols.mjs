// Run: node scripts/fix-db-cols.mjs
import { readFileSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';
import { createRequire } from 'module';

const __dirname = dirname(fileURLToPath(import.meta.url));
const require = createRequire(import.meta.url);

// Must use DATABASE_URL that the server is already successfully using
const envPath = join(__dirname, '..', '.env');
const envRaw = readFileSync(envPath, 'utf-8');
const env = {};
for (const line of envRaw.split('\n')) {
  const t = line.trim();
  if (!t || t.startsWith('#')) continue;
  const i = t.indexOf('=');
  if (i === -1) continue;
  env[t.slice(0, i).trim()] = t.slice(i + 1).trim();
}

const { Pool } = require('pg');
const pool = new Pool({
  connectionString: env.DATABASE_URL,
  connectionTimeoutMillis: 15000,
});

async function main() {
  try {
    // Check what columns exist
    const cols = await pool.query(
      `SELECT column_name FROM information_schema.columns 
       WHERE table_name = 'emisores' ORDER BY ordinal_position`
    );
    const existing = cols.rows.map(r => r.column_name);
    console.log('Existing columns:', existing.join(', '));

    const needed = [
      { name: 'establecimiento', def: 'VARCHAR(3) DEFAULT \'001\'' },
      { name: 'punto_emision', def: 'VARCHAR(3) DEFAULT \'001\'' },
      { name: 'dir_matriz', def: 'VARCHAR(500)' },
    ];

    for (const col of needed) {
      if (!existing.includes(col.name)) {
        console.log(`Adding column: ${col.name} ${col.def}`);
        await pool.query(`ALTER TABLE emisores ADD COLUMN IF NOT EXISTS ${col.name} ${col.def}`);
      } else {
        console.log(`Column already exists: ${col.name}`);
      }
    }

    // Also check comprobantes table
    const compCols = await pool.query(
      `SELECT column_name FROM information_schema.columns 
       WHERE table_name = 'comprobantes' ORDER BY ordinal_position`
    );
    const compExisting = compCols.rows.map(r => r.column_name);
    console.log('\nComprobantes columns:', compExisting.join(', '));

    const compNeeded = [
      { name: 'tipo_emision', def: 'VARCHAR(2) DEFAULT \'1\'' },
    ];

    for (const col of compNeeded) {
      if (!compExisting.includes(col.name)) {
        console.log(`Adding column: comprobantes.${col.name} ${col.def}`);
        await pool.query(`ALTER TABLE comprobantes ADD COLUMN IF NOT EXISTS ${col.name} ${col.def}`);
      }
    }

    console.log('\nDone!');
  } catch (e) {
    console.error('Error:', e.message);
  } finally {
    await pool.end();
  }
}

main();
