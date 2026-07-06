import { describe, it, expect } from 'vitest';
import { calculateTaxSummary } from '../src/lib/sri-api/tax-calculator';

describe('calculateTaxSummary', () => {
  const userRuc = '0999000000001';
  const defaultDoc = (overrides: any = {}) => ({
    tipo: '01',
    emisor_ruc: userRuc,
    total_sin_impuesto: 100,
    total_iva: 12,
    importe_total: 112,
    receptor_identificacion: '1710034065',
    estado: 'AUTORIZADO',
    ...overrides,
  });

  it('clasifica facturas como compras si emisor_ruc !== userRuc', () => {
    const result = calculateTaxSummary([defaultDoc({ emisor_ruc: '1790012344001' })], userRuc);
    expect(result.compras).toHaveLength(1);
    expect(result.ventas).toHaveLength(0);
    expect(result.retenciones).toHaveLength(0);
  });

  it('clasifica facturas como ventas si emisor_ruc === userRuc', () => {
    const result = calculateTaxSummary([defaultDoc({})], userRuc);
    expect(result.ventas).toHaveLength(1);
    expect(result.compras).toHaveLength(0);
  });

  it('clasifica tipo 07 como retenciones', () => {
    const result = calculateTaxSummary([defaultDoc({ tipo: '07', emisor_ruc: '1790012344001' })], userRuc);
    expect(result.retenciones).toHaveLength(1);
  });

  it('filtra compras no deducibles', () => {
    const deducible = defaultDoc({ emisor_ruc: '1790012344001', categoria: 'Deducible' });
    const noDeducible = defaultDoc({ emisor_ruc: '1790012344001', categoria: 'No deducible' });
    const result = calculateTaxSummary([deducible, noDeducible], userRuc);
    expect(result.comprasDeducibles).toHaveLength(1);
    expect(result.compras).toHaveLength(2);
  });

  it('calcula totales de compras', () => {
    const docs = [
      defaultDoc({ emisor_ruc: '1790012344001', total_sin_impuesto: 200, total_iva: 24, importe_total: 224 }),
      defaultDoc({ emisor_ruc: '1790012344001', total_sin_impuesto: 50, total_iva: 0, importe_total: 50 }),
    ];
    const result = calculateTaxSummary(docs, userRuc);
    expect(result.totalComprasSub).toBe(250);
    expect(result.totalComprasIva).toBe(24);
    expect(result.totalComprasImporte).toBe(274);
  });

  it('calcula totales de ventas', () => {
    const docs = [
      defaultDoc({ total_sin_impuesto: 500, total_iva: 60, importe_total: 560 }),
      defaultDoc({ total_sin_impuesto: 300, total_iva: 36, importe_total: 336 }),
    ];
    const result = calculateTaxSummary(docs, userRuc);
    expect(result.totalVentasSub).toBe(800);
    expect(result.totalVentasIva).toBe(96);
    expect(result.totalVentasImporte).toBe(896);
  });

  it('calcula IVA a pagar = ventasIVA - comprasIVA - retenciones', () => {
    const docs = [
      defaultDoc({ emisor_ruc: '1790012344001', total_iva: 12, importe_total: 112 }),
      defaultDoc({ total_iva: 24, importe_total: 224 }),
      defaultDoc({ tipo: '07', emisor_ruc: '1790012344001', importe_total: 5 }),
    ];
    const result = calculateTaxSummary(docs, userRuc);
    expect(result.ivaAPagar).toBe(24 - 12 - 5); // 7
    expect(result.ivaAPagarNeto).toBe(7);
  });

  it('ivaAPagarNeto nunca es negativo', () => {
    const docs = [
      defaultDoc({ emisor_ruc: '1790012344001', total_iva: 100, importe_total: 500 }),
      defaultDoc({ total_iva: 10, importe_total: 100 }),
    ];
    const result = calculateTaxSummary(docs, userRuc);
    expect(result.ivaAPagar).toBe(10 - 100);
    expect(result.ivaAPagarNeto).toBe(0);
  });

  it('maneja array vacío', () => {
    const result = calculateTaxSummary([], userRuc);
    expect(result.totalComprasSub).toBe(0);
    expect(result.totalVentasSub).toBe(0);
    expect(result.totalRetencionesImporte).toBe(0);
    expect(result.ivaAPagar).toBe(0);
  });

  it('maneja valores como string', () => {
    const doc = defaultDoc({ emisor_ruc: '1790012344001', total_sin_impuesto: '150.50', total_iva: '18.06', importe_total: '168.56' });
    const result = calculateTaxSummary([doc], userRuc);
    expect(result.totalComprasSub).toBeCloseTo(150.50);
    expect(result.totalComprasIva).toBeCloseTo(18.06);
  });

  it('usa total_sin_impuestos como fallback', () => {
    const doc = defaultDoc({ emisor_ruc: '1790012344001', total_sin_impuesto: undefined, total_sin_impuestos: 200, importe_total: 224 });
    const result = calculateTaxSummary([doc], userRuc);
    expect(result.totalComprasSub).toBe(200);
  });

  it('calcula IVA como importe_total - subtotal cuando total_iva es 0', () => {
    const doc = defaultDoc({ emisor_ruc: '1790012344001', total_iva: 0, importe_total: 130, total_sin_impuesto: 100 });
    const result = calculateTaxSummary([doc], userRuc);
    expect(result.totalComprasIva).toBe(30);
  });
});
