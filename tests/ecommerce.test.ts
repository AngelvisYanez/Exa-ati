import { describe, it, expect } from 'vitest';
import { calcularEcommerceTotals } from '../src/lib/sri-api/ecommerce';

describe('calcularEcommerceTotals', () => {
  const defaultItem = (overrides: any = {}) => ({
    codigo: '001',
    descripcion: 'Producto',
    cantidad: 1,
    precioUnitario: 100,
    ivaPorcentaje: 12,
    ...overrides,
  });

  it('calcula totales con IVA 12%', () => {
    const result = calcularEcommerceTotals([defaultItem()]);
    expect(result.subtotalSinImpuesto).toBe(100);
    expect(result.totalIVA).toBe(12);
    expect(result.total).toBe(112);
  });

  it('calcula totales con IVA 0%', () => {
    const result = calcularEcommerceTotals([defaultItem({ ivaPorcentaje: 0 })]);
    expect(result.subtotalSinImpuesto).toBe(100);
    expect(result.totalIVA).toBe(0);
    expect(result.total).toBe(100);
  });

  it('maneja múltiples items con diferentes IVA', () => {
    const result = calcularEcommerceTotals([
      defaultItem({ codigo: '001', cantidad: 2, precioUnitario: 50, ivaPorcentaje: 12 }),
      defaultItem({ codigo: '002', cantidad: 1, precioUnitario: 30, ivaPorcentaje: 0 }),
    ]);
    expect(result.subtotalSinImpuesto).toBe(130);
    expect(result.totalIVA).toBe(12);
    expect(result.total).toBe(142);
  });

  it('aplica descuento por item', () => {
    const result = calcularEcommerceTotals([defaultItem({ descuento: 10 })]);
    expect(result.subtotalSinImpuesto).toBe(90);
    expect(result.totalDescuento).toBe(10);
    expect(result.totalIVA).toBeCloseTo(10.80);
    expect(result.total).toBeCloseTo(100.80);
  });

  it('aplica descuento global', () => {
    const result = calcularEcommerceTotals([defaultItem()], 10);
    expect(result.totalSinImpuesto).toBe(90);
    expect(result.total).toBe(102);
  });

  it('agrupa IVA desglosado por tarifa', () => {
    const result = calcularEcommerceTotals([
      defaultItem({ codigo: '001', cantidad: 2, precioUnitario: 100, ivaPorcentaje: 12 }),
      defaultItem({ codigo: '002', cantidad: 1, precioUnitario: 50, ivaPorcentaje: 0 }),
    ]);
    expect(result.ivaDesglosado).toHaveLength(2);
    const iva12 = result.ivaDesglosado.find(i => i.tarifa === 12)!;
    expect(iva12.baseImponible).toBe(200);
    expect(iva12.valor).toBe(24);
    const iva0 = result.ivaDesglosado.find(i => i.tarifa === 0)!;
    expect(iva0.baseImponible).toBe(50);
    expect(iva0.valor).toBe(0);
  });

  it('redondea a 2 decimales', () => {
    const result = calcularEcommerceTotals([defaultItem({ precioUnitario: 10.99, cantidad: 3 })]);
    expect(result.subtotalSinImpuesto).toBeCloseTo(32.97);
    expect(result.totalIVA).toBeCloseTo(3.96);
    expect(result.total).toBeCloseTo(36.93);
  });

  it('maneja items con descuento parcial y global combinados', () => {
    const result = calcularEcommerceTotals([
      defaultItem({ descuento: 5 }),
      defaultItem({ codigo: '002', precioUnitario: 50, ivaPorcentaje: 12 }),
    ], 10);
    expect(result.totalDescuento).toBe(5);
    expect(result.totalSinImpuesto).toBe(135);
    expect(result.total).toBeCloseTo(152.4);
  });
});
