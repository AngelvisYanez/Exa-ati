import { db } from './db'

export type TipoReporte = '103' | '104' | 'ATS'
export type EstadoReporte = 'BORRADOR' | 'GENERADO' | 'PRESENTADO'

export interface ReporteListOptions {
  tipo?: TipoReporte
  periodo?: number
  estado?: EstadoReporte
}

export interface Form103Data {
  periodo: number
  ivaVentas12: number
  ivaVentas14: number
  ivaVentas15: number
  ivaVentas0: number
  exportacionesNetas: number
  totalVentasNetas: number
  ivaCompras12: number
  ivaCompras14: number
  ivaCompras15: number
  ivaCompras0: number
  totalComprasNetas: number
  retencionIvaBienes: number
  retencionIvaServicios: number
  retencionIvaServiciosProfesionales: number
  retencionRentaBienes: number
  retencionRentaServicios: number
  retencionRentaHonorarios: number
  totalRetenciones: number
  saldoFavorIva: number
  saldoFavorRenta: number
}

export interface Form104Data {
  periodo: number
  ingresosVentas: number
  ingresosServicios: number
  ingresosExportaciones: number
  ingresosNoOperacionales: number
  costosCompras: number
  costosInventarioInicial: number
  costosInventarioFinal: number
  gastosSueldos: number
  gastosHonorarios: number
  gastosArriendos: number
  gastosPublicidad: number
  gastosFinancieros: number
  gastosSeguros: number
  gastosNoDeducibles: number
  ivaCobrado: number
  ivaPagado: number
  iceCobrado: number
  icePagado: number
  irbpnrCobrado: number
  irbpnrPagado: number
  utilidadBruta: number
  utilidadNeta: number
  impuestoRentaCausado: number
  retencionesRenta: number
  creditoTributario: number
}

export async function getAll(tenantId: string, options: ReporteListOptions = {}) {
  const conditions: string[] = ['tenant_id = $1']
  const params: any[] = [tenantId]
  let idx = 2

  if (options.tipo) {
    conditions.push(`tipo = $${idx++}`)
    params.push(options.tipo)
  }
  if (options.periodo) {
    conditions.push(`periodo = $${idx++}`)
    params.push(options.periodo)
  }
  if (options.estado) {
    conditions.push(`estado = $${idx++}`)
    params.push(options.estado)
  }

  return db.queryAll<any>(
    `SELECT * FROM reportes_fiscales WHERE ${conditions.join(' AND ')} ORDER BY periodo DESC, created_at DESC`,
    params
  )
}

export async function getById(id: number) {
  const reporte = await db.queryOne<any>('SELECT * FROM reportes_fiscales WHERE id = $1', [id])
  if (!reporte) {
    throw new Error(`Reporte fiscal con ID ${id} no encontrado.`)
  }
  return reporte
}

async function getEmisorByTenant(tenantId: string) {
  return db.queryOne<any>(
    'SELECT * FROM emisores WHERE tenant_id = $1 AND activo = true',
    [tenantId]
  )
}

function parsePeriodo(periodo: number): { year: number; month: number } {
  const str = String(periodo)
  return {
    year: parseInt(str.substring(0, 4), 10),
    month: parseInt(str.substring(4, 6), 10),
  }
}

function periodoDateBounds(periodo: number): { desde: Date; hasta: Date } {
  const { year, month } = parsePeriodo(periodo)
  const desde = new Date(year, month - 1, 1)
  const hasta = new Date(year, month, 0, 23, 59, 59, 999)
  return { desde, hasta }
}

export async function generate103(tenantId: string, periodo: number): Promise<Form103Data> {
  const emisor = await getEmisorByTenant(tenantId)
  if (!emisor) {
    throw new Error('No hay un emisor configurado para este contribuyente.')
  }

  const { desde, hasta } = periodoDateBounds(periodo)

  const comprobantes = await db.queryAll<any>(
    'SELECT * FROM comprobantes WHERE tenant_id = $1 AND fecha_emision >= $2 AND fecha_emision <= $3',
    [tenantId, desde, hasta]
  )

  const facturasEmitidas = comprobantes.filter(
    (c) => c.tipo === '01' && c.emisor_ruc === emisor.ruc
  )
  const facturasRecibidas = comprobantes.filter(
    (c) => c.tipo === '01' && c.emisor_ruc !== emisor.ruc
  )
  const retenciones = comprobantes.filter((c) => c.tipo === '07')

  const toNum = (v: any): number => Number(v) || 0

  const ivaVentas12 = facturasEmitidas
    .filter((c) => Number(c.total_iva) > 0)
    .reduce((s, c) => s + toNum(c.subtotal_sin_impuesto) * 0.12, 0)
  const ivaVentas14 = facturasEmitidas
    .filter((c) => Number(c.total_iva) > 0)
    .reduce((s, c) => s + toNum(c.subtotal_sin_impuesto) * 0.14, 0)
  const ivaVentas15 = facturasEmitidas
    .filter((c) => Number(c.total_iva) > 0)
    .reduce((s, c) => s + toNum(c.subtotal_sin_impuesto) * 0.15, 0)
  const ivaVentas0 = facturasEmitidas
    .filter((c) => toNum(c.total_iva) === 0 && toNum(c.subtotal_sin_impuesto) > 0)
    .reduce((s, c) => s + toNum(c.subtotal_sin_impuesto), 0)

  const exportacionesNetas = facturasEmitidas
    .filter((c) => c.categoria === 'Exportacion' || c.categoria === 'exportacion')
    .reduce((s, c) => s + toNum(c.subtotal_sin_impuesto), 0)

  const totalVentasNetas = facturasEmitidas.reduce((s, c) => s + toNum(c.subtotal_sin_impuesto), 0)

  const ivaCompras12 = facturasRecibidas
    .filter((c) => Number(c.total_iva) > 0)
    .reduce((s, c) => s + toNum(c.subtotal_sin_impuesto) * 0.12, 0)
  const ivaCompras14 = facturasRecibidas
    .filter((c) => Number(c.total_iva) > 0)
    .reduce((s, c) => s + toNum(c.subtotal_sin_impuesto) * 0.14, 0)
  const ivaCompras15 = facturasRecibidas
    .filter((c) => Number(c.total_iva) > 0)
    .reduce((s, c) => s + toNum(c.subtotal_sin_impuesto) * 0.15, 0)
  const ivaCompras0 = facturasRecibidas
    .filter((c) => toNum(c.total_iva) === 0 && toNum(c.subtotal_sin_impuesto) > 0)
    .reduce((s, c) => s + toNum(c.subtotal_sin_impuesto), 0)

  const totalComprasNetas = facturasRecibidas.reduce((s, c) => s + toNum(c.subtotal_sin_impuesto), 0)

  const retencionIvaBienes = retenciones
    .filter((r) => r.categoria === 'Bienes' && toNum(r.total_iva) > 0)
    .reduce((s, r) => s + toNum(r.total_iva), 0)
  const retencionIvaServicios = retenciones
    .filter((r) => r.categoria === 'Servicios' && toNum(r.total_iva) > 0)
    .reduce((s, r) => s + toNum(r.total_iva), 0)
  const retencionIvaServiciosProfesionales = retenciones
    .filter((r) => r.categoria === 'Profesionales' && toNum(r.total_iva) > 0)
    .reduce((s, r) => s + toNum(r.total_iva), 0)

  const retencionRentaBienes = retenciones
    .filter((r) => r.categoria === 'Bienes')
    .reduce((s, r) => s + toNum(r.total_iva), 0)
  const retencionRentaServicios = retenciones
    .filter((r) => r.categoria === 'Servicios')
    .reduce((s, r) => s + toNum(r.total_iva), 0)
  const retencionRentaHonorarios = retenciones
    .filter((r) => r.categoria === 'Honorarios')
    .reduce((s, r) => s + toNum(r.total_iva), 0)

  const totalRetenciones = retencionIvaBienes + retencionIvaServicios + retencionIvaServiciosProfesionales

  const ivaTotalVentas = ivaVentas12 + ivaVentas14 + ivaVentas15
  const ivaTotalCompras = ivaCompras12 + ivaCompras14 + ivaCompras15
  const saldoFavorIva = Math.max(0, ivaTotalCompras + totalRetenciones - ivaTotalVentas)
  const saldoFavorRenta = Math.max(0, retencionRentaBienes + retencionRentaServicios + retencionRentaHonorarios)

  return {
    periodo,
    ivaVentas12: Math.round(ivaVentas12 * 100) / 100,
    ivaVentas14: Math.round(ivaVentas14 * 100) / 100,
    ivaVentas15: Math.round(ivaVentas15 * 100) / 100,
    ivaVentas0: Math.round(ivaVentas0 * 100) / 100,
    exportacionesNetas: Math.round(exportacionesNetas * 100) / 100,
    totalVentasNetas: Math.round(totalVentasNetas * 100) / 100,
    ivaCompras12: Math.round(ivaCompras12 * 100) / 100,
    ivaCompras14: Math.round(ivaCompras14 * 100) / 100,
    ivaCompras15: Math.round(ivaCompras15 * 100) / 100,
    ivaCompras0: Math.round(ivaCompras0 * 100) / 100,
    totalComprasNetas: Math.round(totalComprasNetas * 100) / 100,
    retencionIvaBienes: Math.round(retencionIvaBienes * 100) / 100,
    retencionIvaServicios: Math.round(retencionIvaServicios * 100) / 100,
    retencionIvaServiciosProfesionales: Math.round(retencionIvaServiciosProfesionales * 100) / 100,
    retencionRentaBienes: Math.round(retencionRentaBienes * 100) / 100,
    retencionRentaServicios: Math.round(retencionRentaServicios * 100) / 100,
    retencionRentaHonorarios: Math.round(retencionRentaHonorarios * 100) / 100,
    totalRetenciones: Math.round(totalRetenciones * 100) / 100,
    saldoFavorIva: Math.round(saldoFavorIva * 100) / 100,
    saldoFavorRenta: Math.round(saldoFavorRenta * 100) / 100,
  }
}

export async function generate104(tenantId: string, periodo: number): Promise<Form104Data> {
  const emisor = await getEmisorByTenant(tenantId)
  if (!emisor) {
    throw new Error('No hay un emisor configurado para este contribuyente.')
  }

  const { desde, hasta } = periodoDateBounds(periodo)

  const comprobantes = await db.queryAll<any>(
    'SELECT * FROM comprobantes WHERE tenant_id = $1 AND fecha_emision >= $2 AND fecha_emision <= $3',
    [tenantId, desde, hasta]
  )

  const toNum = (v: any): number => Number(v) || 0

  const facturasEmitidas = comprobantes.filter(
    (c) => c.tipo === '01' && c.emisor_ruc === emisor.ruc
  )
  const facturasRecibidas = comprobantes.filter(
    (c) => c.tipo === '01' && c.emisor_ruc !== emisor.ruc
  )
  const retenciones = comprobantes.filter((c) => c.tipo === '07')

  const ingresosVentas = facturasEmitidas
    .filter((c) => !c.categoria?.toLowerCase().includes('exportacion'))
    .reduce((s, c) => s + toNum(c.importe_total), 0)
  const ingresosServicios = facturasEmitidas
    .filter((c) => c.categoria?.toLowerCase().includes('servicio'))
    .reduce((s, c) => s + toNum(c.importe_total), 0)
  const ingresosExportaciones = facturasEmitidas
    .filter((c) => c.categoria?.toLowerCase().includes('exportacion'))
    .reduce((s, c) => s + toNum(c.importe_total), 0)
  const ingresosNoOperacionales = 0

  const costosCompras = facturasRecibidas.reduce((s, c) => s + toNum(c.importe_total), 0)

  const ivaCobrado = facturasEmitidas.reduce((s, c) => s + toNum(c.total_iva), 0)
  const ivaPagado = facturasRecibidas.reduce((s, c) => s + toNum(c.total_iva), 0)

  const totalRetenciones = retenciones.reduce((s, r) => s + toNum(r.total_iva), 0)

  const utilidadBruta = ingresosVentas + ingresosServicios + ingresosExportaciones - costosCompras
  const utilidadNeta = utilidadBruta - ingresosNoOperacionales
  const impuestoRentaCausado = Math.max(0, utilidadNeta * 0.25)

  return {
    periodo,
    ingresosVentas: Math.round(ingresosVentas * 100) / 100,
    ingresosServicios: Math.round(ingresosServicios * 100) / 100,
    ingresosExportaciones: Math.round(ingresosExportaciones * 100) / 100,
    ingresosNoOperacionales: Math.round(ingresosNoOperacionales * 100) / 100,
    costosCompras: Math.round(costosCompras * 100) / 100,
    costosInventarioInicial: 0,
    costosInventarioFinal: 0,
    gastosSueldos: 0,
    gastosHonorarios: 0,
    gastosArriendos: 0,
    gastosPublicidad: 0,
    gastosFinancieros: 0,
    gastosSeguros: 0,
    gastosNoDeducibles: 0,
    ivaCobrado: Math.round(ivaCobrado * 100) / 100,
    ivaPagado: Math.round(ivaPagado * 100) / 100,
    iceCobrado: 0,
    icePagado: 0,
    irbpnrCobrado: 0,
    irbpnrPagado: 0,
    utilidadBruta: Math.round(utilidadBruta * 100) / 100,
    utilidadNeta: Math.round(utilidadNeta * 100) / 100,
    impuestoRentaCausado: Math.round(impuestoRentaCausado * 100) / 100,
    retencionesRenta: Math.round(totalRetenciones * 100) / 100,
    creditoTributario: Math.round(Math.max(0, totalRetenciones - impuestoRentaCausado) * 100) / 100,
  }
}

export async function saveReporte(tenantId: string, tipo: TipoReporte, periodo: number, data: Form103Data | Form104Data) {
  await db.query(
    `INSERT INTO reportes_fiscales (tenant_id, tipo, periodo, data, estado, fecha_generacion)
     VALUES ($1, $2, $3, $4::jsonb, 'GENERADO', NOW())
     ON CONFLICT (tenant_id, tipo, periodo)
     DO UPDATE SET data = $4::jsonb, estado = 'GENERADO', fecha_generacion = NOW()`,
    [tenantId, tipo, periodo, JSON.stringify(data)]
  )
  return db.queryOne<any>(
    'SELECT * FROM reportes_fiscales WHERE tenant_id = $1 AND tipo = $2 AND periodo = $3',
    [tenantId, tipo, periodo]
  )
}

export async function updateEstado(id: number, estado: EstadoReporte) {
  const reporte = await db.queryOne<any>('SELECT * FROM reportes_fiscales WHERE id = $1', [id])
  if (!reporte) {
    throw new Error(`Reporte fiscal con ID ${id} no encontrado.`)
  }

  const updateData: Record<string, any> = { estado }

  if (estado === 'PRESENTADO') {
    updateData.fecha_presentacion = new Date()
  }

  await db.update('reportes_fiscales', updateData, 'id = $1', [id])
  return db.queryOne<any>('SELECT * FROM reportes_fiscales WHERE id = $1', [id])
}

export async function getResumen(tenantId: string, periodo: number) {
  const { desde, hasta } = periodoDateBounds(periodo)
  const emisor = await getEmisorByTenant(tenantId)

  if (!emisor) {
    throw new Error('No hay un emisor configurado para este contribuyente.')
  }

  const comprobantes = await db.queryAll<any>(
    'SELECT * FROM comprobantes WHERE tenant_id = $1 AND fecha_emision >= $2 AND fecha_emision <= $3',
    [tenantId, desde, hasta]
  )

  const toNum = (v: any): number => Number(v) || 0

  const facturasEmitidas = comprobantes.filter((c) => c.tipo === '01' && c.emisor_ruc === emisor.ruc)
  const facturasRecibidas = comprobantes.filter((c) => c.tipo === '01' && c.emisor_ruc !== emisor.ruc)
  const notascCredito = comprobantes.filter((c) => c.tipo === '04')
  const retenciones = comprobantes.filter((c) => c.tipo === '07')

  const reportes = await db.queryAll<any>(
    'SELECT * FROM reportes_fiscales WHERE tenant_id = $1 AND periodo = $2',
    [tenantId, periodo]
  )

  return {
    periodo,
    totalFacturasEmitidas: facturasEmitidas.length,
    totalFacturasRecibidas: facturasRecibidas.length,
    totalNotasCredito: notascCredito.length,
    totalRetenciones: retenciones.length,
    totalComprobantes: comprobantes.length,
    sumaVentas: Math.round(facturasEmitidas.reduce((s, c) => s + toNum(c.importe_total), 0) * 100) / 100,
    sumaCompras: Math.round(facturasRecibidas.reduce((s, c) => s + toNum(c.importe_total), 0) * 100) / 100,
    ivaVentas: Math.round(facturasEmitidas.reduce((s, c) => s + toNum(c.total_iva), 0) * 100) / 100,
    ivaCompras: Math.round(facturasRecibidas.reduce((s, c) => s + toNum(c.total_iva), 0) * 100) / 100,
    ivaRetenido: Math.round(retenciones.reduce((s, r) => s + toNum(r.total_iva), 0) * 100) / 100,
    reportes,
  }
}
