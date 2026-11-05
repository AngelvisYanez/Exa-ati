/**
 * ATS no se scrapea del portal SRI de forma fiable.
 * Tras sincronizar comprobantes del periodo, el ATS se genera localmente
 * vía POST /api/declaraciones/ats (XML desde comprobantes en DB).
 */

export interface AtsPrepareResult {
  mode: 'local_generation';
  message: string;
  periodo: number | null;
  syncDone: boolean;
}

export function buildAtsPrepareResult(opts: {
  periodo: number | null;
  syncDone: boolean;
}): AtsPrepareResult {
  return {
    mode: 'local_generation',
    syncDone: opts.syncDone,
    periodo: opts.periodo,
    message: opts.syncDone
      ? 'Comprobantes del periodo sincronizados. Genera el ATS con POST /api/declaraciones/ats (XML local).'
      : 'SCRAPE_ATS requiere sincronizar comprobantes primero; luego usa /api/declaraciones/ats.',
  };
}

/** Infer YYYYMM from job date range (fecha_desde). */
export function periodoFromJobDates(fechaDesde: string | Date | null | undefined): number | null {
  if (!fechaDesde) return null;
  const s = typeof fechaDesde === 'string' ? fechaDesde.slice(0, 10) : fechaDesde.toISOString().slice(0, 10);
  const m = s.match(/^(\d{4})-(\d{2})/);
  if (!m) return null;
  return parseInt(`${m[1]}${m[2]}`, 10);
}
