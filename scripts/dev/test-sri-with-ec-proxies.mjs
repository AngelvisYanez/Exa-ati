/**
 * 1) Reactiva proxies EC, prueba CONNECT al SRI y verifica IP de salida.
 * 2) Encola scrapers SRI (sin IESS) uno a uno con proxy obligatorio.
 * Uso: node scripts/dev/test-sri-with-ec-proxies.mjs [baseUrl]
 */
import 'dotenv/config';
import { ProxyAgent, fetch as undiciFetch } from 'undici';

const BASE = process.argv[2] || process.env.SMOKE_BASE_URL || 'http://localhost:3000';
const EMAIL = process.env.ADMIN_EMAIL || 'admin@ofsercont.com';
const PASSWORD = process.env.ADMIN_PASSWORD || 'Ofsercont2026';

const ACTIONS = [
  { action_type: 'SCRAPE_DECLARACIONES', label: 'Declaraciones' },
  { action_type: 'SCRAPE_OBLIGACIONES', label: 'Obligaciones' },
  { action_type: 'SCRAPE_RETENCIONES', label: 'Retenciones' },
  { action_type: 'SCRAPE_ATS', label: 'ATS' },
  { action_type: 'DOWNLOAD_RECEIVED', label: 'Comprobantes recibidos' },
];

async function req(path, options = {}, token = '') {
  const headers = { 'Content-Type': 'application/json', ...(options.headers || {}) };
  if (token) headers.Authorization = `Bearer ${token}`;
  const res = await fetch(`${BASE}${path}`, { ...options, headers });
  const text = await res.text();
  let json = null;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    json = null;
  }
  return { status: res.status, json, text };
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

async function egressViaProxy(host, port, user, pass) {
  const auth =
    user && pass ? `${encodeURIComponent(user)}:${encodeURIComponent(pass)}@` : '';
  const proxyUrl = `http://${auth}${host}:${port}`;
  const agent = new ProxyAgent(proxyUrl);
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 20000);
  try {
    const ipRes = await undiciFetch('https://api.ipify.org?format=json', {
      dispatcher: agent,
      signal: ctrl.signal,
    });
    const ipJson = await ipRes.json();
    const ip = ipJson?.ip;
    if (!ip) return { ok: false, error: 'sin IP' };

    let geo = null;
    try {
      const gRes = await undiciFetch(`http://ip-api.com/json/${ip}?fields=status,country,countryCode,query,city`, {
        signal: AbortSignal.timeout(10000),
      });
      geo = await gRes.json();
    } catch {
      geo = null;
    }

    return {
      ok: true,
      ip,
      country: geo?.countryCode || geo?.country || '?',
      city: geo?.city || '',
      isEC: String(geo?.countryCode || '').toUpperCase() === 'EC',
    };
  } catch (e) {
    return { ok: false, error: e.message || String(e) };
  } finally {
    clearTimeout(timer);
    try {
      await agent.close();
    } catch {}
  }
}

async function main() {
  console.log(`\n=== Proxies EC + scrapers SRI → ${BASE} ===\n`);

  const login = await req('/api/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email: EMAIL, password: PASSWORD }),
  });
  const token = login.json?.token || login.json?.accessToken;
  if (login.status !== 200 || !token) {
    console.error('Login falló:', login.status, login.json?.message || login.text.slice(0, 200));
    process.exit(1);
  }
  console.log('Login OK');

  await req('/api/admin/proxies', { method: 'POST', body: JSON.stringify({ action: 'releaseAll' }) }, token);

  const list = await req('/api/admin/proxies', {}, token);
  const proxies = list.json?.proxies || [];
  console.log(`Pool: ${proxies.length} proxies`);

  for (const p of proxies) {
    if (!p.activo) {
      await req(
        '/api/admin/proxies',
        { method: 'POST', body: JSON.stringify({ action: 'toggle', proxy_id: p.id, activo: true }) },
        token
      );
    }
  }

  console.log('\n--- Prueba CONNECT (testAll) ---');
  const testAll = await req(
    '/api/admin/proxies',
    { method: 'POST', body: JSON.stringify({ action: 'testAll' }) },
    token
  );
  const results = testAll.json?.results || [];
  console.log('CONNECT stats:', testAll.json?.stats);

  const byId = Object.fromEntries(proxies.map((p) => [p.id, p]));
  const functional = [];

  console.log('\n--- Verificación IP de salida ---');
  for (const r of results) {
    const p = byId[r.proxyId];
    if (!p) continue;
    const label = `${p.proxy_host}:${p.proxy_port}`;
    if (!r.alive) {
      console.log(`✗ #${r.proxyId} ${label} CONNECT muerto (${r.error || 'timeout'})`);
      await req(
        '/api/admin/proxies',
        { method: 'POST', body: JSON.stringify({ action: 'toggle', proxy_id: p.id, activo: false }) },
        token
      );
      continue;
    }

    const egress = await egressViaProxy(p.proxy_host, p.proxy_port, p.proxy_user, p.proxy_pass);
    if (!egress.ok) {
      console.log(`✗ #${r.proxyId} ${label} CONNECT ok (${r.latency}ms) pero egress falló: ${egress.error}`);
      await req(
        '/api/admin/proxies',
        { method: 'POST', body: JSON.stringify({ action: 'toggle', proxy_id: p.id, activo: false }) },
        token
      );
      continue;
    }

    const flag = egress.isEC ? 'EC ✓' : `NO-EC (${egress.country})`;
    console.log(
      `${egress.isEC ? '✓' : '⚠'} #${r.proxyId} ${label} latency=${r.latency}ms egress=${egress.ip} ${flag} ${egress.city}`
    );

    if (egress.isEC) {
      functional.push({ ...p, latency: r.latency, egressIp: egress.ip });
    } else {
      // No es Ecuador real: desactivar para SRI
      await req(
        '/api/admin/proxies',
        { method: 'POST', body: JSON.stringify({ action: 'toggle', proxy_id: p.id, activo: false }) },
        token
      );
    }
  }

  console.log(`\nProxies EC funcionales: ${functional.length}`);
  if (functional.length === 0) {
    console.error('No hay proxies con IP de salida en Ecuador. Abortando scrapers.');
    process.exit(1);
  }
  for (const p of functional) {
    console.log(`  · #${p.id} ${p.proxy_host}:${p.proxy_port} → ${p.egressIp} (${p.latency}ms)`);
  }

  const emisores = await req('/api/sri/emisores', {}, token);
  const emisorList = emisores.json?.emisores || emisores.json?.data || [];
  const emisor = emisorList.find((e) => e.tieneCredenciales) || emisorList[0];
  if (!emisor?.ruc) {
    console.error('Sin emisor/RUC');
    process.exit(1);
  }
  console.log(`\nRUC: ${emisor.ruc}`);

  const fecha_desde = '2026-07-01';
  const fecha_hasta = '2026-07-31';
  const summary = [];

  for (const a of ACTIONS) {
    const body = {
      ruc: emisor.ruc,
      fecha_desde,
      fecha_hasta,
      tipo_comprobante: a.action_type.includes('RETENCION') ? '6' : '1',
      action_type: a.action_type,
      options: { connection_mode: 'playwright', headless: true },
    };
    const enq = await req('/api/sri/scraping', { method: 'POST', body: JSON.stringify(body) }, token);
    if (enq.status !== 200 || !enq.json?.jobId) {
      console.error(`FAIL encolar ${a.label}:`, enq.status, enq.json?.error || enq.text.slice(0, 100));
      summary.push({ label: a.label, status: 'ENQUEUE_FAIL' });
      continue;
    }
    const jobId = enq.json.jobId;
    console.log(`\n→ ${a.label} job #${jobId}`);

    const deadline = Date.now() + 15 * 60 * 1000;
    let final = null;
    while (Date.now() < deadline) {
      await sleep(12000);
      try {
        const jobs = await req('/api/sri/scraping', {}, token);
        const row = (jobs.json?.jobs || []).find((j) => String(j.id) === String(jobId));
        if (!row) continue;
        const msg = (row.progress_message || '').slice(0, 140);
        console.log(`  ${row.status}: ${msg}`);
        if (['COMPLETED', 'ERROR', 'CANCELLED'].includes(row.status)) {
          final = { label: a.label, id: jobId, status: row.status, message: msg };
          break;
        }
      } catch (e) {
        console.log(`  poll error: ${e.message}`);
      }
    }
    if (!final) {
      final = { label: a.label, id: jobId, status: 'TIMEOUT', message: '15 min' };
    }
    summary.push(final);
  }

  console.log('\n=== Resumen ===');
  console.log(`Proxies EC OK: ${functional.length}`);
  for (const r of summary) {
    console.log(`- ${r.label}: ${r.status}${r.message ? ' — ' + r.message : ''}`);
  }
  const bad = summary.filter((r) => r.status !== 'COMPLETED');
  process.exit(bad.length ? 1 : 0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
