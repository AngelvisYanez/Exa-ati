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
