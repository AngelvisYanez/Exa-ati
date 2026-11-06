/** Serie SRI: establecimiento, punto de emisión y último número por tipo de comprobante. */

export const TIPOS_COMPROBANTE_SERIE = [
  { tipo: "01", nombre: "Factura" },
  { tipo: "03", nombre: "Liquidación de compra" },
  { tipo: "04", nombre: "Nota de crédito" },
  { tipo: "05", nombre: "Nota de débito" },
  { tipo: "06", nombre: "Guía de remisión" },
  { tipo: "07", nombre: "Comprobante de retención" },
] as const;

export type TipoComprobanteSerie = (typeof TIPOS_COMPROBANTE_SERIE)[number]["tipo"];

export const MAX_SECUENCIAL = 999_999_999;

const TIPOS = new Set<string>(TIPOS_COMPROBANTE_SERIE.map((item) => item.tipo));

export function esTipoComprobanteSerie(tipo: string): tipo is TipoComprobanteSerie {
  return TIPOS.has(tipo);
}

/** Código de 3 dígitos. 000 no es una serie válida. */
export function normalizarCodigoSerie(value: string): string | null {
  const digits = value.replace(/\D/g, "");
  if (!digits || digits.length > 3) return null;
  const padded = digits.padStart(3, "0");
  if (padded === "000") return null;
  return padded;
}

/** Último número ya emitido. 0 significa que todavía no hay ninguno. */
export function normalizarUltimo(value: unknown): number | null {
  if (typeof value === "number" && Number.isInteger(value) && value >= 0 && value <= MAX_SECUENCIAL) {
    return value;
  }
  if (typeof value === "string" && /^\d{1,9}$/.test(value.trim())) {
    const numero = Number(value.trim());
    if (numero <= MAX_SECUENCIAL) return numero;
  }
  return null;
}

export function siguienteDe(ultimo: number): string {
  return String(ultimo + 1).padStart(9, "0");
}

export function numeroSerie(establecimiento: string, puntoEmision: string, secuencial: string): string {
  return `${establecimiento}-${puntoEmision}-${secuencial.padStart(9, "0")}`;
}

/** Separa "EEE-PPP" en establecimiento y punto de emisión. */
export function separarSerie(value: string): { establecimiento: string; puntoEmision: string } | null {
  const match = /^(\d{1,3})-(\d{1,3})$/.exec(value.trim());
  if (!match) return null;
  const establecimiento = normalizarCodigoSerie(match[1]);
  const puntoEmision = normalizarCodigoSerie(match[2]);
  if (!establecimiento || !puntoEmision) return null;
  return { establecimiento, puntoEmision };
}
