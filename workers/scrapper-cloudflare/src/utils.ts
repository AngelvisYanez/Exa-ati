import { TipoComprobante, TIPO_CODIGOS, TIPO_LABELS } from './types';

export function pad(n: number): string {
  return n.toString().padStart(2, '0');
}

export function tipoToCode(tipo: TipoComprobante): string {
  return TIPO_CODIGOS[tipo];
}

export function tipoToLabel(tipo: TipoComprobante): string {
  return TIPO_LABELS[tipo];
}

export function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

export function sanitizeFilename(name: string): string {
  return name
    .replace(/\s+/g, '_')
    .replace(/[^a-zA-Z0-9áéíóúÁÉÍÓÚñÑ\-_.]/g, '')
    .substring(0, 200);
}
