const BASE = 'http://localhost:3000';

async function main() {
  const loginRes = await fetch(`${BASE}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: '0704439892001', password: 'TorresC2024@' }),
  });
  const login = await loginRes.json();
  if (!loginRes.ok) {
    console.error('LOGIN FAIL', loginRes.status, login);
    process.exit(1);
  }
  const token = login.accessToken;
  const auth = { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };

  const emisorRes = await fetch(`${BASE}/api/sri/emisor`, { headers: auth });
  const emisor = await emisorRes.json();
  console.log('=== EMISOR ===');
  console.log(JSON.stringify({ status: emisorRes.status, ambiente: emisor?.ambiente, ruc: emisor?.ruc }, null, 2));

  const syncBody = { fechaDesde: '2026-06-01', fechaHasta: '2026-06-30' };
  console.log('\n=== SYNC PRODUCCIÓN (Jun 2026) ===');
  const t0 = Date.now();
  const syncRes = await fetch(`${BASE}/api/sri/comprobantes/sync`, {
    method: 'POST',
    headers: auth,
    body: JSON.stringify(syncBody),
  });
  const sync = await syncRes.json();
  console.log(JSON.stringify({
    status: syncRes.status,
    elapsedMs: Date.now() - t0,
    ...sync,
  }, null, 2));
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
