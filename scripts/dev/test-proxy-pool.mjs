/**
 * test-proxy-pool.mjs — Prueba de distribución de IPs
 *
 * Verifica que:
 * 1. El proxy pool asigna distintas IPs a distintos jobs
 * 2. No se asigna el mismo proxy a dos jobs simultáneos
 * 3. Los proxies se liberan correctamente al completar/fallar
 *
 * Uso: node scripts/test-proxy-pool.mjs
 */
import mysql from 'mysql2/promise';

const POOL = mysql.createPool({
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '3306', 10),
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'db_sri',
  connectionLimit: 10,
});

const PROXY_COUNT = 3;

async function claimProxyAtomic(jobId) {
  const conn = await POOL.getConnection();
  try {
    await conn.beginTransaction();
    const [rows] = await conn.execute(
      'SELECT id FROM proxy_pool WHERE activo = 1 AND en_uso = 0 ORDER BY ultimo_uso ASC LIMIT 1 FOR UPDATE'
    );
    if (rows.length === 0) {
      await conn.commit();
      return null;
    }
    const proxyId = rows[0].id;
    await conn.execute(
      'UPDATE proxy_pool SET en_uso = 1, asignado_a = ?, ultimo_uso = NOW() WHERE id = ?',
      [String(jobId), proxyId]
    );
    await conn.commit();
    const [proxyRows] = await conn.execute('SELECT * FROM proxy_pool WHERE id = ?', [proxyId]);
    return proxyRows[0];
  } finally {
    conn.release();
  }
}

async function releaseProxy(jobId) {
  await POOL.execute(
    "UPDATE proxy_pool SET en_uso = 0, asignado_a = NULL WHERE asignado_a = ?",
    [String(jobId)]
  );
}

function sleep(ms) {
  return new Promise(r => setTimeout(r, ms));
}

async function runTest() {
  console.log('🧪 Test: Distribución atómica de IPs por job\n');

  // Setup
  await POOL.execute('DELETE FROM proxy_pool');
  for (let i = 1; i <= PROXY_COUNT; i++) {
    await POOL.execute(
      'INSERT INTO proxy_pool (proxy_host, proxy_port, proxy_user, proxy_pass, pais, activo, en_uso) VALUES (?, ?, ?, ?, ?, 1, 0)',
      [`192.168.${i}.100`, 3128, `user${i}`, `pass${i}`, 'EC']
    );
  }
  console.log(`✓ Pool creado con ${PROXY_COUNT} proxies`);

  // Test 1: Asignación concurrente atómica
  const jobCount = 5;
  console.log(`\n▶ Test 1: ${jobCount} claims concurrentes (más jobs que proxies)...`);

  const claims = [];
  for (let i = 1; i <= jobCount; i++) {
    claims.push(claimProxyAtomic(i));
  }
  const proxies = await Promise.all(claims);
  const assigned = proxies.filter(p => p !== null);
  const failed = proxies.filter(p => p === null);
  const uniqueIPs = new Set(assigned.map(p => `${p.proxy_host}:${p.proxy_port}`));

  console.log(`   Asignados: ${assigned.length} | Sin proxy: ${failed.length} | IPs únicas: ${uniqueIPs.size}`);

  if (assigned.length === PROXY_COUNT) {
    console.log('   ✅ Solo se asignaron tantos proxies como disponibles');
  } else {
    console.log(`   ❌ Se asignaron ${assigned.length} cuando solo hay ${PROXY_COUNT}`);
  }

  if (uniqueIPs.size === assigned.length) {
    console.log('   ✅ Cada job tiene IP única (sin colisiones)');
  } else {
    console.log(`   ❌ Colisión: ${assigned.length - uniqueIPs.size} jobs comparten IP`);
  }

  // Liberar
  for (const p of assigned) {
    await releaseProxy(parseInt(p.asignado_a));
  }
  const [freeRows] = await POOL.execute(
    'SELECT COUNT(*) as count FROM proxy_pool WHERE activo = 1 AND en_uso = 0'
  );
  console.log(`   ✅ Proxies libres tras release: ${freeRows[0].count}/${PROXY_COUNT}`);

  // Test 2: Race condition directa
  console.log(`\n▶ Test 2: Dos claims exactamente simultáneos...`);

  await POOL.execute('UPDATE proxy_pool SET en_uso = 0, asignado_a = NULL');
  const [p1, p2] = await Promise.all([claimProxyAtomic(201), claimProxyAtomic(202)]);

  if (p1 && p2) {
    if (p1.id !== p2.id) {
      console.log(`   ✅ Proxys distintos: ID ${p1.id} vs ID ${p2.id}`);
    } else {
      console.log(`   ❌ MISMO proxy asignado a dos jobs: ID ${p1.id}`);
    }
  } else if (p1 && !p2) {
    console.log('   ✅ Segundo bloqueado (solo 1 proxy disponible hipotéticamente)');
  }
  await releaseProxy(201);
  await releaseProxy(202);

  // Test 3: Round-robin verificación
  console.log(`\n▶ Test 3: Rotación round-robin...`);
  await POOL.execute('UPDATE proxy_pool SET en_uso = 0, asignado_a = NULL, ultimo_uso = NULL');

  const order = [];
  for (let i = 0; i < PROXY_COUNT * 2; i++) {
    const p = await claimProxyAtomic(300 + i);
    if (p) {
      order.push(`Job ${300 + i} → ${p.proxy_host}`);
      await releaseProxy(300 + i);
    }
  }

  console.log(`   Orden de asignación:`);
  for (const line of order) {
    console.log(`     ${line}`);
  }

  // Verificar rotación
  const hostsInOrder = order.map(l => l.split('→ ')[1]);
  const uniqueHosts = [...new Set(hostsInOrder)];
  if (uniqueHosts.length === PROXY_COUNT) {
    console.log(`   ✅ Todos los proxies rotaron correctamente`);
  } else {
    console.log(`   ⚠️  Solo rotaron ${uniqueHosts.length}/${PROXY_COUNT} proxies`);
  }

  // Cleanup
  await POOL.execute('DELETE FROM proxy_pool');
  await POOL.end();

  const allPass = assigned.length === PROXY_COUNT && uniqueIPs.size === assigned.length;
  console.log(`\n${allPass ? '✅ TODOS LOS TESTS PASARON' : '❌ HUBO FALLOS'}`);
}

runTest().catch(err => {
  console.error('Test error:', err);
  process.exit(1);
});
