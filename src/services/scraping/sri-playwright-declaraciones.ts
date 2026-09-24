import type { Page } from 'playwright';
import { crearDocumento } from '@/services/control-tributario/services/documentos.service';

const SRI_BASE = 'https://srienlinea.sri.gob.ec';
const DECLARACIONES_URL = `${SRI_BASE}/sri-en-linea/contribuyente/declaraciones`;

export interface DeclaracionPresentada {
  formulario: string;
  periodo: string;
  fechaDeclaracion: string;
  valor: number;
  estado: string;
}

/**
 * Consulta declaraciones presentadas en el portal SRI (Playwright).
 * Persiste un resumen en documentos_fiscales (tipo DECLARACION).
 */
export async function scrapeDeclaracionesPresentadas(opts: {
  page: Page;
  tenantId: string | null;
  ruc: string;
  log: (msg: string) => Promise<void>;
  periodo?: number;
}): Promise<DeclaracionPresentada[]> {
  const { page, tenantId, ruc, log, periodo } = opts;

  await log('Navegando a Declaraciones (SRI En Línea)...');
  await page.goto(DECLARACIONES_URL, { waitUntil: 'domcontentloaded', timeout: 60000 }).catch(() => {});
  await page.waitForTimeout(3000);

  // Alternativas de menú / deep links
  const linkSelectors = [
    'a[href*="declaracion"]',
    'a:has-text("Declaraciones")',
    'a:has-text("Consulta de declaraciones")',
    'a:has-text("Declaraciones presentadas")',
  ];
  for (const sel of linkSelectors) {
    const el = page.locator(sel).first();
    if (await el.isVisible().catch(() => false)) {
      await el.click().catch(() => {});
      await page.waitForTimeout(2000);
      break;
    }
  }

  if (periodo) {
    const year = String(periodo).slice(0, 4);
    const month = String(periodo).slice(4, 6);
    await page.locator('select[id*="ano"], select[name*="anio"], select[id*="periodo"]').first()
      .selectOption({ label: year }).catch(async () => {
        await page.locator('select[id*="ano"]').first().selectOption(year).catch(() => {});
      });
    await page.locator('select[id*="mes"]').first().selectOption(month).catch(() => {});
    await page.waitForTimeout(500);
  }

  const consultar = page.locator(
    'button:has-text("Consultar"), input[value*="Consultar"], a:has-text("Consultar"), button[id*="btnConsultar"]'
  ).first();
  if (await consultar.isVisible().catch(() => false)) {
    const waitMs = Math.max(0, Number(process.env.SRI_CONSULTAR_WAIT_MS || 30000));
    if (waitMs > 0) {
      await log(`Esperando ${Math.round(waitMs / 1000)}s antes de consultar declaraciones...`);
      await page.waitForTimeout(waitMs);
    }
    await consultar.click({ force: true }).catch(() => {});
    await page.waitForTimeout(4000);
  }

  const rows = await page.evaluate(() => {
    const tables = Array.from(document.querySelectorAll('table'));
    const out: { formulario: string; periodo: string; fechaDeclaracion: string; valor: number; estado: string }[] = [];
    for (const table of tables) {
      const trs = Array.from(table.querySelectorAll('tbody tr, tr')).filter((tr) => {
        const t = (tr as HTMLElement).innerText || '';
        return /104|103|101|102|IVA|Renta|declar/i.test(t) && tr.querySelectorAll('td').length >= 3;
      });
      for (const tr of trs) {
        const celdas = Array.from(tr.querySelectorAll('td')).map((c) => (c.textContent || '').trim());
        if (celdas.length < 3) continue;
        const valorRaw = celdas.find((c) => /[\d.,]+/.test(c) && c.includes('.')) || celdas[3] || '0';
        out.push({
          formulario: celdas[0] || '',
          periodo: celdas[1] || '',
          fechaDeclaracion: celdas[2] || '',
          valor: parseFloat(valorRaw.replace(/[^0-9.,]/g, '').replace(',', '.')) || 0,
          estado: celdas[4] || celdas[celdas.length - 1] || '',
        });
      }
    }
    return out;
  });

  await log(`Declaraciones encontradas en portal: ${rows.length}`);

  if (tenantId && rows.length > 0) {
    const periodoDoc = periodo || Number(String(rows[0].periodo).replace(/\D/g, '').slice(0, 6)) || 0;
    try {
      await crearDocumento(tenantId, {
        periodo: periodoDoc || new Date().getFullYear() * 100 + (new Date().getMonth() + 1),
        nombre: `Declaraciones SRI ${ruc} (${rows.length})`,
        tipo: 'DECLARACION',
        modulo: 'SRI',
        categoria: 'CONSULTA_PORTAL',
        metadata: { ruc, declaraciones: rows.slice(0, 100) },
      });
      await log('Resumen de declaraciones guardado en documentos_fiscales');
    } catch (e: any) {
      await log(`No se pudo persistir declaraciones: ${e.message}`);
    }
  }

  return rows;
}
