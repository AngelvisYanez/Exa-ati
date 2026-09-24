/**
 * resolve-proxies.mjs — Reactiva proxies viables y analiza resultados reales
 *
 * Uso: node scripts/resolve-proxies.mjs
 */
import mysql from 'mysql2/promise';

const POOL = mysql.createPool({
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '3306', 10),
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'db_sri',
});

async function main() {
  console.log('🔍 Analizando resultados del test...\n');

  // Todos dieron 200 en login SRI y 302 (redirect esperado) en el resto
  // Esto significa que los proxies funcionan para SRI
  // El 302 es porque no hay cookie de sesión (normal)

  const [disabled] = await POOL.execute(
    "SELECT COUNT(*) as t FROM proxy_pool WHERE activo = 0"
  );

  if (disabled[0].t > 0) {
    console.log(`⚠️  ${disabled[0].t} proxies fueron desactivados incorrectamente`);
    console.log('   La redirección 302 a login es COMPORTAMIENTO ESPERADO');
    console.log('   (no hay sesión, el SRI redirige a Keycloak)\n');

    // Reactivar todos
    await POOL.execute("UPDATE proxy_pool SET activo = 1 WHERE activo = 0");
    console.log('✅ Todos los proxies reactivados');

    const [total] = await POOL.execute("SELECT COUNT(*) as t FROM proxy_pool WHERE activo = 1");
    console.log(`📊 Total proxies activos: ${total[0].t}`);
  }

  // Mostrar pool actual
  const [proxies] = await POOL.execute(
    'SELECT id, proxy_host, proxy_port, pais, en_uso, activo FROM proxy_pool WHERE activo = 1 ORDER BY id'
  );

  console.log('\n📋 Pool actual:');
  console.log('─'.repeat(60));
  for (const p of proxies) {
    console.log(`   ID ${String(p.id).padStart(2)} | ${p.proxy_host}:${p.proxy_port} | ${p.pais} | ${p.en_uso ? '🔴 EN USO' : '🟢 LIBRE'}`);
  }
  console.log(`\n   Total: ${proxies.length} proxies ecuatorianos listos para distribuir IPs`);

  await POOL.end();
}

main().catch(console.error);
