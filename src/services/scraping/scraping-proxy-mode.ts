import { db } from '@/services/sri-api/db';

export async function getScrapingUseProxy(tenantId: string): Promise<boolean> {
  const setting = await db.queryOne<{ scraping_use_proxy: boolean | number }>(
    'SELECT scraping_use_proxy FROM tenant_settings WHERE tenant_id = $1',
    [tenantId]
  );
  return setting?.scraping_use_proxy !== false && setting?.scraping_use_proxy !== 0;
}

export async function setScrapingUseProxy(tenantId: string, enabled: boolean): Promise<void> {
  const existing = await db.queryOne<{ id: number }>(
    'SELECT id FROM tenant_settings WHERE tenant_id = $1',
    [tenantId]
  );
  if (existing) {
    await db.query(
      'UPDATE tenant_settings SET scraping_use_proxy = $1, updated_at = NOW() WHERE tenant_id = $2',
      [enabled, tenantId]
    );
  } else {
    await db.query(
      'INSERT INTO tenant_settings (tenant_id, scraping_use_proxy, updated_at) VALUES ($1, $2, NOW())',
      [tenantId, enabled]
    );
  }
}
