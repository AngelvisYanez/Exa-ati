/**
 * Apply 004_roles_modulos.sql and verify seed + RBAC API flows.
 * Usage: node scripts/dev/verify-roles-rbac.mjs [baseUrl]
 */
import "dotenv/config";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import pg from "pg";

const { Client } = pg;
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, "../..");

const BASE = process.argv[2] || process.env.SMOKE_BASE_URL || "http://localhost:3000";
const results = [];

function ok(name, detail) {
  results.push({ name, pass: true, detail });
  console.log(`PASS  ${name}${detail ? ` — ${detail}` : ""}`);
}
function fail(name, detail) {
  results.push({ name, pass: false, detail });
  console.error(`FAIL  ${name} — ${detail}`);
}

async function req(pathname, options = {}) {
  const res = await fetch(`${BASE}${pathname}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(options.headers || {}),
    },
  });
  const text = await res.text();
  let json = null;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    json = null;
  }
  return { status: res.status, json, text };
}

async function applyMigration() {
  const c = new Client({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false },
  });
  await c.connect();
  const sql = fs.readFileSync(
    path.join(ROOT, "prisma/migrations/004_roles_modulos.sql"),
    "utf8"
  );
  await c.query(sql);

  const roles = await c.query(
    "SELECT codigo, nombre, es_sistema FROM roles ORDER BY codigo"
  );
  const mods = await c.query("SELECT COUNT(*)::int AS n FROM modulos");
  const rm = await c.query(
    "SELECT rol_codigo, COUNT(*)::int AS n FROM rol_modulos GROUP BY rol_codigo ORDER BY rol_codigo"
  );

  if (roles.rows.length >= 3) {
    ok("DB roles seed", roles.rows.map((r) => r.codigo).join(", "));
  } else {
    fail("DB roles seed", JSON.stringify(roles.rows));
  }

  if (mods.rows[0].n >= 20) {
    ok("DB modulos seed", `${mods.rows[0].n} módulos`);
  } else {
    fail("DB modulos seed", `${mods.rows[0].n}`);
  }

  const byRol = Object.fromEntries(rm.rows.map((r) => [r.rol_codigo, r.n]));
  if (byRol.SUPERADMIN >= 20 && byRol.ADMIN >= 15 && byRol.USER >= 5) {
    ok(
      "DB rol_modulos seed",
      `USER=${byRol.USER} ADMIN=${byRol.ADMIN} SUPERADMIN=${byRol.SUPERADMIN}`
    );
  } else {
    fail("DB rol_modulos seed", JSON.stringify(byRol));
  }

  await c.end();
}

async function apiTests() {
  try {
    const health = await req("/login");
    if (health.status === 200) ok("Server /login", `status ${health.status}`);
    else fail("Server /login", `status ${health.status}`);
  } catch (e) {
    fail("Server /login", e.message);
    return;
  }

  const smokeEmail = `smoke.rbac.${Date.now()}@test.local`;
  const smokePass = "SmokeRbac123!";
  const bcrypt = (await import("bcryptjs")).default;
  const hash = await bcrypt.hash(smokePass, 12);
  const c = new Client({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false },
  });
  await c.connect();
  await c.query(
    `INSERT INTO usuarios (id, email, password_hash, nombre, rol, activo, created_at, updated_at)
     VALUES (gen_random_uuid(), $1, $2, 'Smoke RBAC', 'SUPERADMIN', true, NOW(), NOW())`,
    [smokeEmail, hash]
  );
  ok("Smoke SUPERADMIN creado", smokeEmail);

  const login = await req("/api/auth/login", {
    method: "POST",
    body: JSON.stringify({ email: smokeEmail, password: smokePass }),
  });

  if (login.status !== 200 || !login.json?.accessToken) {
    fail("Login admin", `status ${login.status} ${login.json?.message || ""}`);
    await c.query(`DELETE FROM usuarios WHERE email LIKE 'smoke.%@test.local'`);
    await c.end();
    return;
  }
  ok("Login admin", `${smokeEmail} rol=${login.json.user?.rol}`);

  const token = login.json.accessToken;
  const auth = { Authorization: `Bearer ${token}` };
  const userModulos = login.json.user?.modulos;

  if (Array.isArray(userModulos) && userModulos.length > 0) {
    ok("Login returns modulos", `${userModulos.length} módulos`);
  } else {
    fail("Login returns modulos", JSON.stringify(userModulos));
  }

  const me = await req("/api/auth/me", { headers: auth });
  if (me.status === 200 && Array.isArray(me.json?.user?.modulos)) {
    ok("GET /api/auth/me", `${me.json.user.modulos.length} módulos`);
  } else {
    fail("GET /api/auth/me", `status ${me.status}`);
  }

  const roles = await req("/api/admin/roles", { headers: auth });
  if (roles.status === 200 && Array.isArray(roles.json?.data) && roles.json.data.length >= 3) {
    ok("GET /api/admin/roles", `${roles.json.data.length} roles`);
  } else {
    fail(
      "GET /api/admin/roles",
      `status ${roles.status} body=${JSON.stringify(roles.json)?.slice(0, 200)}`
    );
  }

  const modulos = await req("/api/admin/modulos", { headers: auth });
  if (modulos.status === 200 && modulos.json?.data?.length >= 20) {
    ok("GET /api/admin/modulos", `${modulos.json.data.length} módulos`);
  } else {
    fail("GET /api/admin/modulos", `status ${modulos.status}`);
  }

  const code = `TEST_${Date.now().toString(36).toUpperCase().slice(-6)}`;
  const create = await req("/api/admin/roles", {
    method: "POST",
    headers: auth,
    body: JSON.stringify({
      codigo: code,
      nombre: "Rol de prueba",
      descripcion: "Creado por verify-roles-rbac",
    }),
  });
  if (create.status === 201 && create.json?.data?.codigo === code) {
    ok("POST /api/admin/roles", code);
  } else {
    fail("POST /api/admin/roles", `status ${create.status} ${JSON.stringify(create.json)}`);
  }

  const assign = await req(`/api/admin/roles/${code}/modulos`, {
    method: "PUT",
    headers: auth,
    body: JSON.stringify({
      modulos: ["dashboard", "documentos", "chat", "configuracion"],
    }),
  });
  if (assign.status === 200 && assign.json?.data?.modulos?.length === 4) {
    ok("PUT roles/.../modulos", assign.json.data.modulos.join(","));
  } else {
    fail("PUT roles/.../modulos", `status ${assign.status} ${JSON.stringify(assign.json)}`);
  }

  const detail = await req(`/api/admin/roles/${code}`, { headers: auth });
  if (detail.status === 200 && detail.json?.data?.modulos?.includes("chat")) {
    ok("GET /api/admin/roles/[codigo]", `módulos=${detail.json.data.modulos.length}`);
  } else {
    fail("GET /api/admin/roles/[codigo]", `status ${detail.status}`);
  }

  const delSys = await req("/api/admin/roles/USER", {
    method: "DELETE",
    headers: auth,
  });
  if (delSys.status === 400 || delSys.status === 403) {
    ok("DELETE system role blocked", `status ${delSys.status}`);
  } else {
    fail("DELETE system role blocked", `status ${delSys.status}`);
  }

  const del = await req(`/api/admin/roles/${code}`, {
    method: "DELETE",
    headers: auth,
  });
  if (del.status === 200) {
    ok("DELETE custom role", code);
  } else {
    fail("DELETE custom role", `status ${del.status} ${JSON.stringify(del.json)}`);
  }

  const unauth = await req("/api/admin/roles");
  if (unauth.status === 401) {
    ok("GET /api/admin/roles sin token → 401", "");
  } else {
    fail("GET /api/admin/roles sin token → 401", `status ${unauth.status}`);
  }

  const userEmail = `smoke.user.${Date.now()}@test.local`;
  const userHash = await bcrypt.hash(smokePass, 12);
  await c.query(
    `INSERT INTO usuarios (id, email, password_hash, nombre, rol, activo, created_at, updated_at)
     VALUES (gen_random_uuid(), $1, $2, 'Smoke USER', 'USER', true, NOW(), NOW())`,
    [userEmail, userHash]
  );
  const uLogin = await req("/api/auth/login", {
    method: "POST",
    body: JSON.stringify({ email: userEmail, password: smokePass }),
  });
  if (uLogin.status === 200) {
    const emitir = await req("/api/sri/emitir", {
      method: "POST",
      headers: { Authorization: `Bearer ${uLogin.json.accessToken}` },
      body: JSON.stringify({ tipo: "01", emisorRuc: "0000000000001", datos: {} }),
    });
    if (emitir.status === 403) {
      ok("USER emitir → 403 sin módulo", emitir.json?.message || "");
    } else {
      fail(
        "USER emitir → 403 sin módulo",
        `status ${emitir.status} ${JSON.stringify(emitir.json)?.slice(0, 150)}`
      );
    }
  } else {
    fail("USER login for module test", `status ${uLogin.status}`);
  }

  await c.query(`DELETE FROM usuarios WHERE email LIKE 'smoke.%@test.local'`);
  await c.end();
  ok("Cleanup smoke users", "ok");
}

async function main() {
  console.log("=== Verify roles RBAC ===\n");
  console.log(`Base URL: ${BASE}\n`);

  console.log("--- Migración DB ---");
  await applyMigration();

  console.log("\n--- APIs ---");
  await apiTests();

  const failed = results.filter((r) => !r.pass);
  console.log(`\n${results.length - failed.length}/${results.length} passed`);
  if (failed.length) {
    console.error("Failed:", failed.map((f) => f.name).join(", "));
    process.exit(1);
  }
  console.log("All checks passed.");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
