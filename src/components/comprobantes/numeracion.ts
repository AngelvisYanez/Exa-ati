import type { EmisorOpcion, SerieCorta } from "./types";

export function serieEmisor(emisor: EmisorOpcion | undefined): SerieCorta | null {
  const estab = emisor?.establecimiento || emisor?.estab || "";
  const pto = emisor?.puntoEmision || emisor?.punto_emision || emisor?.ptoEmi || "";
  if (!estab && !pto) return null;
  return {
    estab: String(estab || "—").padStart(3, "0"),
    pto: String(pto || "—").padStart(3, "0"),
  };
}

export function numeroComprobante(secuencial: string, serie: SerieCorta | null, siguiente?: string): string {
  const sec = secuencial.trim() ? secuencial.trim().padStart(9, "0") : siguiente;
  if (!sec) return "Secuencial automático";
  if (!serie) return sec;
  return `${serie.estab}-${serie.pto}-${sec}`;
}

/** 001-001-000000123 a partir de la serie ("001-001" o "001001") y el secuencial. */
export function numeroDocumento(serie: string, secuencial: string): string {
  const digitos = serie.replace(/\D/g, "").padStart(6, "0");
  return `${digitos.slice(0, 3)}-${digitos.slice(3, 6)}-${secuencial.replace(/\D/g, "").padStart(9, "0")}`;
}

export const FORMATO_NUMERO_DOCUMENTO = /^\d{3}-\d{3}-\d{9}$/;
