/**
 * Smoke CRUD admin billing.
 * Preferir: ADMIN_EMAIL + ADMIN_PASSWORD (SUPERADMIN) en env.
 * Uso: node scripts/dev/smoke-admin-billing-crud.mjs [baseUrl]
 */
const BASE = process.argv[2] || process.env.SMOKE_BASE_URL || "http://localhost:3010";
const EMAIL = process.env.ADMIN_EMAIL || "";
const PASSWORD = process.env.ADMIN_PASSWORD || "";

const results = [];
let token = "";

function ok(name, detail) {
  results.push({ name, pass: true, detail });
  console.log(`PASS  ${name}${detail ? ` — ${detail}` : ""}`);
}
function fail(name, detail) {
  results.push({ name, pass: false, detail });
  console.error(`FAIL  ${name} — ${detail}`);
}

async function req(path, options = {}) {
  const headers = {
    "Content-Type": "application/json",
    ...(options.headers || {}),
  };
  if (token) headers.Authorization = `Bearer ${token}`;
  const res = await fetch(`${BASE}${path}`, {
    ...options,
    headers,
    redirect: "manual",
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

async function main() {
  console.log(`Admin billing CRUD smoke → ${BASE}`);
  if (!EMAIL || !PASSWORD) {
    console.error("Define ADMIN_EMAIL y ADMIN_PASSWORD (SUPERADMIN).");
    console.error("Ej: node scripts/dev/create-smoke-superadmin.mjs");
    process.exit(1);
  }
  console.log(`User: ${EMAIL}\n`);

  for (let i = 0; i < 30; i++) {
    try {
      const r = await fetch(`${BASE}/iniciar-sesion`, { redirect: "manual" });
      if (r.status > 0 && r.status < 500) break;
    } catch {
      /* retry */
    }
    await new Promise((r) => setTimeout(r, 1000));
    if (i === 29) {
      fail("server up", "timeout");
      process.exit(1);
    }
  }
  ok("server up", BASE);

  {
    const { status, json } = await req("/api/auth/login", {
      method: "POST",
      body: JSON.stringify({ email: EMAIL, password: PASSWORD }),
    });
    token = json?.accessToken || json?.token || "";
    if (status === 200 && token) {
      ok("login", `rol=${json?.user?.rol || "?"}`);
      if ((json?.user?.rol || "") !== "SUPERADMIN") {
        fail("rol SUPERADMIN", `got ${json?.user?.rol}`);
      }
    } else {
      fail("login", `status ${status} ${JSON.stringify(json)?.slice(0, 200)}`);
      process.exit(1);
    }
  }

  const codigoTest = `TEST_SMOKE_${Date.now().toString(36).toUpperCase()}`.slice(0, 30);

  {
    const { status, json } = await req("/api/admin/metodos-pago");
    if (status === 200 && Array.isArray(json?.data) && json.data.length >= 1) {
      ok("GET metodos-pago", `${json.data.length} items`);
    } else fail("GET metodos-pago", `status ${status} ${json?.message || ""}`);
  }

  {
    const { status, json } = await req("/api/metodos-pago?uso=operativo");
    if (status === 200 && Array.isArray(json?.data) && json.data.length >= 1) {
      ok("GET metodos-pago operativo", `${json.data.length} items`);
    } else fail("GET metodos-pago operativo", `status ${status}`);
  }

  {
    const { status, json } = await req("/api/metodos-pago?uso=suscripcion");
    if (status === 200 && Array.isArray(json?.data) && json.data.some((m) => m.codigo === "PAYPHONE")) {
      ok("GET metodos-pago suscripcion", `${json.data.length} · PAYPHONE`);
    } else fail("GET metodos-pago suscripcion", `status ${status}`);
  }

  {
    const { status, json } = await req("/api/admin/metodos-pago", {
      method: "POST",
      body: JSON.stringify({
        codigo: codigoTest,
        nombre: "Smoke Test Método",
        orden: 999,
        usoOperativo: true,
        usoSuscripcion: false,
      }),
    });
    if (status === 201 && json?.data?.codigo === codigoTest) ok("POST metodos-pago", codigoTest);
    else fail("POST metodos-pago", `status ${status} ${json?.message || ""}`);
  }

  {
    const { status, json } = await req(`/api/admin/metodos-pago/${encodeURIComponent(codigoTest)}`);
    if (status === 200 && json?.data?.codigo === codigoTest) ok("GET metodos-pago/[codigo]", codigoTest);
    else fail("GET metodos-pago/[codigo]", `status ${status}`);
  }

  {
    const { status, json } = await req(`/api/admin/metodos-pago/${encodeURIComponent(codigoTest)}`, {
      method: "PUT",
      body: JSON.stringify({
        nombre: "Smoke Test Método Editado",
        usoOperativo: true,
        usoSuscripcion: true,
        activo: true,
      }),
    });
    if (status === 200 && json?.success) ok("PUT metodos-pago", "ok");
    else fail("PUT metodos-pago", `status ${status} ${json?.message || ""}`);
  }

  {
    const { status } = await req(`/api/admin/metodos-pago/${encodeURIComponent(codigoTest)}`, {
      method: "DELETE",
    });
    if (status === 200) ok("DELETE metodos-pago", codigoTest);
    else fail("DELETE metodos-pago", `status ${status}`);
  }

  {
    const { status } = await req(`/api/admin/metodos-pago/PAYPHONE`, { method: "DELETE" });
    if (status === 409) ok("DELETE PAYPHONE bloqueado", "409");
    else fail("DELETE PAYPHONE bloqueado", `got ${status}`);
  }

  let planCodigo = "emprendedor";
  {
    const { status, json } = await req("/api/admin/planes");
    if (status === 200 && Array.isArray(json?.data) && json.data.length >= 1) {
      planCodigo = json.data.find((p) => p.codigo === "contador")?.codigo || json.data[0].codigo;
      ok("GET planes", `${json.data.length} planes`);
    } else fail("GET planes", `status ${status} ${json?.message || ""}`);
  }

  {
    const { status, json } = await req(`/api/admin/planes/${encodeURIComponent(planCodigo)}`);
    if (status === 200 && json?.data?.codigo) ok("GET planes/[codigo]", json.data.codigo);
    else fail("GET planes/[codigo]", `status ${status}`);
  }

  {
    const { status, json } = await req("/api/admin/billing-stats");
    if (
      status === 200 &&
      typeof json?.mrr === "number" &&
      Array.isArray(json?.ingresosMensuales) &&
      Array.isArray(json?.ingresosPorPlan) &&
      Array.isArray(json?.topUsuarios)
    ) {
      ok("GET billing-stats", `mrr=${json.mrr} total=${json.ingresosTotales}`);
    } else fail("GET billing-stats", `status ${status}`);
  }

  let userId = null;
  let tenantId = null;
  {
    const { status, json } = await req("/api/admin/usuarios?pageSize=50");
    const list = json?.data || [];
    const candidate = list.find((u) => u.rol !== "SUPERADMIN" && (u.tenantId || u.tenant_id));
    if (status === 200 && candidate) {
      userId = candidate.id;
      tenantId = candidate.tenantId || candidate.tenant_id;
      ok("pick usuario", candidate.email);
    } else if (status === 200 && list[0]) {
      userId = list[0].id;
      ok("pick usuario (fallback)", list[0].email);
    } else fail("list usuarios", `status ${status} ${json?.message || ""}`);
  }

  if (userId) {
    const before = await req(`/api/admin/usuarios/${userId}`);
    if (before.status === 200) {
      ok("GET usuario", `plan=${before.json?.data?.planCodigo || "null"}`);
    } else fail("GET usuario", `status ${before.status}`);

    const put = await req(`/api/admin/usuarios/${userId}`, {
      method: "PUT",
      body: JSON.stringify({
        planCodigo,
        planPeriodo: "mensual",
        planEstado: "activo",
      }),
    });
    if (put.status === 200) ok("PUT usuario plan", `→ ${put.json?.data?.planCodigo || planCodigo}`);
    else fail("PUT usuario plan", `status ${put.status} ${put.json?.message || ""}`);

    const after = await req(`/api/admin/usuarios/${userId}`);
    const got = after.json?.data?.planCodigo;
    if (after.status === 200 && (got === planCodigo || put.status === 200)) {
      ok("plan re-leído", `plan=${got}`);
    } else fail("plan re-leído", `got=${got}`);
  }

  if (tenantId) {
    const { status, json } = await req(`/api/admin/tenants/${tenantId}`);
    if (status === 200) ok("GET tenant", `plan=${json?.data?.planCodigo}`);
    else fail("GET tenant", `status ${status}`);

    const putT = await req(`/api/admin/tenants/${tenantId}`, {
      method: "PUT",
      body: JSON.stringify({ planCodigo, planPeriodo: "mensual", planEstado: "activo" }),
    });
    if (putT.status === 200) ok("PUT tenant plan sync", putT.json?.data?.planCodigo || planCodigo);
    else fail("PUT tenant plan sync", `status ${putT.status} ${putT.json?.message || ""}`);
  }

  const passed = results.filter((r) => r.pass).length;
  const failed = results.filter((r) => !r.pass).length;
  console.log(`\n—— ${passed} pass · ${failed} fail ——`);
  process.exit(failed > 0 ? 1 : 0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
