/**
 * scripts/dev/module-smoke.mjs
 * Prueba módulos con login ADMIN + datos demo.
 * Uso: node scripts/dev/module-smoke.mjs [baseUrl]
 */
const BASE = process.argv[2] || process.env.SMOKE_BASE_URL || 'http://localhost:3000';
const EMAIL = process.env.ADMIN_EMAIL || 'admin@ofsercont.com';
const PASSWORD = process.env.ADMIN_PASSWORD || 'Ofsercont2026';

const results = [];
let token = '';
let cookie = '';

function ok(name, detail) {
  results.push({ name, pass: true, detail });
  console.log(`PASS  ${name}${detail ? ` — ${detail}` : ''}`);
}
function fail(name, detail) {
  results.push({ name, pass: false, detail });
  console.error(`FAIL  ${name} — ${detail}`);
}

async function req(path, options = {}) {
  const headers = {
    'Content-Type': 'application/json',
    ...(options.headers || {}),
  };
  if (token) headers.Authorization = `Bearer ${token}`;
  if (cookie) headers.Cookie = cookie;

  const res = await fetch(`${BASE}${path}`, {
    ...options,
    headers,
    redirect: 'manual',
  });
  const text = await res.text();
  let json = null;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    json = null;
  }
  return { res, text, json, status: res.status, headers: res.headers };
}

function pickList(json) {
  if (!json) return [];
  if (Array.isArray(json)) return json;
  if (Array.isArray(json.data)) return json.data;
  if (Array.isArray(json.rows)) return json.rows;
  if (Array.isArray(json.comprobantes)) return json.comprobantes;
  if (Array.isArray(json.asientos)) return json.asientos;
  if (Array.isArray(json.productos)) return json.productos;
  if (Array.isArray(json.empleados)) return json.empleados;
  if (Array.isArray(json.cuentas)) return json.cuentas;
  return [];
}

async function expectOk(name, path, { min = 0, method = 'GET', body } = {}) {
  const { status, json, text } = await req(path, {
    method,
    body: body ? JSON.stringify(body) : undefined,
  });
  if (status >= 200 && status < 300) {
    const list = pickList(json);
    if (min > 0 && list.length < min) {
      fail(name, `status ${status} pero lista ${list.length} < ${min}; keys=${Object.keys(json || {}).join(',')}`);
      return { status, json, list };
    }
    ok(name, `status ${status}${list.length ? ` · ${list.length} items` : ''}`);
    return { status, json, list };
  }
  fail(name, `status ${status} · ${json?.message || text.slice(0, 180)}`);
  return { status, json, list: [] };
}

async function main() {
  console.log(`Module smoke → ${BASE}`);
  console.log(`Admin: ${EMAIL}\n`);

  // Health
  {
    try {
      const { status } = await req('/login');
      if (status !== 200) {
        fail('server up', `GET /login → ${status}`);
        printSummary();
        process.exit(1);
      }
      ok('server up', 'GET /login 200');
    } catch (e) {
      fail('server up', e.message);
      printSummary();
      process.exit(1);
    }
  }

  // Login
  {
    const { status, json, headers } = await req('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email: EMAIL, password: PASSWORD }),
    });
    token = json?.accessToken || json?.token || json?.data?.accessToken || '';
    const setCookie = headers.getSetCookie?.() || [];
    cookie = setCookie.map((c) => c.split(';')[0]).join('; ');
    if (!token && json?.data?.token) token = json.data.token;

    // Some responses put token only in cookie
    if (!token && cookie.includes('sri_access_token=')) {
      const m = cookie.match(/sri_access_token=([^;]+)/);
      token = m ? decodeURIComponent(m[1]) : '';
    }

    if (status === 200 && token) {
      ok('login ADMIN', `rol=${json?.user?.rol || json?.data?.rol || '?'}`);
    } else {
      fail('login ADMIN', `status ${status} body=${JSON.stringify(json)?.slice(0, 200)}`);
      printSummary();
      process.exit(1);
    }
  }

  // Auth-gated modules
  await expectOk('GET /api/contactos', '/api/contactos', { min: 1 });
  await expectOk('GET /api/ecommerce/productos', '/api/ecommerce/productos', { min: 1 });
  await expectOk('GET /api/nomina/empleados', '/api/nomina/empleados', { min: 1 });
  await expectOk('GET /api/cuentas-por-cobrar', '/api/cuentas-por-cobrar', { min: 1 });
  await expectOk('GET /api/cuentas-por-pagar', '/api/cuentas-por-pagar', { min: 1 });
  await expectOk('GET /api/cuentas-por-cobrar/aging', '/api/cuentas-por-cobrar/aging');
  await expectOk('GET /api/cuentas-por-pagar/aging', '/api/cuentas-por-pagar/aging');
  await expectOk('GET /api/contabilidad/asientos', '/api/contabilidad/asientos', { min: 1 });
  await expectOk('GET /api/contabilidad/balance', '/api/contabilidad/balance');
  await expectOk('GET /api/sri/comprobantes (or list)', '/api/sri/comprobantes?limit=20');

  // Fallbacks if comprobantes path differs
  if (results.at(-1)?.pass === false) {
    await expectOk('GET /api/comprobantes', '/api/comprobantes?limit=20');
  }

  await expectOk('GET /api/transportistas', '/api/transportistas');
  await expectOk('GET /api/control-tributario/obligaciones', '/api/control-tributario/obligaciones');
  await expectOk('GET /api/declaraciones/ats', '/api/declaraciones/ats');
  await expectOk('GET /api/sri/emisor', '/api/sri/emisor');

  // Inventario movimientos for first product
  {
    const prod = await req('/api/ecommerce/productos');
    const list = pickList(prod.json);
    const first = list[0];
    const id = first?.id || first?.producto_id;
    if (id) {
      await expectOk(
        'GET /api/inventario/movimientos',
        `/api/inventario/movimientos?productoId=${id}`
      );
    } else {
      fail('GET /api/inventario/movimientos', 'sin producto demo para kardex');
    }
  }

  // Write paths (safe demo mutations)
  {
    const { status, json } = await req('/api/contactos', {
      method: 'POST',
      body: JSON.stringify({
        tipoIdentificacion: '05',
        identificacion: String(Math.floor(1000000000 + Math.random() * 8999999999)).slice(0, 10),
        razonSocial: 'Contacto Smoke Test',
        esCliente: true,
        esProveedor: false,
      }),
    });
    if (status === 200 || status === 201) ok('POST /api/contactos', json?.data?.id || 'created');
    else if (status === 409) ok('POST /api/contactos', '409 conflict (ok)');
    else fail('POST /api/contactos', `status ${status} ${json?.message || ''}`);
  }

  {
    const { status, json } = await req('/api/contabilidad/asientos', {
      method: 'POST',
      body: JSON.stringify({
        fecha: new Date().toISOString().slice(0, 10),
        glosa: '[SMOKE] Asiento prueba',
        lineas: [
          { cuentaCodigo: '1.1.01.01', cuentaNombre: 'Caja', debe: 10, haber: 0 },
          { cuentaCodigo: '4.1.01.01', cuentaNombre: 'Ventas', debe: 0, haber: 10 },
        ],
      }),
    });
    if (status === 200 || status === 201) ok('POST /api/contabilidad/asientos', json?.data?.id || 'created');
    else fail('POST /api/contabilidad/asientos', `status ${status} ${json?.message || JSON.stringify(json)?.slice(0, 150)}`);
  }

  // Chat guardrail (mutating tool should ask confirm — soft check)
  {
    const { status, json } = await req('/api/chat', {
      method: 'POST',
      body: JSON.stringify({
        message: 'Crea un producto llamado SmokeChat con precio 1',
        history: [],
      }),
    });
    if (status === 200) ok('POST /api/chat', (json?.text || json?.html || '').slice(0, 80).replace(/\s+/g, ' '));
    else if (status === 503) ok('POST /api/chat', '503 LLM no configurado (aceptable)');
    else fail('POST /api/chat', `status ${status} ${json?.message || ''}`);
  }

  // Unauthenticated should fail
  {
    const prev = token;
    token = '';
    cookie = '';
    const { status } = await req('/api/contactos');
    token = prev;
    if (status === 401) ok('auth gate /api/contactos', '401 sin token');
    else fail('auth gate /api/contactos', `status ${status}`);
  }

  // Pages HTML (app shell)
  for (const page of [
    '/documentos',
    '/contactos',
    '/cuentas-por-cobrar',
    '/cuentas-por-pagar',
    '/contabilidad/diario',
    '/contabilidad/balance',
    '/inventario',
    '/nomina/empleados',
    '/control-tributario',
    '/declaraciones/ats',
    '/pos',
  ]) {
    const { status } = await req(page);
    // With cookie/token, proxy may allow; without may redirect
    if (status === 200 || status === 307 || status === 302) {
      ok(`PAGE ${page}`, `status ${status}`);
    } else {
      fail(`PAGE ${page}`, `status ${status}`);
    }
  }

  printSummary();
  process.exit(results.some((r) => !r.pass) ? 1 : 0);
}

function printSummary() {
  const passed = results.filter((r) => r.pass).length;
  const failed = results.filter((r) => !r.pass).length;
  console.log(`\n${passed}/${results.length} passed${failed ? ` · ${failed} failed` : ''}`);
  if (failed) {
    console.log('\nFallos:');
    for (const r of results.filter((x) => !x.pass)) {
      console.log(`  - ${r.name}: ${r.detail}`);
    }
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
