import { type SriMensaje } from './sri-soap-client';

export const SRI_ERROR_35 = '35';
export const SRI_ERROR_43 = '43';
export const SRI_ERROR_70 = '70';

export type SriErrorTipo =
  | 'DOCUMENTO_INVALIDO'
  | 'DUPLICADO'
  | 'EN_PROCESO'
  | 'RECHAZADO'
  | 'ERROR_CONEXION';

export type SriErrorAccion =
  | 'CORREGIR_XML'
  | 'CONSULTAR'
  | 'POLLING'
  | 'REINTENTAR'
  | 'BLOQUEAR';

export interface SriErrorClassification {
  tipo: SriErrorTipo;
  codigo: string;
  mensaje: string;
  informacionAdicional?: string;
  accion: SriErrorAccion;
}

const ERROR_MAP: Record<string, { tipo: SriErrorTipo; accion: SriErrorAccion; mensaje: string }> = {
  [SRI_ERROR_35]: {
    tipo: 'DOCUMENTO_INVALIDO',
    accion: 'CORREGIR_XML',
    mensaje: 'Documento inválido: la estructura del XML no pasa la validación contra los esquemas XSD del SRI.',
  },
  [SRI_ERROR_43]: {
    tipo: 'DUPLICADO',
    accion: 'CONSULTAR',
    mensaje: 'Clave de acceso registrada: el comprobante ya fue procesado anteriormente por el SRI.',
  },
  [SRI_ERROR_70]: {
    tipo: 'EN_PROCESO',
    accion: 'POLLING',
    mensaje: 'Clave de acceso en procesamiento: el SRI está procesando el comprobante. No generar una nueva clave.',
  },
};

export function classifySriError(
  mensajes: SriMensaje[],
  fase: 'recepcion' | 'autorizacion'
): SriErrorClassification | null {
  if (!mensajes || mensajes.length === 0) {
    return null;
  }

  for (const msg of mensajes) {
    const codigo = msg.identificador?.trim();
    const mapping = ERROR_MAP[codigo];

    if (mapping) {
      return {
        tipo: mapping.tipo,
        codigo,
        mensaje: msg.mensaje || mapping.mensaje,
        informacionAdicional: msg.informacionAdicional,
        accion: mapping.accion,
      };
    }
  }

  return null;
}

export function classifyAllSriErrors(
  mensajes: SriMensaje[],
  fase: 'recepcion' | 'autorizacion'
): SriErrorClassification[] {
  if (!mensajes || mensajes.length === 0) {
    return [];
  }

  const classified: SriErrorClassification[] = [];

  for (const msg of mensajes) {
    const codigo = msg.identificador?.trim();
    const mapping = ERROR_MAP[codigo];

    if (mapping) {
      classified.push({
        tipo: mapping.tipo,
        codigo,
        mensaje: msg.mensaje || mapping.mensaje,
        informacionAdicional: msg.informacionAdicional,
        accion: mapping.accion,
      });
    } else {
      classified.push({
        tipo: 'RECHAZADO',
        codigo: codigo || 'SIN_CODIGO',
        mensaje: msg.mensaje || 'Error desconocido del SRI',
        informacionAdicional: msg.informacionAdicional,
        accion: 'REINTENTAR',
      });
    }
  }

  return classified;
}

export function isSriErrorCode(
  mensajes: SriMensaje[],
  codigoBuscado: string
): boolean {
  return mensajes.some((m) => m.identificador?.trim() === codigoBuscado);
}
