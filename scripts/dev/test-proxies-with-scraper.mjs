/**
 * test-proxies-with-scraper.mjs — Prueba real de proxies contra el SRI
 *
 * 1. Toma los proxies vivos del pool
 * 2. Para cada uno, intenta acceder a páginas reales del SRI
 * 3. Reporta cuáles sirven para scraping real
 *
 * Uso: node scripts/test-proxies-with-scraper.mjs
 */
import mysql from 'mysql2/promise';
import pkg from 'https-proxy-agent';
const { HttpsProxyAgent } = pkg;

const POOL = mysql.createPool({
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '3306', 10),
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'db_sri',
});

const TIMEOUT_MS = 20000;

const SRI_PAGES = [
  { name: 'Login SRI', url: 'https://srienlinea.sri.gob.ec/sri-en-linea/contribuyente/perfil' },
  { name: 'Portal TU', url: 'https://srienlinea.sri.gob.ec/tuportal-internet/' },
  { name: 'Comprobantes', url: 'https://srienlinea.sri.gob.ec/tuportal-internet/accederAplicacion.jspa?redireccion=57&idGrupo=55' },
];

async function testProxyWithSRI(host, port) {
  const proxyUrl = `http://${host}:${port}`;
  const agent = new HttpsProxyAgent(proxyUrl);

  const results = [];

  for (const page of SRI_PAGES) {
    const start = Date.now();
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), TIMEOUT_MS);

      const res = await fetch(page.url, {
        method: 'GET',
        agent,
        signal: controller.signal,
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/149.0.0.0 Safari/537.36',
          'Accept': 'text/html,application/xhtml+xml',
          'Accept-Language': 'es-EC,es;q=0.9',
        },
        redirect: 'manual',
      });
      clearTimeout(timeout);

      const latency = Date.now() - start;
      const bodyLen = (await res.text()).length;
      const hasLogin = res.headers.get('location')?.includes('login') || res.headers.get('location')?.includes('keycloak');
      const hasKeycloak = bodyLen > 100 && !hasLogin;

      results.push({
        page: page.name,
        status: res.status,
        latency,
        bodyLen,
        redirect: res.headers.get('location')?.substring(0, 50) || '-',
        viable: res.status === 200 && bodyLen > 500,
      });
    } catch (err) {
      results.push({
        page: page.name,
        status: 'ERR',
        latency: Date.now() - start,
        bodyLen: 0,
        redirect: err.message?.substring(0, 50) || 'Unknown',
        viable: false,
      });
    }
  }

  const viableCount = results.filter(r => r.viable).length;
  return { host, port, results, viable: viableCount >= 2 };
}

async function main() {
  console.log('🧪 Prueba real: Proxies ecuatorianos contra SRI\n');
  console.log('Testeando 3 endpoints por proxy...\n');

  // Obtener proxies vivos del pool
  const [proxies] = await POOL.execute(
    'SELECT DISTINCT proxy_host, proxy_port FROM proxy_pool WHERE activo = 1 ORDER BY id'
  );

  if (proxies.length === 0) {
    console.log('⚠️ No hay proxies en el pool. Ejecuta primero probe-proxies.mjs');
    await POOL.end();
    return;
  }

  console.log(`Probando ${proxies.length} proxies...\n`);

  // Probar en lotes de 3 para no saturar
  const BATCH = 3;
  const allResults = [];

  for (let i = 0; i < proxies.length; i += BATCH) {
    const batch = proxies.slice(i, i + BATCH);
    const batchResults = await Promise.all(
      batch.map(p => testProxyWithSRI(p.proxy_host, p.proxy_port))
    );
    allResults.push(...batchResults);
  }

  // Reporte
  const viable = allResults.filter(r => r.viable);
  const notViable = allResults.filter(r => !r.viable);

  console.log('═'.repeat(70));
  console.log(`RESUMEN: ${viable.length} VIABLES | ${notViable.length} NO VIABLES\n`);

  if (viable.length > 0) {
    console.log('✅ PROXIES QUE SIRVEN PARA SRI:');
    console.log('─'.repeat(70));
    for (const r of viable) {
      console.log(`\n${r.host}:${r.port}`);
      for (const pr of r.results) {
        const icon = pr.viable ? '✅' : '❌';
        console.log(`   ${icon} ${pr.page}: HTTP ${pr.status} | ${pr.latency}ms | ${(pr.bodyLen / 1024).toFixed(1)}KB`);
      }
    }
  }

  if (notViable.length > 0) {
    console.log('\n❌ PROXIES QUE NO SIRVEN:');
    console.log('─'.repeat(70));
    for (const r of notViable) {
      console.log(`\n${r.host}:${r.port}`);
      for (const pr of r.results) {
        const icon = pr.viable ? '✅' : '❌';
        console.log(`   ${icon} ${pr.page}: ${pr.status === 'ERR' ? pr.redirect : `HTTP ${pr.status} | ${pr.latency}ms | ${(pr.bodyLen / 1024).toFixed(1)}KB`}`);
      }
    }
  }

  // Actualizar proxy_pool: desactivar los no viables
  if (notViable.length > 0) {
    console.log('\n▶ Desactivando proxies no viables...');
    for (const r of notViable) {
      await POOL.execute(
        'UPDATE proxy_pool SET activo = 0 WHERE proxy_host = ? AND proxy_port = ?',
        [r.host, r.port]
      );
    }
    console.log(`✓ ${notViable.length} proxies desactivados`);
  }

  const [activeCount] = await POOL.execute(
    'SELECT COUNT(*) as t FROM proxy_pool WHERE activo = 1'
  );
  console.log(`\n📊 Proxies activos en pool: ${activeCount[0].t}`);

  await POOL.end();
}

main().catch(err => {
  console.error('Error:', err);
  process.exit(1);
});
