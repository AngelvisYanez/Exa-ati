/**
 * Elimina SUPERADMIN temporales smoke.billing.*@test.local
 */
import { config } from "dotenv";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";
import { Pool, neonConfig } from "@neondatabase/serverless";
import ws from "ws";

const __dirname = dirname(fileURLToPath(import.meta.url));
config({ path: resolve(__dirname, "../../.env") });
neonConfig.webSocketConstructor = ws;

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const c = await pool.connect();
try {
  const listed = await c.query(
    `SELECT id, email, rol FROM usuarios WHERE email LIKE 'smoke.billing.%@test.local'`
  );
  console.log("encontrados:", listed.rows);
  const del = await c.query(
    `DELETE FROM usuarios WHERE email LIKE 'smoke.billing.%@test.local' RETURNING email`
  );
  console.log("eliminados:", del.rows.map((r) => r.email));
} finally {
  c.release();
  await pool.end();
}
