/** Sync del portal SRI disparada por el filtro de Documentos (fechas + pestaña). */

export const DOCUMENTOS_FILTER_SOURCE = "documentos-filter";

export type DocumentosFilterView = "todos" | "emitidos" | "recibidos" | "retenciones";

export type FilterScrapeTarget = {
  action_type: "DOWNLOAD_EMITTED" | "DOWNLOAD_RECEIVED" | "DOWNLOAD_BOTH" | "SCRAPE_RETENCIONES";
  tipo_comprobante: string;
};

export type FilterScrapeJob = {
  id?: string | number;
  ruc?: string;
  fecha_desde?: unknown;
  fecha_hasta?: unknown;
  tipo_comprobante?: string;
  action_type?: string;
  status?: string;
  options?: unknown;
};

export function scrapeTargetForView(view: DocumentosFilterView): FilterScrapeTarget {
  if (view === "emitidos") return { action_type: "DOWNLOAD_EMITTED", tipo_comprobante: "todos" };
  if (view === "recibidos") return { action_type: "DOWNLOAD_RECEIVED", tipo_comprobante: "todos" };
  if (view === "retenciones") return { action_type: "SCRAPE_RETENCIONES", tipo_comprobante: "6" };
  return { action_type: "DOWNLOAD_BOTH", tipo_comprobante: "todos" };
}

export function jobDateKey(value: unknown): string {
  if (value == null || value === "") return "";
  const s = String(value).trim();
  const match = /^(\d{4}-\d{2}-\d{2})/.exec(s);
  return match ? match[1] : "";
}

export function readJobOptions(options: unknown): Record<string, unknown> {
  if (!options) return {};
  if (typeof options === "string") {
    try {
      const parsed = JSON.parse(options) as unknown;
      return parsed && typeof parsed === "object" ? (parsed as Record<string, unknown>) : {};
    } catch {
      return {};
    }
  }
  if (typeof options === "object") return options as Record<string, unknown>;
  return {};
}

export function isDocumentosFilterJob(options: unknown): boolean {
  return readJobOptions(options).source === DOCUMENTOS_FILTER_SOURCE;
}

export function matchesFilterJob(
  job: FilterScrapeJob,
  params: {
    ruc: string;
    from: string;
    to: string;
    action_type: string;
    tipo_comprobante: string;
  }
): boolean {
  if (job.status !== "PENDING" && job.status !== "PROCESSING") return false;
  if (!isDocumentosFilterJob(job.options)) return false;
  return (
    job.ruc === params.ruc &&
    jobDateKey(job.fecha_desde) === params.from &&
    jobDateKey(job.fecha_hasta) === params.to &&
    job.action_type === params.action_type &&
    String(job.tipo_comprobante ?? "") === params.tipo_comprobante
  );
}

/** Fechas vacías o invertidas no consultan el portal. */
export function shouldSyncDocumentosFilter(from: string, to: string): boolean {
  return Boolean(from && to && from <= to);
}

/**
 * Si ya hay un job de filtro igual en curso, no se encola otro.
 * Si el filtro cambió, se cancelan solo los jobs marcados documentos-filter.
 */
export function planDocumentosFilterSync(
  jobs: FilterScrapeJob[],
  params: { ruc: string; from: string; to: string; view: DocumentosFilterView }
): { enqueue: boolean; cancelIds: string[] } {
  const target = scrapeTargetForView(params.view);
  const active = jobs.filter((job) => job.status === "PENDING" || job.status === "PROCESSING");
  const same = {
    ruc: params.ruc,
    from: params.from,
    to: params.to,
    action_type: target.action_type,
    tipo_comprobante: target.tipo_comprobante,
  };
  if (active.some((job) => matchesFilterJob(job, same))) {
    return { enqueue: false, cancelIds: [] };
  }
  const cancelIds = active.flatMap((job) => {
    if (!isDocumentosFilterJob(job.options) || job.id == null) return [];
    return [String(job.id)];
  });
  return { enqueue: true, cancelIds };
}

export function buildFilterScrapePayload(params: {
  ruc: string;
  from: string;
  to: string;
  view: DocumentosFilterView;
}): {
  ruc: string;
  fecha_desde: string;
  fecha_hasta: string;
  tipo_comprobante: string;
  action_type: FilterScrapeTarget["action_type"];
  options: { connection_mode: "playwright"; source: typeof DOCUMENTOS_FILTER_SOURCE };
} {
  const target = scrapeTargetForView(params.view);
  return {
    ruc: params.ruc,
    fecha_desde: params.from,
    fecha_hasta: params.to,
    tipo_comprobante: target.tipo_comprobante,
    action_type: target.action_type,
    options: { connection_mode: "playwright", source: DOCUMENTOS_FILTER_SOURCE },
  };
}
