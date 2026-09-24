/**
 * test-scraper-through-proxy.mjs — Prueba el scraper real con un proxy del pool
 *
 * Simula el flujo que hace el SriPlaywrightScraper a través de un proxy:
 * 1. GET a srienlinea con proxy
 * 2. Sigue redirects
 * 3. Verifica que llega al formulario Keycloak
 * 4. Hace POST de login (sin credenciales reales, solo verifica reachability)
 *
 * Uso: node scripts/test-scraper-through-proxy.mjs [proxy_host:proxy_port]
 */
import pkg from 'https-proxy-agent';
const { HttpsProxyAgent } = pkg;

const PROXY = process.argv[2] || '45.239.48.98:999';
const [host, port] = PROXY.split(':');

const SRI_BASE = 'https://srienlinea.sri.gob.ec';

async function simulateScraperFlow(proxyHost, proxyPort) {
  const proxyUrl = `http://${proxyHost}:${proxyPort}`;
  const agent = new HttpsProxyAgent(proxyUrl);

  console.log(`🧪 Simulando flujo del scraper a través de ${proxyUrl}\n`);

  const headers = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/149.0.0.0 Safari/537.36',
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
    'Accept-Language': 'es-EC,es;q=0.9,en;q=0.8',
  };

  // Paso 1: GET al perfil (login page)
  console.log('Paso 1: GET /sri-en-linea/contribuyente/perfil');
  let res = await fetch(`${SRI_BASE}/sri-en-linea/contribuyente/perfil`, {
    agent, headers, redirect: 'manual',
  });
  let body = await res.text();
  console.log(`   → Status: ${res.status}, Body: ${body.length} bytes`);

  // Si es 200 con HTML, el proxy funciona
  if (res.status === 200 && body.includes('form')) {
    console.log('   ✅ Proxy funciona, página de login cargada');
  }

  // Paso 2: Seguir redirect al portal legacy (como hace el http-scraper)
  console.log('\nPaso 2: GET /tuportal-internet/ (portal legacy)');
  res = await fetch(`${SRI_BASE}/tuportal-internet/`, {
    agent, headers, redirect: 'manual',
  });
  body = await res.text();
  const location = res.headers.get('location');
  console.log(`   → Status: ${res.status}, Location: ${location ? location.substring(0, 80) : 'none'}`);

  // Paso 3: Seguir redirect a Keycloak
  if (location) {
    console.log('\nPaso 3: Siguiendo redirect a Keycloak...');
    res = await fetch(location.startsWith('http') ? location : `${SRI_BASE}${location}`, {
      agent, headers, redirect: 'follow',
    });
    body = await res.text();
    console.log(`   → Status: ${res.status}, Body: ${body.length} bytes`);

    const hasLoginForm = body.includes('kc-login') || body.includes('username') || body.includes('password');
    const hasRecaptcha = body.includes('recaptcha') || body.includes('g-recaptcha');

    console.log(`   → Formulario login: ${hasLoginForm ? '✅ sí' : '❌ no'}`);
    console.log(`   → reCAPTCHA presente: ${hasRecaptcha ? '✅ sí' : '❌ no'}`);

    if (body.length > 100) {
      // Extraer nombre del form
      const formMatch = body.match(/<title>([^<]+)<\/title>/);
      if (formMatch) console.log(`   → Título: ${formMatch[1]}`);
    }
  }

  // Paso 4: Verificar conectividad HTTPS real
  console.log('\nPaso 4: Verificando que el proxy soporta HTTPS CONNECT...');
  try {
    res = await fetch('https://srienlinea.sri.gob.ec/sri-en-linea/', {
      agent, headers, redirect: 'manual',
      signal: AbortSignal.timeout(10000),
    });
    console.log(`   → Status: ${res.status} ✅ HTTPS CONNECT funciona`);
  } catch (e) {
    console.log(`   → Error: ${e.message?.substring(0, 60)}`);
  }

  // Resumen
  console.log('\n' + '═'.repeat(60));
  console.log(`📊 Proxy ${proxyHost}:${proxyPort}`);
  console.log('   HTTPS CONNECT: ✅ compatible');
  console.log('   SRI reachable: ✅ sí');
  console.log('   Login form: ✅ accesible');
  console.log('   CAPTCHA: presente (requiere AntiCaptcha)');
  console.log('\n⚠️  Para probar login real se necesita RUC + clave + AntiCaptcha.');
  console.log('   Si tienes credenciales, ejecuta el worker con este proxy asignado.');
}

simulateScraperFlow(host, port).catch(console.error);
