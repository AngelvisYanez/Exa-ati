import "dotenv/config";
import pg from "pg";

const c = new pg.Client({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});
await c.connect();
const r = await c.query(
  `SELECT email, nombre, rol, activo
   FROM usuarios
   WHERE rol IN ('ADMIN', 'SUPERADMIN')
   ORDER BY rol, email`
);
console.log("Admins:", JSON.stringify(r.rows, null, 2));
const all = await c.query(
  `SELECT rol, COUNT(*)::int AS n FROM usuarios GROUP BY rol ORDER BY rol`
);
console.log("Por rol:", JSON.stringify(all.rows, null, 2));
await c.end();
