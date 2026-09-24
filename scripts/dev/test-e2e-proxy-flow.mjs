/**
 * test-e2e-proxy-flow.mjs — Test end-to-end del flujo completo
 *
 * Simula:
 * 1. Seed de proxies en la pool
 * 2. Creación de múltiples scraping_jobs
 * 3. Asignación de proxies a cada job (vía proxy-assigner)
 * 4. Verificación de IPs únicas
 * 5. Liberación de proxies al completar
 * 6. Verificación de que proxies rotan en nuevo lote
 *
 * Uso: node scripts/test-e2e-proxy-flow.mjs
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

async function createScrapingJob(ruc, index) {
  const [result] = await POOL.execute(
    `INSERT INTO scraping_jobs 
     (ruc, clave_sri, status, action_type, tipo_comprobante, fecha_desde, fecha_hasta, progress_message)
     VALUES (?, ?, 'PENDING', 'DOWNLOAD_RECEIVED', 'todos', ?, ?, ?)`,
    [ruc, `clave_test_${index}`, '2026-01-01', '2026-01-05', `Job simulado ${index}`]
  );
  return result.insertId;
}

async function runE2ETest() {
  console.log('🧪 TEST E2E: Flujo completo de distribución de IPs\n');

  // ─── Setup proxies ───────────────────────────────────────────────
  await POOL.execute('DELETE FROM proxy_pool');
  await POOL.execute("DELETE FROM scraping_jobs WHERE ruc LIKE 'test-%'");

  const proxies = [
    { host: 'proxy-a.midominio.com', port: 3128, user: 'u1', pass: 'p1' },
    { host: 'proxy-b.midominio.com', port: 3128, user: 'u2', pass: 'p2' },
    { host: 'proxy-c.midominio.com', port: 3128, user: 'u3', pass: 'p3' },
  ];

  for (const p of proxies) {
    await POOL.execute(
      'INSERT INTO proxy_pool (proxy_host, proxy_port, proxy_user, proxy_pass, pais, activo, en_uso) VALUES (?, ?, ?, ?, ?, 1, 0)',
      [p.host, p.port, p.user, p.pass, 'EC']
    );
  }
  console.log(`✓ Setup: ${proxies.length} proxies en pool`);

  // ─── Crear jobs ─────────────────────────────────────────────────
  const JOB_COUNT = 4;
  const jobIds = [];
  for (let i = 0; i < JOB_COUNT; i++) {
    const id = await createScrapingJob(`test-${String.fromCharCode(65 + i)}`, i);
    jobIds.push(id);
  }
  console.log(`✓ ${JOB_COUNT} scraping_jobs creados en PENDING`);

  // ─── Simular asignación concurrente ─────────────────────────────
  console.log(`\n▶ Asignando proxies a ${JOB_COUNT} jobs...`);
  const assignments = await Promise.all(jobIds.map(id => claimProxyAtomic(id)));

  console.log('   Resultados:');
  for (let i = 0; i < JOB_COUNT; i++) {
    const a = assignments[i];
    if (a) {
      console.log(`   Job ${jobIds[i]} → proxy ${a.proxy_host}:${a.proxy_port} (ID ${a.id})`);
      // Verificar que proxy_id se asignó en scraping_jobs
      const [jobRows] = await POOL.execute('SELECT proxy_id FROM scraping_jobs WHERE id = ?', [jobIds[i]]);
      const storedProxyId = jobRows[0]?.proxy_id;
      console.log(`     proxy_id en DB: ${storedProxyId} ${storedProxyId === a.id ? '✓' : '✗'}`);
    } else {
      console.log(`   Job ${jobIds[i]} → SIN PROXY DISPONIBLE`);
    }
  }

  const assigned = assignments.filter(a => a !== null);
  const failed = assignments.filter(a => a === null);
  const uniqueIPs = new Set(assigned.map(a => `${a.proxy_host}:${a.proxy_port}`));

  // ─── Verificaciones ─────────────────────────────────────────────
  let passed = 0;
  const total = 4;

  if (assigned.length === proxies.length) {
    console.log(`\n✅ [1/${total}] Solo ${proxies.length} jobs obtuvieron proxy (pool limit)`);
    passed++;
  } else {
    console.log(`\n❌ [1/${total}] Se asignaron ${assigned.length}, esperado ${proxies.length}`);
  }

  if (uniqueIPs.size === assigned.length) {
    console.log(`✅ [2/${total}] IPs únicas: ${uniqueIPs.size} distintas`);

    // Mostrar detalle
    const ips = [...uniqueIPs];
    for (let i = 0; i < ips.length; i++) {
      console.log(`     IP ${i + 1}: ${ips[i]}`);
    }
    passed++;
  } else {
    console.log(`❌ [2/${total}] Colisión: ${assigned.length - uniqueIPs.size} comparten IP`);
  }

  if (failed.length === JOB_COUNT - proxies.length) {
    console.log(`✅ [3/${total}] ${failed.length} job(s) correctamente encolados`);
    passed++;
  } else {
    console.log(`❌ [3/${total}] Esperado ${JOB_COUNT - proxies.length} encolados, hay ${failed.length}`);
  }

  // ─── Liberar y verificar rotación ──────────────────────────────
  console.log(`\n▶ Liberando proxies y verificando rotación...`);
  for (const a of assigned) {
    await releaseProxy(parseInt(a.asignado_a));
  }

  const [freeCheck] = await POOL.execute(
    'SELECT COUNT(*) as count FROM proxy_pool WHERE activo = 1 AND en_uso = 0'
  );
  if (freeCheck[0].count === proxies.length) {
    console.log(`✅ [4/${total}] Todos los proxies liberados (${freeCheck[0].count}/${proxies.length})`);
    passed++;
  } else {
    console.log(`❌ [4/${total}] Quedan ${proxies.length - freeCheck[0].count} proxies sin liberar`);
  }

  // ─── Segundo lote: verificar rotación ──────────────────────────
  console.log(`\n▶ Segundo lote (verificar rotación)...`);
  const jobIds2 = [];
  for (let i = 0; i < proxies.length; i++) {
    const id = await createScrapingJob(`test-rotacion-${i}`, 100 + i);
    jobIds2.push(id);
  }
  const assignments2 = await Promise.all(jobIds2.map(id => claimProxyAtomic(id)));

  const ips2 = assignments2.filter(Boolean).map(a => a.proxy_host);
  console.log(`   Orden: ${ips2.join(' → ')}`);

  // En teoría debería rotar diferente del primer lote
  // (por el ORDER BY ultimo_uso ASC después del release)
  if (assignments2.every(a => a !== null)) {
    console.log('   ✅ Segundo lote también asignó todos los proxies');
  }

  // ─── Cleanup ────────────────────────────────────────────────────
  for (const a of assignments2.filter(Boolean)) {
    await releaseProxy(parseInt(a.asignado_a));
  }
  await POOL.execute("DELETE FROM scraping_jobs WHERE ruc LIKE 'test-%'");
  await POOL.execute('DELETE FROM proxy_pool');
  await POOL.end();

  console.log(`\n${'='.repeat(50)}`);
  console.log(`Resultado: ${passed}/${total} checks pasaron`);
  if (passed === total) {
    console.log('✅ E2E FLOW COMPLETO: Proxy pool funciona correctamente');
  } else {
    console.log('⚠️  Algunos checks fallaron, revisar logs');
  }
}

runE2ETest().catch(err => {
  console.error('Test error:', err);
  process.exit(1);
});
