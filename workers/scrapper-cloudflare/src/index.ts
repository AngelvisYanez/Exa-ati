import puppeteer from '@cloudflare/puppeteer';
import { Env, ScrapeRequest, ScrapeResponse, ComprobanteResult, ErrorItem } from './types';
import { loginSri } from './sri-auth';
import {
  navigateToRecibidos,
  setFilters,
  clickConsultar,
  setMaxResultsPerPage,
  extractTableRows,
  hasNextPage,
} from './sri-scraper';
import { downloadComprobante } from './sri-downloader';
import { pad, tipoToLabel } from './utils';
import { createDb, NeonDb } from './db';

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    if (request.method === 'OPTIONS') {
      return new Response(null, {
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'POST, OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type, Authorization',
        },
      });
    }

    if (request.method !== 'POST') {
      return Response.json({ success: false, error: 'Método no permitido' }, { status: 405 });
    }

    let body: ScrapeRequest;
    try {
      body = await request.json();
    } catch {
      return Response.json({ success: false, error: 'JSON inválido' }, { status: 400 });
    }

    const { ruc, clave, year, month, tipo } = body;

    if (!ruc || !clave || !year || month === undefined || !tipo) {
      return Response.json(
        { success: false, error: 'Faltan parámetros: ruc, clave, year, month, tipo' },
        { status: 400 }
      );
    }

    const startTime = Date.now();
    const comprobantes: ComprobanteResult[] = [];
    const errores: ErrorItem[] = [];
    const tipoLabel = tipoToLabel(tipo);
    let useR2 = false;
    let savedToNeon = false;
    let neonDb: NeonDb | null = null;

    if (env.DATABASE_URL) {
      try {
        neonDb = createDb(env.DATABASE_URL);
        savedToNeon = true;
        console.log(`[Worker] Neon DB activo`);
      } catch (e: any) {
        console.error(`[Worker] Error creando DB:`, e.message);
      }
    }

    if (!savedToNeon) {
      useR2 = env.R2_ENABLED === 'true' && !!env.SRI_BUCKET;
      console.log(`[Worker] R2=${useR2}, sin DB`);
    }

    console.log(`[Worker] Iniciando: ${ruc} | ${year}-${pad(month)} | ${tipoLabel}`);

    let browser;
    try {
      browser = await puppeteer.launch(env.MYBROWSER);
      const page = await browser.newPage();

      await page.setViewport({ width: 1366, height: 768 });
      page.setDefaultTimeout(45000);

      await loginSri(page, ruc, clave);
      await navigateToRecibidos(page);
      await setFilters(page, year, month, tipo);
      await clickConsultar(page);

      await setMaxResultsPerPage(page);
      await new Promise(r => setTimeout(r, 2000));

      let pageNum = 1;
      let hasMore = true;

      while (hasMore) {
        console.log(`[Worker] Página ${pageNum}`);
        const rows = await extractTableRows(page);

        for (const row of rows) {
          try {
            const r2Path = `sri-comprobantes/${year}-${pad(month)}`;
            const dlResult = await downloadComprobante(page, row.id, row.nombre, r2Path, useR2, env.SRI_BUCKET);

            // ─── Guardar a Neon si disponible ───
            if (savedToNeon && neonDb && row.claveAcceso) {
              let xmlContent = '';
              if (dlResult.xmlBase64) {
                try {
                  const bytes = Uint8Array.from(atob(dlResult.xmlBase64), c => c.charCodeAt(0));
                  xmlContent = new TextDecoder().decode(bytes);
                } catch {
                  xmlContent = '';
                }
              }

              const compId = await neonDb.saveComprobante({
                claveAcceso: row.claveAcceso,
                tipo: String(year),
                emisorRuc: '',
                emisorRazonSocial: row.nombre,
                fechaEmision: row.fecha || null,
                xmlContent,
                pdfBase64: dlResult.pdfBase64 || '',
                tenantId: env.TENANT_ID || null,
                receptorIdentificacion: ruc,
              });

              if (compId) {
                delete dlResult.xmlBase64;
                delete dlResult.pdfBase64;
                console.log(`[Worker] Guardado en DB: ${row.claveAcceso}`);
              } else {
                console.log(`[Worker] DB falló, incluyendo base64: ${row.claveAcceso}`);
              }
            }

            const comp: ComprobanteResult = {
              nombre: dlResult.nombre,
              razonSocialEmisor: row.nombre,
              numero: row.numero,
              fecha: row.fecha,
              tipo: tipoLabel,
              claveAcceso: row.claveAcceso,
            };
            if (dlResult.xmlKey) comp.xmlKey = dlResult.xmlKey;
            if (dlResult.xmlBase64) comp.xmlBase64 = dlResult.xmlBase64;
            if (dlResult.pdfKey) comp.pdfKey = dlResult.pdfKey;
            if (dlResult.pdfBase64) comp.pdfBase64 = dlResult.pdfBase64;
            comprobantes.push(comp);

            if (!dlResult.success) {
              errores.push({ fila: String(row.id), error: dlResult.error || 'Error desconocido' });
            }
          } catch (e: any) {
            errores.push({ fila: String(row.id), error: e.message });
          }
        }

        hasMore = await hasNextPage(page);
        pageNum++;
      }

      await browser.close();
    } catch (e: any) {
      console.error(`[Worker] Error: ${e.message}`);
      if (browser) {
        await browser.close().catch(() => {});
      }
      const response: ScrapeResponse = {
        success: false,
        periodo: `${year}-${pad(month)}`,
        tipo: tipoLabel,
        comprobantes,
        total: comprobantes.length,
        descargados: comprobantes.length,
        errores,
        browserTimeUsed: (Date.now() - startTime) / 1000,
        error: e.message,
        savedToNeon,
      };
      return Response.json(response, {
        headers: { 'Access-Control-Allow-Origin': '*' },
      });
    }

    const response: ScrapeResponse = {
      success: true,
      periodo: `${year}-${pad(month)}`,
      tipo: tipoLabel,
      comprobantes,
      total: comprobantes.length,
      descargados: comprobantes.length,
      errores,
      browserTimeUsed: (Date.now() - startTime) / 1000,
      savedToNeon,
    };

    console.log(`[Worker] Completado: ${comprobantes.length} comprobantes en ${response.browserTimeUsed.toFixed(1)}s`);

    return Response.json(response, {
      headers: { 'Access-Control-Allow-Origin': '*' },
    });
  },
};
