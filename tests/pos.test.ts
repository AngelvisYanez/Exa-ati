import { describe, it, expect } from 'vitest'
import { calcularPosTotals, PosSaleItem } from '../src/services/sri-api/pos'

describe('calcularPosTotals', () => {
  it('single item with 12% IVA', () => {
    const items: PosSaleItem[] = [
      { codigo: '001', descripcion: 'Producto', cantidad: 1, precioUnitario: 100, ivaPorcentaje: 12 },
    ]
    const result = calcularPosTotals(items)
    expect(result.subtotalSinImpuesto).toBe(100)
    expect(result.totalIVA).toBe(12)
    expect(result.total).toBe(112)
  })

  it('multiple items with different IVA rates', () => {
    const items: PosSaleItem[] = [
      { codigo: '001', descripcion: 'A', cantidad: 1, precioUnitario: 100, ivaPorcentaje: 12 },
      { codigo: '002', descripcion: 'B', cantidad: 1, precioUnitario: 200, ivaPorcentaje: 14 },
      { codigo: '003', descripcion: 'C', cantidad: 1, precioUnitario: 50, ivaPorcentaje: 15 },
    ]
    const result = calcularPosTotals(items)
    expect(result.ivaDesglosado).toHaveLength(3)
    const iv12 = result.ivaDesglosado.find((d) => d.tarifa === 12)!
    const iv14 = result.ivaDesglosado.find((d) => d.tarifa === 14)!
    const iv15 = result.ivaDesglosado.find((d) => d.tarifa === 15)!
    expect(iv12.baseImponible).toBe(100)
    expect(iv12.valor).toBe(12)
    expect(iv14.baseImponible).toBe(200)
    expect(iv14.valor).toBe(28)
    expect(iv15.baseImponible).toBe(50)
    expect(iv15.valor).toBe(7.5)
  })

  it('items with 0% IVA', () => {
    const items: PosSaleItem[] = [
      { codigo: '001', descripcion: 'Exento', cantidad: 1, precioUnitario: 100, ivaPorcentaje: 0 },
    ]
    const result = calcularPosTotals(items)
    expect(result.subtotalSinImpuesto).toBe(100)
    expect(result.totalIVA).toBe(0)
    expect(result.ivaDesglosado).toHaveLength(1)
    expect(result.ivaDesglosado[0].tarifa).toBe(0)
    expect(result.ivaDesglosado[0].valor).toBe(0)
  })

  it('items with discounts', () => {
    const items: PosSaleItem[] = [
      { codigo: '001', descripcion: 'Prod', cantidad: 2, precioUnitario: 100, ivaPorcentaje: 12, descuento: 20 },
    ]
    const result = calcularPosTotals(items)
    expect(result.subtotalSinImpuesto).toBe(180)
    expect(result.totalDescuento).toBe(20)
    expect(result.totalIVA).toBe(21.6)
    expect(result.total).toBe(201.6)
  })

  it('global discount', () => {
    const items: PosSaleItem[] = [
      { codigo: '001', descripcion: 'Prod', cantidad: 1, precioUnitario: 100, ivaPorcentaje: 12 },
    ]
    const result = calcularPosTotals(items, 10)
    expect(result.totalSinImpuesto).toBe(90)
    expect(result.totalIVA).toBe(12)
    expect(result.total).toBe(102)
  })

  it('propina is added to total', () => {
    const items: PosSaleItem[] = [
      { codigo: '001', descripcion: 'Prod', cantidad: 1, precioUnitario: 100, ivaPorcentaje: 12 },
    ]
    const result = calcularPosTotals(items, 0, 5)
    expect(result.total).toBe(117)
  })

  it('empty items array returns all zeros', () => {
    const result = calcularPosTotals([])
    expect(result.subtotalSinImpuesto).toBe(0)
    expect(result.totalDescuento).toBe(0)
    expect(result.totalSinImpuesto).toBe(0)
    expect(result.totalIVA).toBe(0)
    expect(result.total).toBe(0)
    expect(result.ivaDesglosado).toHaveLength(0)
  })

  it('floating point rounding with .toFixed(2) behavior', () => {
    const items: PosSaleItem[] = [
      { codigo: '001', descripcion: 'Prod', cantidad: 3, precioUnitario: 10.55, ivaPorcentaje: 12 },
    ]
    const result = calcularPosTotals(items)
    expect(result.subtotalSinImpuesto).toBe(31.65)
    expect(result.totalIVA).toBe(3.8)
    expect(result.total).toBe(35.45)
  })

  it('combines multiple items with same IVA rate', () => {
    const items: PosSaleItem[] = [
      { codigo: '001', descripcion: 'A', cantidad: 1, precioUnitario: 100, ivaPorcentaje: 12 },
      { codigo: '002', descripcion: 'B', cantidad: 1, precioUnitario: 50, ivaPorcentaje: 12 },
    ]
    const result = calcularPosTotals(items)
    expect(result.ivaDesglosado).toHaveLength(1)
    expect(result.ivaDesglosado[0].baseImponible).toBe(150)
    expect(result.ivaDesglosado[0].valor).toBe(18)
    expect(result.totalIVA).toBe(18)
  })
})
