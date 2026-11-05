/** Utilidades para encolar descarga masiva del portal SRI a partir de una clave de acceso. */

/** Tipo SRI en clave (01,03,…) → código del descargador masivo (1,2,3,4,6). */
export function mapClaveTipoToScraperTipo(tipoComprobante: string): string {
  const map: Record<string, string> = {
    '01': '1',
    '03': '2',
    '04': '3',
    '05': '4',
    '06': 'todos',
    '07': '6',
  };
  return map[tipoComprobante] || 'todos';
}

export function fechaEmisionFromClave(claveAcceso: string): string | null {
  if (!claveAcceso || claveAcceso.length < 8) return null;
  const d = claveAcceso.substring(0, 2);
  const m = claveAcceso.substring(2, 4);
  const y = claveAcceso.substring(4, 8);
  if (!/^\d{8}$/.test(claveAcceso.substring(0, 8))) return null;
  return `${y}-${m}-${d}`;
}

export function tipoFromClave(claveAcceso: string): string {
  if (!claveAcceso || claveAcceso.length < 10) return '01';
  return claveAcceso.substring(8, 10);
}

export function buildScrapePayloadForClave(params: {
  claveAcceso: string;
  rucPortal: string;
  /** true si el comprobante lo emitió el RUC del portal */
  esEmitido: boolean;
}): {
  ruc: string;
  fecha_desde: string;
  fecha_hasta: string;
  tipo_comprobante: string;
  action_type: 'DOWNLOAD_EMITTED' | 'DOWNLOAD_RECEIVED';
  options: { connection_mode: 'playwright'; clavesAcceso: string[] };
} | null {
  const { claveAcceso, rucPortal, esEmitido } = params;
  if (!claveAcceso || claveAcceso.length !== 49 || !rucPortal) return null;

  const fecha = fechaEmisionFromClave(claveAcceso);
  if (!fecha) return null;

  return {
    ruc: rucPortal,
    fecha_desde: fecha,
    fecha_hasta: fecha,
    tipo_comprobante: mapClaveTipoToScraperTipo(tipoFromClave(claveAcceso)),
    action_type: esEmitido ? 'DOWNLOAD_EMITTED' : 'DOWNLOAD_RECEIVED',
    options: {
      connection_mode: 'playwright',
      clavesAcceso: [claveAcceso],
    },
  };
}
