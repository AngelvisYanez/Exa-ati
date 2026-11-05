/**
 * Prueba rápida de sync vía API (requiere dev server en :3000)
 * Uso: node scripts/test-sync.mjs
 */
const API = 'http://localhost:3000/api';

const loginRes = await fetch(`${API}/auth/login`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ email: 'admin@ofsercont.com', password: 'Ofsercont2026' }),
});
if (!loginRes.ok) {
  console.error('Login failed', await loginRes.text());
  process.exit(1);
}
const { accessToken } = await loginRes.json();
console.log('Login OK');

const started = Date.now();
const syncRes = await fetch(`${API}/sri/comprobantes/sync`, {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${accessToken}`,
  },
  body: JSON.stringify({
    modo: 'completo',
    fechaDesde: '2026-06-01',
    fechaHasta: '2026-06-30',
  }),
});
const elapsed = ((Date.now() - started) / 1000).toFixed(1);
const data = await syncRes.json();
console.log(`Sync ${syncRes.status} en ${elapsed}s`);
console.log(JSON.stringify(data, null, 2));
