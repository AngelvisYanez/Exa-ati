import type { Page } from '@cloudflare/puppeteer';
import { SRI_RECIBIDOS } from './types';

export interface DownloadResult {
  success: boolean;
  nombre: string;
  xmlBase64?: string;
  pdfBase64?: string;
  error?: string;
}

function bufferToBase64(bytes: number[]): string {
  let binary = '';
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

function sanitizeFilename(name: string): string {
  return name
    .replace(/\s+/g, '_')
    .replace(/[^a-zA-Z0-9áéíóúÁÉÍÓÚñÑ\-_.]/g, '')
    .substring(0, 200);
}

export async function downloadComprobante(
  page: Page,
  idx: number,
  nombre: string,
): Promise<DownloadResult> {
  const safeName = sanitizeFilename(nombre || `Comprobante_${idx}`);
  const result: DownloadResult = { success: true, nombre: safeName };

  try {
    const xmlResult = await fetchFile(page, idx, 'xml');
    result.xmlBase64 = bufferToBase64(xmlResult.buffer);
  } catch (e: any) {
    result.error = `XML: ${e.message}`;
    result.success = false;
  }

  try {
    const pdfResult = await fetchFile(page, idx, 'pdf');
    result.pdfBase64 = bufferToBase64(pdfResult.buffer);
  } catch (e: any) {
    const pdfErr = `PDF: ${e.message}`;
    result.error = result.error ? `${result.error}; ${pdfErr}` : pdfErr;
  }

  return result;
}

interface FileResult {
  buffer: number[];
  contentType: string;
}

async function fetchFile(page: Page, idx: number, type: 'xml' | 'pdf'): Promise<FileResult> {
  const suffix = type === 'xml' ? SRI_RECIBIDOS.SELECTORS.xmlSuffix : SRI_RECIBIDOS.SELECTORS.pdfSuffix;
  const fileId = `${SRI_RECIBIDOS.SELECTORS.idPrefix}:${idx}:${suffix}`;

  return await page.evaluate(async (id: string, fileType: string) => {
    const link = document.getElementById(id) as HTMLAnchorElement;
    if (!link) throw new Error(`Botón ${fileType} #${id} no encontrado`);

    link.scrollIntoView({ block: 'center' });

    const url = link.href;
    const resp = await fetch(url);
    if (!resp.ok) throw new Error(`HTTP ${resp.status} al descargar ${fileType}`);

    const blob = await resp.blob();
    const buffer = await blob.arrayBuffer();
    return {
      buffer: Array.from(new Uint8Array(buffer)),
      contentType: resp.headers.get('content-type') || (fileType === 'xml' ? 'application/xml' : 'application/pdf'),
    };
  }, fileId, type);
}
