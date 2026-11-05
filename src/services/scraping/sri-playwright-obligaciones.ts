import type { Page } from 'playwright';
import { db } from '@/services/sri-api/db';

const SRI_BASE = 'https://srienlinea.sri.gob.ec';
const PERFIL_URL = `${SRI_BASE}/sri-en-linea/contribuyente/perfil`;

export interface ObligacionScraped {
  tipo: string;
  periodo: number;
  descripcion: string;
  fechaVencimiento: string | null;
  estado: string;
}

function parsePeriodoFromText(text: string): number {
  const yyyymm = text.match(/(20\d{2})\s*[\/\-]?\s*(0[1-9]|1[0-2])/);
  if (yyyymm) return parseInt(`${yyyymm[1]}${yyyymm[2]}`, 10);
  const compact = text.match(/(20\d{2})(0[1-9]|1[0-2])/);
  if (compact) return parseInt(`${compact[1]}${compact[2]}`, 10);
  const now = new Date();
  return now.getFullYear() * 100 + (now.getMonth() + 1);
}

function parseDateIso(text: string): string | null {
  const m = text.match(/(\d{2})\/(\d{2})\/(\d{4})/);
  if (m) return `${m[3]}-${m[2]}-${m[1]}`;
  const iso = text.match(/(20\d{2})-(\d{2})-(\d{2})/);
  if (iso) return `${iso[1]}-${iso[2]}-${iso[3]}`;
  return null;
}

/**
 * Extrae obligaciones / vencimientos visibles tras login en el portal SRI.
 */
export async function scrapeObligacionesPortal(opts: {
  page: Page;
  tenantId: string;
  ruc: string;
  log: (msg: string) => Promise<void>;
}): Promise<ObligacionScraped[]> {
  const { page, tenantId, ruc, log } = opts;

  await log('Navegando a perfil / obligaciones del contribuyente...');
  await page.goto(PERFIL_URL, { waitUntil: 'domcontentloaded', timeout: 60000 }).catch(() => {});
  await page.waitForTimeout(2500);

  const oblLinks = [
    'a:has-text("Obligaciones")',
    'a:has-text("obligaciones tributarias")',
    'a[href*="obligacion"]',
    'a:has-text("Calendario")',
    'a:has-text("Vencimientos")',
  ];
  for (const sel of oblLinks) {
    const el = page.locator(sel).first();
    if (await el.isVisible().catch(() => false)) {
      await el.click().catch(() => {});
      await page.waitForTimeout(2500);
      break;
    }
  }

  const rawRows = await page.evaluate(() => {
    const rows: string[][] = [];
    document.querySelectorAll('table tr').forEach((tr) => {
      const cells = Array.from(tr.querySelectorAll('td')).map((td) => (td.textContent || '').trim());
      if (cells.length >= 2 && cells.some((c) => /IVA|ATS|Renta|Retenc|IESS|venc|declar/i.test(c))) {
        rows.push(cells);
      }
    });
    if (rows.length === 0) {
      document.querySelectorAll('li, .card, .obligacion, [class*="oblig"]').forEach((el) => {
        const t = (el as HTMLElement).innerText?.trim() || '';
        if (t.length > 10 && /IVA|ATS|Renta|venc/i.test(t)) rows.push([t]);
      });
    }
    return rows;
  });

  const obligaciones: ObligacionScraped[] = rawRows.map((cells) => {
    const text = cells.join(' | ');
    let tipo = 'OTRO';
    if (/IVA|104/i.test(text)) tipo = 'IVA';
    else if (/ATS/i.test(text)) tipo = 'ATS';
    else if (/Renta|103|101/i.test(text)) tipo = 'IR_ANUAL';
    else if (/Retenc/i.test(text)) tipo = 'RET_IR';
    else if (/IESS/i.test(text)) tipo = 'IESS';

    let estado = 'PENDIENTE';
    if (/cumpl|presentad|ok|pagad/i.test(text)) estado = 'CUMPLIDO';
    else if (/tard|vencid|mora/i.test(text)) estado = 'TARDIO';
    else if (/proceso/i.test(text)) estado = 'EN_PROCESO';

    return {
      tipo,
      periodo: parsePeriodoFromText(text),
      descripcion: text.slice(0, 480),
      fechaVencimiento: parseDateIso(text),
      estado,
    };
  });

  await log(`Obligaciones detectadas: ${obligaciones.length}`);

  for (const obl of obligaciones) {
    try {
      await db.query(
        `INSERT INTO obligaciones_externas (
           id, tenant_id, ruc, tipo, periodo, descripcion, fecha_vencimiento, estado, created_at, updated_at
         ) VALUES (
           gen_random_uuid(), $1, $2, $3, $4, $5, $6::date, $7, NOW(), NOW()
         )
         ON CONFLICT (tenant_id, ruc, tipo, periodo) DO UPDATE SET
           descripcion = EXCLUDED.descripcion,
           fecha_vencimiento = COALESCE(EXCLUDED.fecha_vencimiento, obligaciones_externas.fecha_vencimiento),
           estado = EXCLUDED.estado,
           updated_at = NOW()`,
        [tenantId, ruc, obl.tipo, obl.periodo, obl.descripcion, obl.fechaVencimiento, obl.estado]
      );
    } catch (e: any) {
      try {
        const existing = await db.queryOne(
          `SELECT id FROM obligaciones_externas WHERE tenant_id = $1 AND ruc = $2 AND tipo = $3 AND periodo = $4`,
          [tenantId, ruc, obl.tipo, obl.periodo]
        );
        if (existing) {
          await db.query(
            `UPDATE obligaciones_externas SET descripcion = $1, estado = $2, fecha_vencimiento = COALESCE($3, fecha_vencimiento), updated_at = NOW() WHERE id = $4`,
            [obl.descripcion, obl.estado, obl.fechaVencimiento, (existing as any).id]
          );
        } else {
          await db.query(
            `INSERT INTO obligaciones_externas (id, tenant_id, ruc, tipo, periodo, descripcion, fecha_vencimiento, estado, created_at, updated_at)
             VALUES (gen_random_uuid(), $1, $2, $3, $4, $5, $6, $7, NOW(), NOW())`,
            [tenantId, ruc, obl.tipo, obl.periodo, obl.descripcion, obl.fechaVencimiento, obl.estado]
          );
        }
      } catch (e2: any) {
        await log(`Error guardando obligación ${obl.tipo}/${obl.periodo}: ${e2.message}`);
      }
    }
  }

  return obligaciones;
}
