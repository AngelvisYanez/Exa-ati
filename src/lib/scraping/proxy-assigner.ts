import { db } from '@/lib/sri-api/db';

export interface ProxyRecord {
  id: number;
  proxy_host: string;
  proxy_port: number;
  proxy_user: string | null;
  proxy_pass: string | null;
  pais: string;
  activo: number | boolean;
  en_uso: number | boolean;
  asignado_a: string | null;
  ultimo_uso: string | null;
}

const usesPrisma = Boolean(process.env.DATABASE_URL);

export function formatProxyUrl(proxy: ProxyRecord): string {
  if (proxy.proxy_user && proxy.proxy_pass) {
    return `http://${proxy.proxy_user}:${proxy.proxy_pass}@${proxy.proxy_host}:${proxy.proxy_port}`;
  }
  return `http://${proxy.proxy_host}:${proxy.proxy_port}`;
}

/**
 * Claim proxy atomically using a transaction with SELECT ... FOR UPDATE (MySQL)
 * or UPDATE ... WHERE id = (SELECT ...) RETURNING (PostgreSQL).
 */
export async function claimProxy(jobId: number): Promise<ProxyRecord | null> {
  if (usesPrisma) {
    const result = await db.query(
      `UPDATE proxy_pool SET en_uso = true, asignado_a = $1, ultimo_uso = NOW()
       WHERE id = (
         SELECT id FROM proxy_pool
         WHERE activo = true AND en_uso = false
         ORDER BY ultimo_uso ASC NULLS FIRST
         LIMIT 1
       )
       RETURNING *`,
      [String(jobId)]
    );
    return (result.rows[0] as ProxyRecord) || null;
  }

  // MySQL: transacción atómica con FOR UPDATE
  return db.transaction(async (client: any) => {
    const [rows] = await client.execute(
      'SELECT id FROM proxy_pool WHERE activo = 1 AND en_uso = 0 ORDER BY ultimo_uso ASC LIMIT 1 FOR UPDATE'
    );
    if (!rows || rows.length === 0) return null;

    const proxyId = rows[0].id;
    await client.execute(
      'UPDATE proxy_pool SET en_uso = 1, asignado_a = ?, ultimo_uso = NOW() WHERE id = ?',
      [String(jobId), proxyId]
    );
    const [proxyRows] = await client.execute('SELECT * FROM proxy_pool WHERE id = ?', [proxyId]);
    return proxyRows?.[0] || null;
  });
}

export async function claimAnyProxy(): Promise<ProxyRecord | null> {
  if (usesPrisma) {
    const result = await db.query(
      `UPDATE proxy_pool SET en_uso = true, ultimo_uso = NOW()
       WHERE id = (
         SELECT id FROM proxy_pool
         WHERE activo = true AND en_uso = false
         ORDER BY ultimo_uso ASC NULLS FIRST
         LIMIT 1
       )
       RETURNING *`,
    );
    return (result.rows[0] as ProxyRecord) || null;
  }

  return db.transaction(async (client: any) => {
    const [rows] = await client.execute(
      'SELECT id FROM proxy_pool WHERE activo = 1 AND en_uso = 0 ORDER BY ultimo_uso ASC LIMIT 1 FOR UPDATE'
    );
    if (!rows || rows.length === 0) return null;

    const proxyId = rows[0].id;
    await client.execute(
      'UPDATE proxy_pool SET en_uso = 1, ultimo_uso = NOW() WHERE id = ?',
      [proxyId]
    );
    const [proxyRows] = await client.execute('SELECT * FROM proxy_pool WHERE id = ?', [proxyId]);
    return proxyRows?.[0] || null;
  });
}

export async function releaseProxy(jobId: number): Promise<void> {
  await db.query(
    `UPDATE proxy_pool SET en_uso = $1, asignado_a = NULL WHERE asignado_a = $2`,
    [usesPrisma ? false : 0, String(jobId)]
  );
}

export async function releaseProxyById(proxyId: number): Promise<void> {
  await db.query(
    `UPDATE proxy_pool SET en_uso = $1, asignado_a = NULL WHERE id = $2`,
    [usesPrisma ? false : 0, proxyId]
  );
}

export async function releaseAllProxies(): Promise<void> {
  await db.query(
    `UPDATE proxy_pool SET en_uso = $1, asignado_a = NULL WHERE en_uso = $2`,
    [usesPrisma ? false : 0, usesPrisma ? true : 1]
  );
}

export async function countAvailable(): Promise<number> {
  const row = await db.queryOne<{ count: number }>(
    'SELECT COUNT(*) as count FROM proxy_pool WHERE activo = $1 AND en_uso = $2',
    [usesPrisma ? true : 1, usesPrisma ? false : 0]
  );
  return row?.count ?? 0;
}

export async function countInUse(): Promise<number> {
  const row = await db.queryOne<{ count: number }>(
    'SELECT COUNT(*) as count FROM proxy_pool WHERE en_uso = $1',
    [usesPrisma ? true : 1]
  );
  return row?.count ?? 0;
}

export async function listAllProxies(): Promise<ProxyRecord[]> {
  return db.queryAll<ProxyRecord>(
    'SELECT * FROM proxy_pool ORDER BY ultimo_uso ASC NULLS FIRST',
  );
}

export async function addProxy(data: {
  proxy_host: string;
  proxy_port: number;
  proxy_user?: string;
  proxy_pass?: string;
  pais?: string;
}): Promise<ProxyRecord | null> {
  return db.insert('proxy_pool', {
    proxy_host: data.proxy_host,
    proxy_port: data.proxy_port,
    proxy_user: data.proxy_user || null,
    proxy_pass: data.proxy_pass || null,
    pais: data.pais || 'EC',
    activo: 1,
    en_uso: usesPrisma ? false : 0,
  }, '*');
}

export async function removeProxy(proxyId: number): Promise<void> {
  await db.query('DELETE FROM proxy_pool WHERE id = $1', [proxyId]);
}

export async function toggleProxy(proxyId: number, activo: boolean): Promise<void> {
  await db.query(
    'UPDATE proxy_pool SET activo = $1 WHERE id = $2',
    [activo ? (usesPrisma ? true : 1) : (usesPrisma ? false : 0), proxyId]
  );
}

export interface ProxyTestResult {
  proxyId: number;
  alive: boolean;
  latency: number | null;
  error?: string;
}

export async function testearProxy(proxyId: number): Promise<ProxyTestResult> {
  const { testProxyConnection } = await import('./proxy-discoverer');
  const proxies = await listAllProxies();
  const proxy = proxies.find((p: any) => p.id === proxyId);
  if (!proxy) return { proxyId, alive: false, latency: null, error: 'Proxy no encontrado' };

  try {
    const result = await testProxyConnection(proxy.proxy_host, proxy.proxy_port);
    if (result) {
      return { proxyId, alive: true, latency: result.latency };
    }
    return { proxyId, alive: false, latency: null, error: 'No respondió' };
  } catch (err: any) {
    return { proxyId, alive: false, latency: null, error: err.message };
  }
}

export async function testearTodosLosProxies(): Promise<ProxyTestResult[]> {
  const proxies = await listAllProxies();
  const results = await Promise.all(
    proxies.map((p: any) => testearProxy(p.id))
  );
  return results;
}

export async function assignProxyToJob(
  jobId: number,
  tenantId?: string | null,
): Promise<{ proxy: ProxyRecord | null; proxyUrl: string | null }> {
  const proxy = await claimProxy(jobId);
  if (!proxy) {
    return { proxy: null, proxyUrl: null };
  }
  const proxyUrl = formatProxyUrl(proxy);
  return { proxy, proxyUrl };
}

export async function assignAliveProxy(
  jobId: number,
  maxAttempts: number = 5,
): Promise<{ proxy: ProxyRecord | null; proxyUrl: string | null }> {
  const { testProxyConnection } = await import('./proxy-discoverer');

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    const proxy = await claimProxy(jobId);
    if (!proxy) return { proxy: null, proxyUrl: null };

    try {
      const result = await testProxyConnection(proxy.proxy_host, proxy.proxy_port);
      if (result) {
        const proxyUrl = formatProxyUrl(proxy);
        return { proxy, proxyUrl };
      }
    } catch {}

    await toggleProxy(proxy.id, false);
    await releaseProxy(jobId);
  }

  return { proxy: null, proxyUrl: null };
}

export async function markProxyDead(proxyId: number): Promise<void> {
  await toggleProxy(proxyId, false);
  await releaseProxyById(proxyId);
}
