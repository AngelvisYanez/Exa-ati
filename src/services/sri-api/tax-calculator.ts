export interface ComprobanteTaxRow {
  tipo?: string;
  tipo_comprobante?: string;
  emisor_ruc?: string;
  emisor_razon_social?: string;
  receptor_identificacion?: string;
  total_sin_impuesto?: number | string;
  total_sin_impuestos?: number | string;
  subtotal_sin_impuesto?: number | string;
  total_iva?: number | string;
  importe_total?: number | string;
  categoria?: string;
  estado?: string;
  clave_acceso?: string;
  secuencial?: string;
  fecha_emision?: string | Date;
}

function tipo(row: ComprobanteTaxRow): string {
  return row.tipo || row.tipo_comprobante || '';
}

function subtotal(row: ComprobanteTaxRow): number {
  return parseFloat(String(row.subtotal_sin_impuesto ?? row.total_sin_impuesto ?? row.total_sin_impuestos ?? 0)) || 0;
}

function iva(row: ComprobanteTaxRow): number {
  const explicit = parseFloat(String(row.total_iva ?? ''));
  if (!Number.isNaN(explicit) && explicit > 0) return explicit;
  const total = parseFloat(String(row.importe_total ?? 0)) || 0;
  return Math.max(0, total - subtotal(row));
}

export function calculateTaxSummary(comprobantes: ComprobanteTaxRow[], userRuc: string) {
  const compras = comprobantes.filter((c) => tipo(c) === '01' && c.emisor_ruc !== userRuc);
  const ventas = comprobantes.filter((c) => tipo(c) === '01' && c.emisor_ruc === userRuc);
  const retenciones = comprobantes.filter((c) => tipo(c) === '07');

  const comprasDeducibles = compras.filter((c) => c.categoria !== 'No deducible');
  const totalComprasSub = comprasDeducibles.reduce((s, c) => s + subtotal(c), 0);
  const totalComprasIva = comprasDeducibles.reduce((s, c) => s + iva(c), 0);
  const totalComprasImporte = comprasDeducibles.reduce(
    (s, c) => s + (parseFloat(String(c.importe_total ?? 0)) || 0),
    0
  );

  const totalVentasSub = ventas.reduce((s, c) => s + subtotal(c), 0);
  const totalVentasIva = ventas.reduce((s, c) => s + iva(c), 0);
  const totalVentasImporte = ventas.reduce(
    (s, c) => s + (parseFloat(String(c.importe_total ?? 0)) || 0),
    0
  );

  const totalRetencionesImporte = retenciones.reduce(
    (s, c) => s + (parseFloat(String(c.importe_total ?? 0)) || 0),
    0
  );

  const ivaAPagar = totalVentasIva - totalComprasIva - totalRetencionesImporte;

  return {
    compras,
    ventas,
    retenciones,
    comprasDeducibles,
    totalComprasSub,
    totalComprasIva,
    totalComprasImporte,
    totalVentasSub,
    totalVentasIva,
    totalVentasImporte,
    totalRetencionesImporte,
    ivaAPagar,
    ivaAPagarNeto: Math.max(0, ivaAPagar),
  };
}

function round2(n: number) {
  return Math.round(n * 100) / 100;
}

function monthKey(d: Date): string {
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
}

function parseEmision(val: string | Date | undefined): Date | null {
  if (!val) return null;
  const d = val instanceof Date ? val : new Date(val);
  return Number.isNaN(d.getTime()) ? null : d;
}

export type FiscalProjectionMonth = {
  periodo: string; // YYYY-MM
  label: string;
  ventasSub: number;
  comprasSub: number;
  ivaEstimado: number;
  utilidadEstimada: number;
  irEstimadoMensual: number;
};

export type FiscalProjection = {
  mesesHistoricosConDatos: number;
  mesesProyectados: number;
  promedioMensual: {
    ventasSub: number;
    comprasSub: number;
    iva: number;
    utilidad: number;
    ir: number;
  };
  meses: FiscalProjectionMonth[];
  totalesProximosMeses: {
    iva: number;
    ir: number;
    ventasSub: number;
    comprasSub: number;
  };
  metodo: string;
  advertencia: string;
};

/**
 * Proyecta IVA e IR aproximado a N meses usando el promedio de meses
 * históricos con comprobantes (mínimo 1). IR simplificado: 15% de la
 * utilidad bruta estimada (ventas − compras), prorrateado mensual.
 */
export function buildFiscalProjection(
  comprobantes: ComprobanteTaxRow[],
  userRuc: string,
  mesesAdelante = 3
): FiscalProjection {
  const monthsAhead = Math.min(Math.max(Math.round(mesesAdelante) || 3, 1), 12);
  const byMonth = new Map<
    string,
    { ventasSub: number; comprasSub: number; ventasIva: number; comprasIva: number; retenciones: number }
  >();

  for (const c of comprobantes) {
    const fecha = parseEmision(c.fecha_emision);
    if (!fecha) continue;
    const key = monthKey(fecha);
    const bucket = byMonth.get(key) || {
      ventasSub: 0,
      comprasSub: 0,
      ventasIva: 0,
      comprasIva: 0,
      retenciones: 0,
    };
    const t = tipo(c);
    if (t === '01' && c.emisor_ruc === userRuc) {
      bucket.ventasSub += subtotal(c);
      bucket.ventasIva += iva(c);
    } else if (t === '01' && c.emisor_ruc !== userRuc) {
      if (c.categoria !== 'No deducible') {
        bucket.comprasSub += subtotal(c);
        bucket.comprasIva += iva(c);
      }
    } else if (t === '07') {
      bucket.retenciones += parseFloat(String(c.importe_total ?? 0)) || 0;
    }
    byMonth.set(key, bucket);
  }

  const historicos = [...byMonth.entries()].sort((a, b) => a[0].localeCompare(b[0]));
  const nHist = Math.max(historicos.length, 1);

  let sumVentas = 0;
  let sumCompras = 0;
  let sumIva = 0;
  let sumUtil = 0;

  for (const [, b] of historicos) {
    const ivaMes = b.ventasIva - b.comprasIva - b.retenciones;
    const util = b.ventasSub - b.comprasSub;
    sumVentas += b.ventasSub;
    sumCompras += b.comprasSub;
    sumIva += ivaMes;
    sumUtil += util;
  }

  // Si no hay historial, usar totales globales del resumen
  if (historicos.length === 0) {
    const summary = calculateTaxSummary(comprobantes, userRuc);
    sumVentas = summary.totalVentasSub;
    sumCompras = summary.totalComprasSub;
    sumIva = summary.ivaAPagar;
    sumUtil = summary.totalVentasSub - summary.totalComprasSub;
  }

  const avgVentas = sumVentas / nHist;
  const avgCompras = sumCompras / nHist;
  const avgIva = sumIva / nHist;
  const avgUtil = sumUtil / nHist;
  // IR simplificado ~15% sobre utilidad positiva (orientativo, no tarifa oficial)
  const avgIr = Math.max(0, avgUtil) * 0.15;

  const now = new Date();
  const meses: FiscalProjectionMonth[] = [];
  for (let i = 1; i <= monthsAhead; i++) {
    const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + i, 1));
    const periodo = monthKey(d);
    const label = d.toLocaleDateString('es-EC', { month: 'long', year: 'numeric', timeZone: 'UTC' });
    meses.push({
      periodo,
      label: label.charAt(0).toUpperCase() + label.slice(1),
      ventasSub: round2(avgVentas),
      comprasSub: round2(avgCompras),
      ivaEstimado: round2(avgIva),
      utilidadEstimada: round2(avgUtil),
      irEstimadoMensual: round2(avgIr),
    });
  }

  return {
    mesesHistoricosConDatos: historicos.length,
    mesesProyectados: monthsAhead,
    promedioMensual: {
      ventasSub: round2(avgVentas),
      comprasSub: round2(avgCompras),
      iva: round2(avgIva),
      utilidad: round2(avgUtil),
      ir: round2(avgIr),
    },
    meses,
    totalesProximosMeses: {
      iva: round2(avgIva * monthsAhead),
      ir: round2(avgIr * monthsAhead),
      ventasSub: round2(avgVentas * monthsAhead),
      comprasSub: round2(avgCompras * monthsAhead),
    },
    metodo:
      historicos.length > 0
        ? `Promedio de ${historicos.length} mes(es) con comprobantes registrados`
        : 'Sin meses históricos fechados: se usó el acumulado disponible prorrateado a 1 mes',
    advertencia:
      'Estimación orientativa. No sustituye formularios 103/104 ni liquidación oficial de IR. El IR usa un 15% simplificado sobre utilidad (ventas − compras).',
  };
}

export function formatFiscalProjectionHtml(proj: FiscalProjection): { html: string; text: string } {
  const fmt = (n: number) =>
    n < 0 ? `-$${Math.abs(n).toFixed(2)}` : `$${n.toFixed(2)}`;

  const filas = proj.meses
    .map(
      (m) =>
        `<tr><td>${m.label}</td><td>${fmt(m.ventasSub)}</td><td>${fmt(m.comprasSub)}</td><td>${fmt(m.ivaEstimado)}</td><td>${fmt(m.irEstimadoMensual)}</td></tr>`
    )
    .join('');

  const html = `<strong>Proyección fiscal — próximos ${proj.mesesProyectados} meses</strong><br/>
<em>${proj.metodo}</em><br/><br/>
<strong>Promedio mensual estimado</strong><br/>
• Ventas (base): ${fmt(proj.promedioMensual.ventasSub)}<br/>
• Compras (base): ${fmt(proj.promedioMensual.comprasSub)}<br/>
• IVA (ventas − compras − retenciones): ${fmt(proj.promedioMensual.iva)}${proj.promedioMensual.iva < 0 ? ' (saldo a favor estimado)' : ''}<br/>
• IR simplificado (15% utilidad): ${fmt(proj.promedioMensual.ir)}<br/><br/>
<table>
<thead><tr><th>Mes</th><th>Ventas</th><th>Compras</th><th>IVA</th><th>IR</th></tr></thead>
<tbody>${filas}</tbody>
</table><br/>
<strong>Totales proyectados (${proj.mesesProyectados} meses)</strong><br/>
• IVA acumulado: ${fmt(proj.totalesProximosMeses.iva)}<br/>
• IR acumulado (simplificado): ${fmt(proj.totalesProximosMeses.ir)}<br/><br/>
<em>${proj.advertencia}</em>`;

  const text = `Proyección fiscal ${proj.mesesProyectados} meses. IVA mensual ${fmt(proj.promedioMensual.iva)}, IR mensual ${fmt(proj.promedioMensual.ir)}. Totales: IVA ${fmt(proj.totalesProximosMeses.iva)}, IR ${fmt(proj.totalesProximosMeses.ir)}. ${proj.advertencia}`;

  return { html, text };
}
