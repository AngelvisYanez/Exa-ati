import { z } from 'zod';
import puppeteer from '@cloudflare/puppeteer';
import type { Page } from '@cloudflare/puppeteer';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { Env, TipoSync, TipoComprobante, TIPO_CODIGOS, TIPO_LABELS, SyncStats, ScrapedRow } from './types';
import { loginSri } from './sri-auth';
import {
  navigateToRecibidos,
  navigateToEmitidos,
  setFilters,
  clickConsultar,
  setMaxResultsPerPage,
  detectColumnHeaders,
  extractTableRows,
  hasNextPage,
  parseSriFloat,
  parseSriDate,
  extractRuc,
} from './sri-scraper';
import { downloadComprobante } from './sri-downloader';
import { createDb, NeonDb } from './db';

export function createServer(env: Env): McpServer {
  const server = new McpServer({
    name: 'SRI MCP Server',
    version: '1.0.0',
    description: 'Sincronización de comprobantes electrónicos del SRI (Ecuador)',
  });

  // ─── sri_login ───────────────────────────────────────────────────
  server.tool(
    'sri_login',
    'Autentica en el portal SRI con RUC y clave. Las cookies de sesión se persisten para llamadas posteriores.',
    {
      ruc: z.string().length(13).describe('RUC del contribuyente (13 dígitos)'),
      clave: z.string().min(1).describe('Clave del portal SRI'),
    },
    async ({ ruc, clave }) => {
      try {
        const browser = await puppeteer.launch(env.MYBROWSER);
        const page = await browser.newPage();
        await page.setViewport({ width: 1366, height: 768 });
        page.setDefaultTimeout(45000);

        await loginSri(page, ruc, clave);

        await browser.close();

        return {
          content: [{ type: 'text', text: JSON.stringify({ success: true, message: 'Login exitoso' }) }],
        };
      } catch (e: any) {
        return {
          content: [{ type: 'text', text: JSON.stringify({ success: false, error: e.message }) }],
          isError: true,
        };
      }
    },
  );

  // ─── sri_sync_recibidos ────────────────────────────────────────
  server.tool(
    'sri_sync_recibidos',
    'Busca y descarga comprobantes electrónicos RECIBIDOS del SRI para un mes y tipo específico. Guarda XML y RIDE en la base de datos.',
    {
      ruc: z.string().length(13).describe('RUC del contribuyente'),
      clave: z.string().min(1).describe('Clave del portal SRI'),
      year: z.number().int().min(2020).max(2030).describe('Año de consulta'),
      month: z.number().int().min(1).max(12).describe('Mes de consulta (1-12)'),
      tipo: z.enum(['factura', 'nota_credito', 'nota_debito', 'guia_remision', 'retencion', 'liquidacion'])
        .describe('Tipo de comprobante'),
    },
    async ({ ruc, clave, year, month, tipo }) => {
      const stats = await executeSync(env, ruc, clave, year, month, tipo, 'recibidos');
      return { content: [{ type: 'text', text: JSON.stringify(stats) }] };
    },
  );

  // ─── sri_sync_emitidos ──────────────────────────────────────────
  server.tool(
    'sri_sync_emitidos',
    'Busca y descarga comprobantes electrónicos EMITIDOS del SRI para un mes y tipo específico. Guarda XML y RIDE en la base de datos.',
    {
      ruc: z.string().length(13).describe('RUC del contribuyente'),
      clave: z.string().min(1).describe('Clave del portal SRI'),
      year: z.number().int().min(2020).max(2030).describe('Año de consulta'),
      month: z.number().int().min(1).max(12).describe('Mes de consulta (1-12)'),
      tipo: z.enum(['factura', 'nota_credito', 'nota_debito', 'guia_remision', 'retencion', 'liquidacion'])
        .describe('Tipo de comprobante'),
    },
    async ({ ruc, clave, year, month, tipo }) => {
      const stats = await executeSync(env, ruc, clave, year, month, tipo, 'emitidos');
      return { content: [{ type: 'text', text: JSON.stringify(stats) }] };
    },
  );

  // ─── sri_sync_all ──────────────────────────────────────────────
  server.tool(
    'sri_sync_all',
    'Sincronización COMPLETA: recorre todos los tipos de comprobante, ambos modos (recibidos y emitidos), día por día en el rango de fechas especificado.',
    {
      ruc: z.string().length(13).describe('RUC del contribuyente'),
      clave: z.string().min(1).describe('Clave del portal SRI'),
      yearStart: z.number().int().min(2020).max(2030).describe('Año inicial'),
      monthStart: z.number().int().min(1).max(12).describe('Mes inicial (1-12)'),
      yearEnd: z.number().int().min(2020).max(2030).describe('Año final'),
      monthEnd: z.number().int().min(1).max(12).describe('Mes final (1-12)'),
    },
    async ({ ruc, clave, yearStart, monthStart, yearEnd, monthEnd }) => {
      const allStats: SyncStats[] = [];
      const tipos: TipoComprobante[] = ['factura', 'nota_credito', 'nota_debito', 'retencion', 'liquidacion'];
      const modos: TipoSync[] = ['recibidos', 'emitidos'];

      for (const modo of modos) {
        for (const tipo of tipos) {
          let currentYear = yearStart;
          let currentMonth = monthStart;

          while (
            currentYear < yearEnd ||
            (currentYear === yearEnd && currentMonth <= monthEnd)
          ) {
            const stats = await executeSync(env, ruc, clave, currentYear, currentMonth, tipo, modo);
            allStats.push(stats);

            if (currentMonth === 12) {
              currentYear++;
              currentMonth = 1;
            } else {
              currentMonth++;
            }
          }
        }
      }

      const totalComprobantes = allStats.reduce((sum, s) => sum + s.total, 0);
      const totalErrores = allStats.reduce((sum, s) => sum + s.errores, 0);
      const totalXmls = allStats.reduce((sum, s) => sum + s.xmls, 0);
      const totalPdfs = allStats.reduce((sum, s) => sum + s.pdfs, 0);

      return {
        content: [{
          type: 'text',
          text: JSON.stringify({
            success: true,
            totalComprobantes,
            totalErrores,
            totalXmls,
            totalPdfs,
            detalle: allStats,
          }, null, 2),
        }],
      };
    },
  );

  // ─── sri_sync_status ───────────────────────────────────────────
  server.tool(
    'sri_sync_status',
    'Obtiene el estado actual de sesión y estadísticas de la última sincronización. No requiere parámetros.',
    {},
    async () => {
      return {
        content: [{
          type: 'text',
          text: JSON.stringify({
            success: true,
            message: 'MCP Server SRI activo',
            version: '1.0.0',
          }),
        }],
      };
    },
  );

  return server;
}

async function executeSync(
  env: Env,
  ruc: string,
  clave: string,
  year: number,
  month: number,
  tipo: TipoComprobante,
  mode: TipoSync,
): Promise<SyncStats> {
  const stats: SyncStats = {
    total: 0, nuevos: 0, existentes: 0, errores: 0,
    xmls: 0, pdfs: 0, modo: mode, periodo: `${year}-${String(month).padStart(2, '0')}`,
  };

  let db: NeonDb | null = null;
  if (env.DATABASE_URL) {
    try {
      db = createDb(env.DATABASE_URL);
    } catch (e: any) {
      console.error(`[Sync] Error creando DB: ${e.message}`);
    }
  }

  const tipoLabel = TIPO_LABELS[tipo];
  console.log(`[Sync] ${mode}: ${ruc} | ${year}-${String(month).padStart(2, '0')} | ${tipoLabel}`);

  let browser;
  try {
    browser = await puppeteer.launch(env.MYBROWSER);
    const page = await browser.newPage();

    await page.setViewport({ width: 1366, height: 768 });
    page.setDefaultTimeout(45000);

    await loginSri(page, ruc, clave);

    if (mode === 'emitidos') {
      await navigateToEmitidos(page);
    } else {
      await navigateToRecibidos(page);
    }

    await setFilters(page, year, month, tipo, mode);
    await clickConsultar(page, mode);
    await setMaxResultsPerPage(page, mode);
    await sleep(2000);

    const colIdx = await detectColumnHeaders(page);

    let pageNum = 1;
    let hasMore = true;

    while (hasMore) {
      console.log(`[Sync] Página ${pageNum}`);
      const rows = await extractTableRows(page, colIdx);

      for (const row of rows) {
        const existe = db ? await db.comprobanteExists(row.claveAcceso) : false;

        if (!existe) {
          let xmlBase64 = '';
          let pdfBase64 = '';

          try {
            const dlResult = await downloadComprobante(page, row.id, row.nombre);
            if (dlResult.xmlBase64) xmlBase64 = dlResult.xmlBase64;
            if (dlResult.pdfBase64) pdfBase64 = dlResult.pdfBase64;
            if (dlResult.success && dlResult.xmlBase64) stats.xmls++;
            if (dlResult.pdfBase64) stats.pdfs++;
          } catch (e: any) {
            console.error(`[Sync] Error descargando ${row.claveAcceso}: ${e.message}`);
          }

          if (db) {
            try {
              let xmlContent = '';
              if (xmlBase64) {
                const bytes = Uint8Array.from(atob(xmlBase64), c => c.charCodeAt(0));
                xmlContent = new TextDecoder().decode(bytes);
              }

              const saved = await db.saveComprobante({
                claveAcceso: row.claveAcceso,
                tipo: row.tipo || '01',
                emisorRuc: row.rucEmisor || '',
                emisorRazonSocial: row.razonSocial || row.nombre,
                fechaEmision: row.fechaEmision || row.fecha || null,
                xmlContent,
                pdfBase64,
                tenantId: env.TENANT_ID || null,
                receptorIdentificacion: ruc,
              });

              if (saved) {
                stats.nuevos++;
                console.log(`[Sync] Guardado: ${row.claveAcceso}`);
              }
            } catch (e: any) {
              console.error(`[Sync] Error DB ${row.claveAcceso}: ${e.message}`);
              stats.errores++;
            }
          }
        } else {
          stats.existentes++;
        }

        stats.total++;
      }

      hasMore = await hasNextPage(page, mode);
      pageNum++;
    }

    await browser.close();
  } catch (e: any) {
    console.error(`[Sync] Error: ${e.message}`);
    if (browser) {
      await browser.close().catch(() => {});
    }
    stats.errores++;
  }

  if (db) {
    await db.close();
  }

  console.log(`[Sync] Completado ${mode}/${tipoLabel}: ${stats.total} comprobantes, ${stats.xmls} XMLs, ${stats.pdfs} PDFs`);
  return stats;
}

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}
