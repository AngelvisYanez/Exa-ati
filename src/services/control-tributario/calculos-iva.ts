import type { CalculoIVAResult, DatosForm104 } from './types'

const IVA_PORCENTAJE = 0.15 // IVA 15% vigente

export function calcularIVA(data: DatosForm104, creditoPendienteAnterior = 0): CalculoIVAResult {
  const totalVentas = data.ventasIva + data.ventas0
  const totalCompras = data.compras15 + data.compras0 + data.compras5 + data.compras8

  const ivaVentas = data.ventasIva * IVA_PORCENTAJE
  const ivaCompras = data.compras15 * IVA_PORCENTAJE
  const ivaActivos = data.activosFijos * IVA_PORCENTAJE
  const ivaImportaciones = data.importaciones * IVA_PORCENTAJE

  const ivaCausado = ivaVentas
  const creditoTributario = ivaCompras + ivaActivos + ivaImportaciones + creditoPendienteAnterior

  const ivaAPagar = Math.max(0, ivaCausado - creditoTributario)
  const creditoPendiente = Math.max(0, creditoTributario - ivaCausado)

  return {
    totalVentas,
    totalCompras,
    ivaCausado: Math.round(ivaCausado * 100) / 100,
    creditoTributario: Math.round(creditoTributario * 100) / 100,
    ivaAPagar: Math.round(ivaAPagar * 100) / 100,
    creditoPendiente: Math.round(creditoPendiente * 100) / 100,
  }
}
