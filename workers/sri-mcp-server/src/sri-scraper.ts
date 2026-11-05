import type { Page } from '@cloudflare/puppeteer';
import { SRI_RECIBIDOS, SRI_EMITIDOS, TipoSync, TIPO_CODIGOS, TipoComprobante } from './types';

export interface ScrapedRow {
  id: number;
  nombre: string;
  tipo: string;
  numero: string;
  claveAcceso: string;
  fecha: string;
  rucEmisor?: string;
  razonSocial?: string;
  importeTotal?: number;
  subtotal?: number;
  iva?: number;
  fechaEmision?: string;
  fechaAutorizacion?: string;
}

export interface ColumnIndices {
  tipo: number;
  rucEmisor: number;
  emisor: number;
  clave: number;
  fechaAutorizacion: number;
  fechaEmision: number;
  subtotal: number;
  iva: number;
  total: number;
  serie: number;
  secuencial: number;
  relacionados: number;
}

const FALLBACK_COLUMNS: ColumnIndices = {
  tipo: 1, rucEmisor: 2, emisor: 3, clave: 4,
  fechaAutorizacion: 5, fechaEmision: -1,
  subtotal: -1, iva: -1, total: -1,
  serie: -1, secuencial: -1, relacionados: -1,
};

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

export async function navigateToRecibidos(page: Page): Promise<void> {
  console.log('[Scraper] Abriendo menú Facturación Electrónica...');
  await page.waitForSelector(SRI_RECIBIDOS.SELECTORS.btnFacturacion, { timeout: 15000 });
  await page.click(SRI_RECIBIDOS.SELECTORS.btnFacturacion);
  await sleep(1000);

  console.log('[Scraper] Clic en Comprobantes electrónicos recibidos...');
  await page.waitForSelector(SRI_RECIBIDOS.SELECTORS.linkRecibidos, { timeout: 15000 });
  await page.click(SRI_RECIBIDOS.SELECTORS.linkRecibidos);
  await sleep(2000);

  if (page.url().includes('redireccion=57')) {
    await page.waitForSelector(SRI_RECIBIDOS.SELECTORS.selectAno, { timeout: 15000 });
    console.log('[Scraper] Página de consulta recibidos cargada');
  } else {
    const pages = await page.browser().pages();
    if (pages.length > 1) {
      const lastPage = pages[pages.length - 1];
      if (lastPage.url() !== page.url()) {
        console.log('[Scraper] Cambiando a nueva pestaña');
        await lastPage.bringToFront();
        await lastPage.waitForSelector(SRI_RECIBIDOS.SELECTORS.selectAno, { timeout: 15000 });
      }
    } else {
      await page.waitForSelector(SRI_RECIBIDOS.SELECTORS.selectAno, { timeout: 15000 });
    }
  }
}

export async function navigateToEmitidos(page: Page): Promise<void> {
  console.log('[Scraper] Abriendo menú Facturación Electrónica...');
  await page.waitForSelector(SRI_RECIBIDOS.SELECTORS.btnFacturacion, { timeout: 15000 });
  await page.click(SRI_RECIBIDOS.SELECTORS.btnFacturacion);
  await sleep(1000);

  console.log('[Scraper] Clic en Comprobantes electrónicos emitidos...');
  await page.waitForSelector(SRI_EMITIDOS.SELECTORS.linkEmitidos, { timeout: 15000 });
  await page.click(SRI_EMITIDOS.SELECTORS.linkEmitidos);
  await sleep(2000);

  if (page.url().includes('redireccion=56')) {
    await page.waitForSelector(SRI_EMITIDOS.SELECTORS.selectAno, { timeout: 15000 });
    console.log('[Scraper] Página de consulta emitidos cargada');
  } else {
    const pages = await page.browser().pages();
    if (pages.length > 1) {
      const lastPage = pages[pages.length - 1];
      if (lastPage.url() !== page.url()) {
        console.log('[Scraper] Cambiando a nueva pestaña');
        await lastPage.bringToFront();
        await lastPage.waitForSelector(SRI_EMITIDOS.SELECTORS.selectAno, { timeout: 15000 });
      }
    } else {
      await page.waitForSelector(SRI_EMITIDOS.SELECTORS.selectAno, { timeout: 15000 });
    }
  }
}

export async function setFilters(
  page: Page,
  year: number,
  month: number,
  tipo: TipoComprobante,
  mode: TipoSync = 'recibidos',
): Promise<void> {
  const selectors = mode === 'emitidos' ? SRI_EMITIDOS.SELECTORS : SRI_RECIBIDOS.SELECTORS;
  const tipoCode = TIPO_CODIGOS[tipo];
  console.log(`[Scraper] Filtros: año=${year}, mes=${month}, tipo=${tipo} (código=${tipoCode})`);

  await page.select(selectors.selectAno, String(year));
  await sleep(300);
  await page.select(selectors.selectMes, String(month));
  await sleep(300);
  await page.select(selectors.selectDia, '0');
  await sleep(300);
  await page.select(selectors.selectTipo, tipoCode);
  await sleep(300);
}

export async function clickConsultar(page: Page, mode: TipoSync = 'recibidos'): Promise<void> {
  const btnSelector = mode === 'emitidos'
    ? SRI_EMITIDOS.SELECTORS.btnConsultar
    : SRI_RECIBIDOS.SELECTORS.btnConsultar;
  const idPrefix = mode === 'emitidos'
    ? SRI_EMITIDOS.SELECTORS.idPrefix
    : SRI_RECIBIDOS.SELECTORS.idPrefix;

  console.log('[Scraper] Click en Consultar...');
  const btn = await page.waitForSelector(btnSelector, { timeout: 10000 });
  if (!btn) throw new Error('Botón Consultar no encontrado');
  await btn.evaluate((el: any) => el.click());

  try {
    await page.waitForFunction(
      (id: string) => !!document.getElementById(id),
      { timeout: 20000 },
      `${idPrefix}:0:${SRI_RECIBIDOS.SELECTORS.xmlSuffix}`,
    );
    console.log('[Scraper] Tabla cargada');
  } catch {
    const warnMsg = await page.evaluate(() => {
      const el = document.querySelector('#formMessages\\:messages .ui-messages-warn-summary');
      return el?.textContent || null;
    });
    if (warnMsg && warnMsg.includes('No se encontraron')) {
      console.log(`[Scraper] Sin resultados: ${warnMsg}`);
      return;
    }
    console.log('[Scraper] Tabla puede estar vacía, continuando...');
  }
}

export async function setMaxResultsPerPage(page: Page, mode: TipoSync = 'recibidos'): Promise<void> {
  const tableId = mode === 'emitidos' ? SRI_EMITIDOS.SELECTORS.tableId : SRI_RECIBIDOS.SELECTORS.tableId;
  await page.evaluate(
    (tid: string) => {
      const select: any = document.querySelector(
        `td#${tid}_paginator_bottom select.ui-paginator-rpp-options`,
      );
      if (!select) return;
      const options: any[] = Array.from(select.options);
      const maxOption = options.reduce((max: any, opt: any) =>
        parseInt(opt.value) > parseInt(max.value) ? opt : max,
      );
      if (select.value !== maxOption.value) {
        select.value = maxOption.value;
        select.dispatchEvent(new Event('change', { bubbles: true }));
      }
    },
    tableId,
  );
}

export async function detectColumnHeaders(page: Page): Promise<ColumnIndices> {
  try {
    const detected = await page.evaluate(() => {
      const selectors = [
        '#frmPrincipal\\:tablaCompRecibidos thead th',
        '#frmPrincipal\\:tablaCompRecibidos tr.rf-dt-shdr th',
        '#frmPrincipal\\:tablaCompRecibidos .rf-dt-shdr th',
      ];
      for (const sel of selectors) {
        const ths = Array.from(document.querySelectorAll(sel));
        if (ths.length < 3) continue;
        const texts = ths.map(th => (th as HTMLElement).innerText.trim().toUpperCase());
        const hasRuc = texts.some(t => t.includes('RUC'));
        const hasClave = texts.some(t => t.includes('CLAVE') || t.includes('ACCESO'));
        if (!hasRuc && !hasClave) continue;

        return {
          tipo: texts.findIndex(t => t.includes('TIPO') || t.includes('COMPROBANTE')),
          rucEmisor: texts.findIndex(t => t.includes('RUC')),
          emisor: texts.findIndex(t => t.includes('RAZON') || t.includes('RAZÓN') || t.includes('SOCIAL') || t.includes('NOMBRE')),
          serie: texts.findIndex(t => t.includes('SERIE')),
          secuencial: texts.findIndex(t => t.includes('SECUENCIAL') || t.includes('NÚMERO') || t.includes('NUMERO')),
          clave: texts.findIndex(t => t.includes('CLAVE') || t.includes('ACCESO') || t.includes('AUTORIZA')),
          fechaAutorizacion: texts.findIndex(t => t.includes('FECHA') && (t.includes('AUTORIZA') || t.includes('HORA'))),
          fechaEmision: texts.findIndex(t => t.includes('FECHA') && (t.includes('EMISIO') || t.includes('EMISIÓN'))),
          subtotal: texts.findIndex(t => t.includes('SIN') || t.includes('SUBTOTAL') || t.includes('NETO') || t.includes('BASE')),
          iva: texts.findIndex(t => t === 'IVA' || t.includes('I.V.A.')),
          total: texts.findIndex(t => t.includes('TOTAL') || t.includes('IMPORTE') || t.includes('VALOR')),
          relacionados: texts.findIndex(t => t.includes('MODIFICADO') || t.includes('SUSTENTO') || t.includes('RELACIONADO')),
        };
      }
      return null;
    });
    if (detected && (detected.clave !== -1 || detected.rucEmisor !== -1)) {
      return detected;
    }
  } catch {}
  return FALLBACK_COLUMNS;
}

export async function extractTableRows(page: Page, colIdx: ColumnIndices): Promise<ScrapedRow[]> {
  const rows: ScrapedRow[] = [];

  const rowsData = await page.evaluate(() => {
    const allRows = Array.from(document.querySelectorAll(
      '#frmPrincipal\\:tablaCompRecibidos tr, [id*="tablaCompRecibidos"] tr',
    ));
    return allRows
      .filter(tr => (tr as HTMLElement).innerText.match(/\d{49}/))
      .map((tr, idx) => {
        const cells = (tr as HTMLElement).querySelectorAll('td');
        const cellTexts = Array.from(cells).map(c => (c as HTMLElement).innerText.trim());
        return { index: idx, textos: cellTexts };
      });
  });

  for (const row of rowsData) {
    const textos = row.textos;
    const rawClave = (colIdx.clave !== -1 && colIdx.clave < textos.length) ? textos[colIdx.clave] : '';
    const claveAcceso = rawClave.match(/\d{49}/)?.[0];
    if (!claveAcceso) continue;

    const rucEmisor = (colIdx.rucEmisor !== -1 && colIdx.rucEmisor < textos.length) ? textos[colIdx.rucEmisor] : null;
    const emisor = (colIdx.emisor !== -1 && colIdx.emisor < textos.length) ? textos[colIdx.emisor] : null;
    const rawTipo = (colIdx.tipo !== -1 && colIdx.tipo < textos.length) ? textos[colIdx.tipo].toUpperCase() : '';
    const tipoCode = getTipoCode(rawTipo);
    const rawTotal = (colIdx.total !== -1 && colIdx.total < textos.length) ? textos[colIdx.total] : '';
    const rawSubtotal = (colIdx.subtotal !== -1 && colIdx.subtotal < textos.length) ? textos[colIdx.subtotal] : '';
    const rawIva = (colIdx.iva !== -1 && colIdx.iva < textos.length) ? textos[colIdx.iva] : '';
    const rawFechaEmision = (colIdx.fechaEmision !== -1 && colIdx.fechaEmision < textos.length) ? textos[colIdx.fechaEmision] : null;
    const rawFechaAutorizacion = (colIdx.fechaAutorizacion !== -1 && colIdx.fechaAutorizacion < textos.length) ? textos[colIdx.fechaAutorizacion] : null;

    rows.push({
      id: row.index,
      nombre: emisor || `Comprobante_${row.index}`,
      tipo: tipoCode,
      numero: '',
      claveAcceso,
      fecha: rawFechaAutorizacion || rawFechaEmision || '',
      rucEmisor: rucEmisor || undefined,
      razonSocial: emisor || undefined,
      importeTotal: parseSriFloat(rawTotal),
      subtotal: parseSriFloat(rawSubtotal),
      iva: parseSriFloat(rawIva),
      fechaEmision: rawFechaEmision ? parseSriDate(rawFechaEmision) : undefined,
      fechaAutorizacion: rawFechaAutorizacion ? parseSriDate(rawFechaAutorizacion) : undefined,
    });
  }

  console.log(`[Scraper] ${rows.length} filas extraídas con detección dinámica de columnas`);
  return rows;
}

export async function hasNextPage(page: Page, mode: TipoSync = 'recibidos'): Promise<boolean> {
  const tableId = mode === 'emitidos' ? SRI_EMITIDOS.SELECTORS.tableId : SRI_RECIBIDOS.SELECTORS.tableId;
  const idPrefix = mode === 'emitidos' ? SRI_EMITIDOS.SELECTORS.idPrefix : SRI_RECIBIDOS.SELECTORS.idPrefix;

  const isDisabled = await page.evaluate(
    (tid: string) => {
      const btn = document.querySelector(
        `td#${tid}_paginator_bottom span.ui-paginator-next`,
      );
      return btn?.classList.contains('ui-state-disabled') ?? true;
    },
    tableId,
  );

  if (isDisabled) return false;

  await page.evaluate(
    (tid: string) => {
      const btn = document.querySelector(
        `td#${tid}_paginator_bottom span.ui-paginator-next`,
      ) as HTMLElement;
      btn?.click();
    },
    tableId,
  );

  try {
    await page.waitForFunction(
      (id: string) => !!document.getElementById(id),
      { timeout: 15000 },
      `${idPrefix}:0:${SRI_RECIBIDOS.SELECTORS.xmlSuffix}`,
    );
    return true;
  } catch {
    return false;
  }
}

export function parseSriFloat(val: any): number | undefined {
  if (val === undefined || val === null) return undefined;
  let clean = String(val).replace(/[^\d.,\-]/g, '').trim();
  if (!clean) return undefined;

  const hasComma = clean.includes(',');
  const hasDot = clean.includes('.');

  if (hasComma && hasDot) {
    if (clean.indexOf(',') > clean.indexOf('.')) {
      clean = clean.replace(/\./g, '').replace(',', '.');
    } else {
      clean = clean.replace(/,/g, '');
    }
  } else if (hasComma) {
    clean = clean.replace(',', '.');
  }

  const num = parseFloat(clean);
  return isNaN(num) ? undefined : num;
}

export function parseSriDate(dateStr: string | null): string | undefined {
  if (!dateStr) return undefined;
  const parts = dateStr.match(/(\d{2})\/(\d{2})\/(\d{4})/);
  if (parts) return `${parts[3]}-${parts[2]}-${parts[1]}`;
  return undefined;
}

export function extractRuc(val: any): string | null {
  if (val === undefined || val === null) return null;
  const match = String(val).match(/\d{13}/);
  return match ? match[0] : null;
}

function getTipoCode(rawTipo: string): string {
  const tipoMap: Record<string, string> = {
    'FACTURA': '01',
    'LIQUIDACIÓN': '03',
    'LIQUIDACION': '03',
    'NOTA DE CRÉDITO': '04',
    'NOTA DE CREDITO': '04',
    'NOTA DE DÉBITO': '05',
    'NOTA DE DEBITO': '05',
    'COMPROBANTE DE RETENCIÓN': '06',
    'COMPROBANTE DE RETENCION': '06',
    'GUÍA DE REMISIÓN': '06',
    'GUIA DE REMISION': '06',
  };
  for (const [key, code] of Object.entries(tipoMap)) {
    if (rawTipo.includes(key)) return code;
  }
  return '01';
}
