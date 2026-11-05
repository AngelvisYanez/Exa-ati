import { Page, ElementHandle } from '@cloudflare/puppeteer';
import { SRI, TipoComprobante } from './types';
import { tipoToCode, sleep } from './utils';

export interface ScrapedRow {
  id: number;
  nombre: string;
  tipo: string;
  numero: string;
  claveAcceso: string;
  fecha: string;
}

export async function navigateToRecibidos(page: Page): Promise<void> {
  console.log('[Scraper] Abriendo menú Facturación Electrónica...');
  await page.waitForSelector(SRI.SELECTORS.btnFacturacion, { timeout: 15000 });
  await page.click(SRI.SELECTORS.btnFacturacion);
  await sleep(1000);

  console.log('[Scraper] Clic en Comprobantes electrónicos recibidos...');
  await page.waitForSelector(SRI.SELECTORS.linkRecibidos, { timeout: 15000 });
  await page.click(SRI.SELECTORS.linkRecibidos);

  await sleep(2000);

  if (page.url().includes('redireccion=57')) {
    await page.waitForSelector(SRI.SELECTORS.selectAno, { timeout: 15000 });
    console.log('[Scraper] Página de consulta cargada');
  } else {
    const pages = await page.browser().pages();
    if (pages.length > 1) {
      const lastPage = pages[pages.length - 1];
      if (lastPage.url() !== page.url()) {
        console.log('[Scraper] Cambiando a nueva pestaña');
        await lastPage.bringToFront();
        await lastPage.waitForSelector(SRI.SELECTORS.selectAno, { timeout: 15000 });
      }
    } else {
      await page.waitForSelector(SRI.SELECTORS.selectAno, { timeout: 15000 });
    }
  }
}

export async function setFilters(
  page: Page,
  year: number,
  month: number,
  tipo: TipoComprobante
): Promise<void> {
  const tipoCode = tipoToCode(tipo);
  console.log(`[Scraper] Filtros: año=${year}, mes=${month}, tipo=${tipo} (código=${tipoCode})`);

  await page.select(SRI.SELECTORS.selectAno, String(year));
  await sleep(300);
  await page.select(SRI.SELECTORS.selectMes, String(month));
  await sleep(300);
  await page.select(SRI.SELECTORS.selectDia, '0');
  await sleep(300);
  await page.select(SRI.SELECTORS.selectTipo, tipoCode);
  await sleep(300);
}

export async function clickConsultar(page: Page): Promise<void> {
  console.log('[Scraper] Click en Consultar...');
  const btn = await page.waitForSelector(SRI.SELECTORS.btnConsultar, { timeout: 10000 });
  if (!btn) throw new Error('Botón Consultar no encontrado');
  await btn.evaluate((el: any) => el.click());

  try {
    await page.waitForFunction(
      (id: string) => !!document.getElementById(id),
      { timeout: 20000 },
      `${SRI.SELECTORS.idPrefix}:0:${SRI.SELECTORS.xmlSuffix}`
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

export function setMaxResultsPerPage(page: Page): Promise<void> {
  return page.evaluate(() => {
    const select: any = document.querySelector(
      "td#frmPrincipal\\:tablaCompRecibidos_paginator_bottom select.ui-paginator-rpp-options"
    );
    if (!select) return;
    const options: any[] = Array.from(select.options);
    const maxOption = options.reduce((max: any, opt: any) =>
      parseInt(opt.value) > parseInt(max.value) ? opt : max
    );
    if (select.value !== maxOption.value) {
      select.value = maxOption.value;
      select.dispatchEvent(new Event('change', { bubbles: true }));
    }
  });
}

export async function extractTableRows(page: Page): Promise<ScrapedRow[]> {
  const rows: ScrapedRow[] = [];
  let idx = 0;

  while (true) {
    const xmlId = `${SRI.SELECTORS.idPrefix}:${idx}:${SRI.SELECTORS.xmlSuffix}`;
    const hasRow = await page.evaluate((id: string) => !!document.getElementById(id), xmlId);
    if (!hasRow) break;

    const nombre = await page.evaluate((id: string) => {
      const el = document.querySelector(`a[id='${id}']`)?.closest('tr');
      if (!el) return `Comprobante_${idx}`;
      const celda = el.querySelector('td:nth-child(3) div');
      return celda?.textContent?.trim().replace(/\s+/g, '_').replace(/[^a-zA-Z0-9áéíóúÁÉÍÓÚñÑ\-_.]/g, '') || `Comprobante_${idx}`;
    }, xmlId);

    const numero = await page.evaluate((id: string) => {
      const el = document.querySelector(`a[id='${id}']`)?.closest('tr');
      if (!el) return '';
      const celda = el.querySelector('td:nth-child(2) div');
      return celda?.textContent?.trim() || '';
    }, xmlId);

    const fecha = await page.evaluate((id: string) => {
      const el = document.querySelector(`a[id='${id}']`)?.closest('tr');
      if (!el) return '';
      const celda = el.querySelector('td:nth-child(4) div');
      return celda?.textContent?.trim() || '';
    }, xmlId);

    const claveAcceso = await page.evaluate((id: string) => {
      const el = document.querySelector(`a[id='${id}']`)?.closest('tr');
      if (!el) return '';
      const celda = el.querySelector('td:nth-child(5) div');
      return celda?.textContent?.trim() || '';
    }, xmlId);

    rows.push({ id: idx, nombre, tipo: '', numero, claveAcceso, fecha });
    idx++;
  }

  console.log(`[Scraper] ${rows.length} filas extraídas`);
  return rows;
}

export async function hasNextPage(page: Page): Promise<boolean> {
  const isDisabled = await page.evaluate(() => {
    const btn = document.querySelector(
      "td#frmPrincipal\\:tablaCompRecibidos_paginator_bottom span.ui-paginator-next"
    );
    return btn?.classList.contains('ui-state-disabled') ?? true;
  });

  if (isDisabled) return false;

  await page.evaluate(() => {
    const btn = document.querySelector(
      "td#frmPrincipal\\:tablaCompRecibidos_paginator_bottom span.ui-paginator-next"
    ) as HTMLElement;
    btn?.click();
  });

  try {
    await page.waitForFunction(
      (id: string) => !!document.getElementById(id),
      { timeout: 15000 },
      `${SRI.SELECTORS.idPrefix}:0:${SRI.SELECTORS.xmlSuffix}`
    );
    return true;
  } catch {
    return false;
  }
}
