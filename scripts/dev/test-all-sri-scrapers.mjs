/**
 * Encola y monitorea todos los scrapers SRI (excepto IESS) vía API.
 * Uso: node scripts/dev/test-all-sri-scrapers.mjs [baseUrl]
 */
import 'dotenv/config';

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

async function main() {
  console.log(`\n=== Test scrapers SRI headless (sin IESS) → ${BASE} ===`);
  console.log(`HEADLESS env: ${process.env.HEADLESS ?? '(unset)'}\n`);

  const login = await req('/api/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email: EMAIL, password: PASSWORD }),
  });
  const token = login.json?.token || login.json?.accessToken;
  if (login.status !== 200 || !token) {
    console.error('Login falló:', login.status, login.json?.message || login.text.slice(0, 200));
    process.exit(1);
  }
  console.log('Login OK:', EMAIL);

  const emisores = await req('/api/sri/emisores', {}, token);
  const list = emisores.json?.emisores || emisores.json?.data || [];
  const emisor = list.find((e) => e.tieneCredenciales) || list[0];
  if (!emisor?.ruc) {
    console.error('No hay emisor/RUC vinculado');
    process.exit(1);
  }
  console.log('RUC:', emisor.ruc, emisor.tieneCredenciales ? '(credenciales OK)' : '(sin clave SRI en emisor)');

  const proxies = await req('/api/admin/proxies', {}, token);
  if (proxies.status === 200) {
    const px = proxies.json?.proxies || [];
    console.log(`Proxies listados: ${px.length} (activos: ${px.filter((p) => p.activo).length})`);
  }

  const fecha_desde = '2026-07-01';
  const fecha_hasta = '2026-07-31';
  const results = [];

  for (const a of ACTIONS) {
    const body = {
      ruc: emisor.ruc,
      fecha_desde,
      fecha_hasta,
      tipo_comprobante: a.action_type.includes('RETENCION') ? '6' : '1',
      action_type: a.action_type,
      options: { connection_mode: 'playwright', headless: true },
    };
    const r = await req('/api/sri/scraping', { method: 'POST', body: JSON.stringify(body) }, token);
    if (r.status !== 200 || !r.json?.jobId) {
      console.error(`FAIL encolar ${a.label}:`, r.status, r.json?.error || r.text.slice(0, 120));
      results.push({ label: a.label, status: 'ENQUEUE_FAIL' });
      continue;
    }
    const jobId = r.json.jobId;
    console.log(`\n→ ${a.label} job #${jobId} (esperando fin, max 15 min)...`);

    const deadline = Date.now() + 15 * 60 * 1000;
    let final = null;
    while (Date.now() < deadline) {
      await sleep(10000);
      try {
        const jobs = await req('/api/sri/scraping', {}, token);
        const row = (jobs.json?.jobs || []).find((j) => String(j.id) === String(jobId));
        if (!row) continue;
        const st = row.status;
        const msg = (row.progress_message || '').slice(0, 120);
        if (st === 'COMPLETED' || st === 'ERROR' || st === 'CANCELLED') {
          final = { label: a.label, id: jobId, status: st, message: msg };
          console.log(`  [${a.label}] ${st}: ${msg}`);
          break;
        }
        console.log(`  [${a.label}] ${st}: ${msg}`);
      } catch (e) {
        console.log(`  [${a.label}] poll error: ${e.message}`);
      }
    }
    if (!final) {
      final = { label: a.label, id: jobId, status: 'TIMEOUT', message: 'sin terminar en 15 min' };
      console.log(`  [${a.label}] TIMEOUT`);
    }
    results.push(final);
  }

  console.log('\n=== Resumen headless ===');
  for (const r of results) {
    console.log(`- ${r.label}: ${r.status}${r.message ? ' — ' + r.message : ''}`);
  }
  const failed = results.filter((r) => r.status !== 'COMPLETED');
  process.exit(failed.length ? 1 : 0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
