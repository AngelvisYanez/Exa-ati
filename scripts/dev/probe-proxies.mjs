/**
 * probe-proxies.mjs — Prueba proxies ecuatorianos contra srienlinea.sri.gob.ec
 *
 * 1. Inserta proxies de lista pública en proxy_pool
 * 2. Testea cada uno contra el SRI
 * 3. Reporta cuáles funcionan
 *
 * Uso: node scripts/probe-proxies.mjs
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

// Proxies extraídos de onlinecybertools.com/proxies/country/ecuador
const PROXY_LIST = [
  { host: '45.239.48.98', port: 999, pais: 'EC' },
  { host: '200.24.130.150', port: 999, pais: 'EC' },
  { host: '45.70.236.194', port: 999, pais: 'EC' },
  { host: '190.12.150.244', port: 999, pais: 'EC' },
  { host: '179.60.53.26', port: 999, pais: 'EC' },
  { host: '177.234.217.85', port: 999, pais: 'EC' },
  { host: '45.229.17.2', port: 999, pais: 'EC' },
  { host: '45.4.202.145', port: 999, pais: 'EC' },
  { host: '177.234.217.235', port: 999, pais: 'EC' },
  { host: '177.234.192.15', port: 999, pais: 'EC' },
  { host: '186.33.45.195', port: 8080, pais: 'EC' },
  { host: '45.71.186.213', port: 999, pais: 'EC' },
  { host: '45.236.170.178', port: 999, pais: 'EC' },
  { host: '186.5.94.206', port: 999, pais: 'EC' },
  { host: '160.20.165.242', port: 8080, pais: 'EC' },
  { host: '177.234.247.18', port: 1080, pais: 'EC' },
  { host: '45.238.57.1', port: 3629, pais: 'EC' },
];

const SRI_TEST_URL = 'https://srienlinea.sri.gob.ec/sri-en-linea/contribuyente/perfil';
const TIMEOUT_MS = 15000;

async function testProxy(host, port) {
  const proxyUrl = `http://${host}:${port}`;
  const start = Date.now();
  try {
    const agent = new HttpsProxyAgent(proxyUrl);
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), TIMEOUT_MS);

    const res = await fetch(SRI_TEST_URL, {
      method: 'HEAD',
      agent,
      signal: controller.signal,
      headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/149.0.0.0' },
    });
    clearTimeout(timeout);

    const latency = Date.now() - start;
    return { alive: true, status: res.status, latency };
  } catch (err) {
    const latency = Date.now() - start;
    return { alive: false, status: null, latency, error: err.message?.substring(0, 60) || 'Unknown' };
  }
}

async function main() {
  console.log('🧪 Probe: Testeando proxies ecuatorianos contra SRI\n');
  console.log('Target:', SRI_TEST_URL);
  console.log(`Timeout: ${TIMEOUT_MS}ms\n`);

  // Probar todos en paralelo
  const results = await Promise.all(
    PROXY_LIST.map(p => testProxy(p.host, p.port).then(r => ({ ...p, ...r })))
  );

  // Mostrar resultados ordenados por latencia
  const alive = results.filter(r => r.alive).sort((a, b) => a.latency - b.latency);
  const dead = results.filter(r => !r.alive);

  console.log(`✅ VIVOS: ${alive.length}/${results.length}\n`);
  if (alive.length > 0) {
    console.log('Rank | Proxy             | Status | Latencia');
    console.log('-----|-------------------|--------|---------');
    alive.forEach((r, i) => {
      console.log(
        `  ${(i + 1).toString().padStart(2)} | ${(r.host + ':' + r.port).padEnd(17)} | ${r.status}    | ${r.latency}ms`
      );
    });
  }

  console.log(`\n❌ MUERTOS: ${dead.length}/${results.length}\n`);
  dead.forEach(r => {
    console.log(`   ${r.host}:${r.port} → ${r.error || 'no response'}`);
  });

  // Insertar vivos en proxy_pool
  if (alive.length > 0) {
    console.log('\n▶ Insertando proxies vivos en proxy_pool...');
    await POOL.execute("DELETE FROM proxy_pool WHERE proxy_host LIKE '45.%' OR proxy_host LIKE '177.%' OR proxy_host LIKE '190.%' OR proxy_host LIKE '179.%' OR proxy_host LIKE '186.%' OR proxy_host LIKE '200.%' OR proxy_host LIKE '160.%'");

    let inserted = 0;
    for (const p of alive) {
      try {
        await POOL.execute(
          'INSERT INTO proxy_pool (proxy_host, proxy_port, pais, activo, en_uso) VALUES (?, ?, ?, 1, 0)',
          [p.host, p.port, p.pais]
        );
        inserted++;
      } catch (e) {
        console.log(`   Error insertando ${p.host}:${p.port}: ${e.message}`);
      }
    }
    console.log(`✓ ${inserted} proxies insertados en pool`);

    // Mostrar resumen final
    const [count] = await POOL.execute('SELECT COUNT(*) as t FROM proxy_pool WHERE activo = 1');
    console.log(`\n📊 Total proxies disponibles: ${count[0].t}`);
  }

  if (alive.length === 0) {
    console.log('\n⚠️  Ningún proxy público responde. Todos los proxies gratuitos de listas públicas están muertos.');
    console.log('💡 Recomendación: monta un Squid en un VPS de Ecuador (~$8/mes en Contabo).');
  }

  await POOL.end();
}

main().catch(err => {
  console.error('Error:', err);
  process.exit(1);
});
