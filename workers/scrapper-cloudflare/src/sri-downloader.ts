import { Page } from '@cloudflare/puppeteer';
import { SRI } from './types';
import { sanitizeFilename } from './utils';

export interface DownloadResult {
  success: boolean;
  nombre: string;
  xmlKey?: string;
  xmlBase64?: string;
  pdfKey?: string;
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

export async function downloadComprobante(
  page: Page,
  idx: number,
  nombre: string,
  r2Path: string,
  useR2: boolean,
  r2Bucket?: R2Bucket
): Promise<DownloadResult> {
  const safeName = sanitizeFilename(nombre || `Comprobante_${idx}`);
  const result: DownloadResult = { success: true, nombre: safeName };

  try {
    const xmlResult = await fetchFile(page, idx, 'xml');
    if (useR2 && r2Bucket) {
      const xmlKey = `${r2Path}/${safeName}.xml`;
      await r2Bucket.put(xmlKey, new Uint8Array(xmlResult.buffer), {
        httpMetadata: { contentType: 'application/xml' },
      });
      result.xmlKey = xmlKey;
    } else {
      result.xmlBase64 = bufferToBase64(xmlResult.buffer);
    }
  } catch (e: any) {
    result.error = `XML: ${e.message}`;
    result.success = false;
  }

  try {
    const pdfResult = await fetchFile(page, idx, 'pdf');
    if (useR2 && r2Bucket) {
      const pdfKey = `${r2Path}/${safeName}.pdf`;
      await r2Bucket.put(pdfKey, new Uint8Array(pdfResult.buffer), {
        httpMetadata: { contentType: 'application/pdf' },
      });
      result.pdfKey = pdfKey;
    } else {
      result.pdfBase64 = bufferToBase64(pdfResult.buffer);
    }
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
  const suffix = type === 'xml' ? SRI.SELECTORS.xmlSuffix : SRI.SELECTORS.pdfSuffix;
  const fileId = `${SRI.SELECTORS.idPrefix}:${idx}:${suffix}`;

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
