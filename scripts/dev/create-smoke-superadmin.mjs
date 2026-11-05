/**
 * Crea SUPERADMIN temporal para smoke y imprime email.
 * Uso: node scripts/dev/create-smoke-superadmin.mjs
 */
import { config } from "dotenv";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";
import bcrypt from "bcryptjs";
import { Pool, neonConfig } from "@neondatabase/serverless";
import ws from "ws";

const __dirname = dirname(fileURLToPath(import.meta.url));
config({ path: resolve(__dirname, "../../.env") });
neonConfig.webSocketConstructor = ws;

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const c = await pool.connect();
try {
  const email = `smoke.billing.${Date.now()}@test.local`;
  const password = "SmokeBilling123!";
  const hash = await bcrypt.hash(password, 12);
  const tenant = await c.query("SELECT id FROM tenants LIMIT 1");
  const tid = tenant.rows[0]?.id || null;
  await c.query(
    `INSERT INTO usuarios (id, email, password_hash, nombre, rol, tenant_id, activo, created_at, updated_at)
     VALUES (gen_random_uuid(), $1, $2, 'Smoke Billing SA', 'SUPERADMIN', $3, true, NOW(), NOW())`,
    [email, hash, tid]
  );
  console.log(JSON.stringify({ email, password, tenantId: tid }));
} finally {
  c.release();
  await pool.end();
}
