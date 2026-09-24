import { db } from '@/services/sri-api/db';

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
  [key: string]: any;
}

const usesPrisma = Boolean(process.env.DATABASE_URL);

/** País preferido para SRI (Ecuador). Override con SCRAPING_PROXY_COUNTRY. */
export function proxyCountryFilter(): string {
  return (process.env.SCRAPING_PROXY_COUNTRY || 'EC').trim().toUpperCase();
}

/** Errores típicos de proxy caído / IP expirada / túnel roto. */
export function isProxyFailureError(err: unknown): boolean {
  const msg = String((err as any)?.message || err || '').toLowerCase();
  return (
    msg.includes('proxy') ||
    msg.includes('err_proxy') ||
    msg.includes('err_tunnel') ||
    msg.includes('err_connection') ||
    msg.includes('econnrefused') ||
    msg.includes('econnreset') ||
    msg.includes('etimedout') ||
    msg.includes('err_timed_out') ||
    msg.includes('socket hang up') ||
    msg.includes('net::err_') ||
    msg.includes('proxy connection') ||
    msg.includes('tunnel connection failed') ||
    msg.includes('ns_error_proxy')
  );
}

export function formatProxyUrl(proxy: ProxyRecord): string {
  if (proxy.proxy_user && proxy.proxy_pass) {
    return `http://${proxy.proxy_user}:${proxy.proxy_pass}@${proxy.proxy_host}:${proxy.proxy_port}`;
  }
  return `http://${proxy.proxy_host}:${proxy.proxy_port}`;
}

/**
 * Claim proxy atomically. Prefiere proxies del país configurado (default EC).
 * `excludeIds` salta proxies ya marcados muertos en este hop del job.
 */
export async function claimProxy(
  jobId: number,
  country?: string,
  excludeIds: number[] = [],
): Promise<ProxyRecord | null> {
  const preferred = (country || proxyCountryFilter()).toUpperCase();
  const ecFilter =
    preferred === 'EC' || preferred === 'ECUADOR'
      ? `AND UPPER(TRIM(pais)) IN ('EC', 'ECUADOR')`
      : `AND UPPER(TRIM(pais)) = '${preferred.replace(/'/g, '')}'`;
  const exclude = excludeIds.filter((id) => Number.isFinite(id) && id > 0);

  if (usesPrisma) {
    const result = await db.query(
      `UPDATE proxy_pool SET en_uso = true, asignado_a = $1, ultimo_uso = NOW()
       WHERE id = (
         SELECT id FROM proxy_pool
         WHERE activo = true AND en_uso = false
         ${ecFilter}
         ${exclude.length ? `AND NOT (id = ANY($2::int[]))` : ''}
         ORDER BY ultimo_uso ASC NULLS FIRST
         LIMIT 1
       )
       RETURNING *`,
      exclude.length ? [String(jobId), exclude] : [String(jobId)]
    );
    return (result.rows[0] as ProxyRecord) || null;
  }

  // MySQL
  return db.transaction(async (client: any) => {
    const paisSql =
      preferred === 'EC' || preferred === 'ECUADOR'
        ? `AND UPPER(TRIM(pais)) IN ('EC', 'ECUADOR')`
        : `AND UPPER(TRIM(pais)) = ?`;
    const paisParams =
      preferred === 'EC' || preferred === 'ECUADOR' ? [] : [preferred];
    const excludeSql = exclude.length
      ? `AND id NOT IN (${exclude.map(() => '?').join(',')})`
      : '';

    const [rows] = await client.execute(
      `SELECT id FROM proxy_pool WHERE activo = 1 AND en_uso = 0 ${paisSql} ${excludeSql} ORDER BY ultimo_uso ASC LIMIT 1 FOR UPDATE`,
      [...paisParams, ...exclude]
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
  maxAttempts: number = 8,
  country?: string,
  excludeIds: number[] = [],
): Promise<{ proxy: ProxyRecord | null; proxyUrl: string | null }> {
  const { testProxyConnection } = await import('./proxy-discoverer');
  const preferred = country || proxyCountryFilter();
  const skipped = [...excludeIds];

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    const proxy = await claimProxy(jobId, preferred, skipped);
    if (!proxy) return { proxy: null, proxyUrl: null };

    try {
      const result = await testProxyConnection(proxy.proxy_host, proxy.proxy_port);
      if (result) {
        const proxyUrl = formatProxyUrl(proxy);
        return { proxy, proxyUrl };
      }
    } catch {}

    skipped.push(proxy.id);
    await toggleProxy(proxy.id, false);
    await releaseProxy(jobId);
  }

  return { proxy: null, proxyUrl: null };
}

export async function markProxyDead(proxyId: number, reason?: string): Promise<void> {
  try {
    if (reason) {
      await db.query(
        `UPDATE proxy_pool SET activo = $1, en_uso = $2, asignado_a = NULL,
           ultimo_error = $3, updated_at = NOW() WHERE id = $4`,
        [usesPrisma ? false : 0, usesPrisma ? false : 0, reason.slice(0, 500), proxyId]
      ).catch(async () => {
        await toggleProxy(proxyId, false);
        await releaseProxyById(proxyId);
      });
      return;
    }
  } catch {
    // fallback abajo
  }
  await toggleProxy(proxyId, false);
  await releaseProxyById(proxyId);
}

/** Re-prueba proxies EC inactivos (no excluidos) y reactiva los que responden TCP. */
export async function resurrectEcProxies(excludeIds: number[] = []): Promise<number> {
  const { testProxyConnection } = await import('./proxy-discoverer');
  const exclude = excludeIds.filter((id) => Number.isFinite(id) && id > 0);
  const rows = await db.queryAll<ProxyRecord>(
    `SELECT * FROM proxy_pool
     WHERE UPPER(TRIM(pais)) IN ('EC', 'ECUADOR')
     ${exclude.length ? `AND NOT (id = ANY($1::int[]))` : ''}
     ORDER BY ultimo_uso ASC NULLS FIRST`,
    exclude.length ? [exclude] : [],
  );
  let revived = 0;
  for (const proxy of rows) {
    const active = proxy.activo === true || proxy.activo === 1;
    if (active) continue;
    try {
      const result = await testProxyConnection(proxy.proxy_host, proxy.proxy_port);
      if (result) {
        await toggleProxy(proxy.id, true);
        revived++;
      }
    } catch {
      // sigue muerto
    }
  }
  return revived;
}

/** Marca el proxy actual como muerto y asigna el siguiente EC vivo (hop). */
export async function rotateAliveProxy(
  jobId: number,
  deadProxyId: number | null,
  excludeIds: number[] = [],
  country?: string,
  reason?: string,
): Promise<{ proxy: ProxyRecord | null; proxyUrl: string | null; excludeIds: number[] }> {
  const deadOnly = [...excludeIds];
  if (deadProxyId != null && !deadOnly.includes(deadProxyId)) {
    deadOnly.push(deadProxyId);
    await markProxyDead(deadProxyId, reason || 'Rotado: proxy expirado o sin respuesta');
  }
  await releaseProxy(jobId).catch(() => {});

  let assigned = await assignAliveProxy(jobId, 8, country || 'EC', deadOnly);
  if (!assigned.proxy) {
    const revived = await resurrectEcProxies(deadOnly);
    if (revived > 0) {
      assigned = await assignAliveProxy(jobId, 8, country || 'EC', deadOnly);
    }
  }
  // Último recurso: reintentar cualquier EC activo (incluye soft-excluidos de hops previos).
  if (!assigned.proxy) {
    assigned = await assignAliveProxy(jobId, 8, country || 'EC', deadProxyId != null ? [deadProxyId] : []);
  }
  return { ...assigned, excludeIds: deadOnly };
}
