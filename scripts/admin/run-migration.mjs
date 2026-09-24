import { Pool, neonConfig } from '@neondatabase/serverless';
import { config } from 'dotenv';
import ws from 'ws';
import { readFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
config({ path: resolve(__dirname, '../..', '.env') });
neonConfig.webSocketConstructor = ws;

const DATABASE_URL = process.env.DIRECT_DATABASE_URL ?? process.env.DATABASE_URL;
if (!DATABASE_URL) { console.error('❌ DATABASE_URL no definido'); process.exit(1); }

const pool = new Pool({ connectionString: DATABASE_URL });
const sqlPath = resolve(__dirname, '../..', 'prisma', 'migrations', process.argv[2] || '001_init_postgres.sql');
const sql = readFileSync(sqlPath, 'utf-8');

const masked = DATABASE_URL.replace(/:([^@]+)@/, ':****@');
console.log(`Migrando ${masked} con ${sqlPath.split(/[/\\]/).pop()}...`);

const noComments = sql.replace(/^--.*$/gm, '').trim();
const statements = noComments.split(';').map(s => s.trim()).filter(s => s.length > 0);

const client = await pool.connect();
let ok = 0, errs = 0;
for (const stmt of statements) {
  try {
    await client.query(stmt + ';');
    ok++;
  } catch (e) {
    if (e.message?.includes('already exists')) { ok++; }
    else { console.error(`  ❌ ${e.message?.split('\n')[0]}`); errs++; }
  }
}
console.log(`✅ OK: ${ok}, Errores: ${errs}`);
client.release();
await pool.end();
