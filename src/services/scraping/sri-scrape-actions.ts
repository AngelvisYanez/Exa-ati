/** Action types for scraping_jobs.action_type (Playwright-only SRI orchestrator). */
export const SRI_SCRAPE_ACTIONS = [
  'DOWNLOAD_RECEIVED',
  'DOWNLOAD_EMITTED',
  'DOWNLOAD_BOTH',
  'SCRAPE_RETENCIONES',
  'SCRAPE_DECLARACIONES',
  'SCRAPE_OBLIGACIONES',
  'SCRAPE_ATS',
] as const;

export type SriScrapeAction = (typeof SRI_SCRAPE_ACTIONS)[number];

export function isSriScrapeAction(value: unknown): value is SriScrapeAction {
  return typeof value === 'string' && (SRI_SCRAPE_ACTIONS as readonly string[]).includes(value);
}

export function isComprobanteDownloadAction(action: string): boolean {
  return (
    action === 'DOWNLOAD_RECEIVED' ||
    action === 'DOWNLOAD_EMITTED' ||
    action === 'DOWNLOAD_BOTH' ||
    action === 'SCRAPE_RETENCIONES' ||
    action === 'SCRAPE_ATS'
  );
}

/** Normalize job DATE columns to YYYY-MM-DD (avoids `String(Date).slice(0,10)` → "Wed Jul 01"). */
export function formatJobDateIso(value: unknown): string | null {
  if (value == null || value === '') return null;
  if (value instanceof Date && !isNaN(value.getTime())) {
    const y = value.getUTCFullYear();
    const m = String(value.getUTCMonth() + 1).padStart(2, '0');
    const d = String(value.getUTCDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }
  const s = String(value).trim();
  const iso = /^(\d{4}-\d{2}-\d{2})/.exec(s);
  if (iso) return iso[1];
  const parsed = new Date(s);
  if (!isNaN(parsed.getTime())) {
    return parsed.toISOString().slice(0, 10);
  }
  return null;
}

/** YYYYMM → { fecha_desde, fecha_hasta } as YYYY-MM-DD */
export function periodoToDateRange(periodo: number): { fecha_desde: string; fecha_hasta: string } {
  const s = String(periodo);
  const year = parseInt(s.slice(0, 4), 10);
  const month = parseInt(s.slice(4, 6), 10);
  const last = new Date(Date.UTC(year, month, 0)).getUTCDate();
  return {
    fecha_desde: `${year}-${String(month).padStart(2, '0')}-01`,
    fecha_hasta: `${year}-${String(month).padStart(2, '0')}-${String(last).padStart(2, '0')}`,
  };
}
