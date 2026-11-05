/**
 * Reset ADMIN password on Neon and print tenant info (no password in output beyond confirmation).
 */
import { config } from 'dotenv';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import bcrypt from 'bcryptjs';
import { Pool, neonConfig } from '@neondatabase/serverless';
import ws from 'ws';

const __dirname = dirname(fileURLToPath(import.meta.url));
config({ path: resolve(__dirname, '../../.env') });
neonConfig.webSocketConstructor = ws;

const EMAIL = process.env.ADMIN_EMAIL || 'admin@ofsercont.com';
const PASSWORD = process.env.ADMIN_PASSWORD || 'Ofsercont2026';

const pool = new Pool({
  connectionString: process.env.DIRECT_DATABASE_URL || process.env.DATABASE_URL,
});

const client = await pool.connect();
try {
  const hash = await bcrypt.hash(PASSWORD, 12);
  const res = await client.query(
    `UPDATE usuarios
     SET password_hash = $1, rol = 'ADMIN', activo = true, updated_at = NOW()
     WHERE LOWER(email) = LOWER($2)
     RETURNING id, email, rol, tenant_id, activo`,
    [hash, EMAIL]
  );
  if (!res.rows[0]) {
    // create tenant + admin
    const tid = (await client.query(
      `INSERT INTO tenants (id, nombre, activo, created_at, updated_at)
       VALUES (gen_random_uuid(), 'Admin OFSERCONT', true, NOW(), NOW())
       RETURNING id`
    )).rows[0].id;
    const u = await client.query(
      `INSERT INTO usuarios (id, email, password_hash, nombre, rol, tenant_id, activo, created_at, updated_at)
       VALUES (gen_random_uuid(), $1, $2, 'Administrador OFSERCONT', 'ADMIN', $3, true, NOW(), NOW())
       RETURNING id, email, rol, tenant_id, activo`,
      [EMAIL, hash, tid]
    );
    console.log('CREATED', u.rows[0]);
  } else {
    console.log('UPDATED', res.rows[0]);
  }
  console.log('PASSWORD_SET=yes');
} finally {
  client.release();
  await pool.end();
}
