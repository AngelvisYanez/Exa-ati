import { validarIdentificacion as validarDigitoVerificador } from "@/services/sri-api/identificacion-ec";

export const ID_CONSUMIDOR_FINAL = "9999999999999";
export const NOMBRE_CONSUMIDOR_FINAL = "CONSUMIDOR FINAL";

export interface TipoIdentificacion {
  value: string;
  label: string;
}

/** Códigos SRI de tipo de identificación, en el orden en que se muestran. */
export const TIPOS_IDENTIFICACION: readonly TipoIdentificacion[] = [
  { value: "04", label: "RUC" },
  { value: "05", label: "Cédula" },
  { value: "06", label: "Pasaporte" },
  { value: "07", label: "Consumidor final" },
  { value: "08", label: "Exterior" },
];

/** Liquidación de compra y retención no admiten consumidor final. */
export const TIPOS_SIN_CONSUMIDOR_FINAL: readonly TipoIdentificacion[] =
  TIPOS_IDENTIFICACION.filter((tipo) => tipo.value !== "07");

export interface EstadoIdentificacion {
  valido: boolean;
  ayuda: string;
  contador: string | null;
  /** El formato es válido pero el dígito verificador no cuadra; no bloquea la emisión. */
  advertencia?: string;
}

function advertenciaVerificador(tipo: string, numero: string): string | undefined {
  const resultado = validarDigitoVerificador(tipo, numero);
  return resultado.valido ? undefined : `${resultado.mensaje} Revísalo antes de emitir.`;
}

export function validarIdentificacion(tipo: string, numero: string): EstadoIdentificacion {
  if (tipo === "04") {
    const valido = /^\d{13}$/.test(numero) && numero.endsWith("001");
    return {
      valido,
      ayuda: valido ? "RUC válido." : "13 dígitos, termina en 001.",
      contador: `${numero.length}/13`,
      advertencia: valido ? advertenciaVerificador(tipo, numero) : undefined,
    };
  }
  if (tipo === "05") {
    const valido = /^\d{10}$/.test(numero);
    return {
      valido,
      ayuda: valido ? "Cédula de 10 dígitos." : "Debe tener 10 dígitos.",
      contador: `${numero.length}/10`,
      advertencia: valido ? advertenciaVerificador(tipo, numero) : undefined,
    };
  }
  if (tipo === "06") {
    return { valido: numero.trim().length > 0, ayuda: "Número de pasaporte.", contador: null };
  }
  if (tipo === "07") {
    return { valido: numero === ID_CONSUMIDOR_FINAL, ayuda: "Consumidor final.", contador: null };
  }
  if (tipo === "08") {
    return { valido: numero.trim().length > 0, ayuda: "Identificación del exterior.", contador: null };
  }
  return { valido: false, ayuda: "Selecciona el tipo de identificación.", contador: null };
}

export function longitudMaxima(tipo: string): number {
  if (tipo === "04") return 13;
  if (tipo === "05") return 10;
  return 20;
}

export function esNumerica(tipo: string): boolean {
  return tipo === "04" || tipo === "05";
}
