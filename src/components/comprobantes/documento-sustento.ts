import { FORMATO_NUMERO_DOCUMENTO, numeroDocumento } from "./numeracion";

export type OrigenDocumento = "emitidos" | "recibidos";

export interface DocumentoSustento {
  codDoc: string;
  numero: string;
  fecha: string;
  autorizacion: string;
}

export const DOCUMENTO_SUSTENTO_VACIO: DocumentoSustento = { codDoc: "01", numero: "", fecha: "", autorizacion: "" };

/** Fila tal como la devuelve GET /api/sri/comprobantes. */
export interface ComprobanteListado {
  claveAcceso: string;
  tipoComprobante: string;
  serie: string;
  secuencial: string;
  fechaEmision: string;
  importeTotal: number;
  receptorIdentificacion?: string | null;
  receptorRazonSocial?: string | null;
  numeroAutorizacion?: string | null;
  estado?: string;
  emisor?: { ruc?: string | null; razonSocial?: string | null };
}

export interface CandidatoSustento {
  clave: string;
  numero: string;
  fecha: string;
  autorizacion: string;
  contraparte: string;
  total: number;
}

/**
 * El listado filtrado por RUC mezcla emitidos y recibidos: separa por quién
 * figura como emisor y filtra por número (con o sin guiones).
 */
export function filtrarCandidatos(
  filas: readonly ComprobanteListado[],
  { ruc, origen, codDoc, consulta }: { ruc: string; origen: OrigenDocumento; codDoc: string; consulta: string },
): CandidatoSustento[] {
  const digitos = consulta.replace(/\D/g, "");
  return filas
    .filter((fila) => fila.tipoComprobante === codDoc)
    .filter((fila) => {
      const emitidoPorMi = fila.emisor?.ruc === ruc;
      return origen === "emitidos" ? emitidoPorMi : !emitidoPorMi && fila.receptorIdentificacion === ruc;
    })
    .map((fila) => ({
      clave: fila.claveAcceso,
      numero: numeroDocumento(fila.serie, fila.secuencial),
      fecha: String(fila.fechaEmision ?? "").slice(0, 10),
      autorizacion: fila.numeroAutorizacion || fila.claveAcceso,
      contraparte: origen === "emitidos"
        ? fila.receptorRazonSocial || fila.receptorIdentificacion || ""
        : fila.emisor?.razonSocial || fila.emisor?.ruc || "",
      total: fila.importeTotal,
    }))
    .filter((item) => !digitos || item.numero.replace(/\D/g, "").includes(digitos))
    .slice(0, 8);
}

export function documentoSustentoCompleto(doc: DocumentoSustento): boolean {
  return Boolean(doc.codDoc)
    && FORMATO_NUMERO_DOCUMENTO.test(doc.numero)
    && /^\d{4}-\d{2}-\d{2}$/.test(doc.fecha)
    && /^(\d{10}|\d{37}|\d{49})$/.test(doc.autorizacion);
}

/** Da formato 001-001-000000123 mientras se escribe. */
export function formatearNumeroDocumento(valor: string): string {
  const d = valor.replace(/\D/g, "").slice(0, 15);
  if (d.length <= 3) return d;
  if (d.length <= 6) return `${d.slice(0, 3)}-${d.slice(3)}`;
  return `${d.slice(0, 3)}-${d.slice(3, 6)}-${d.slice(6)}`;
}
