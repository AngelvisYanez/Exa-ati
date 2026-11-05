import { db } from './db'

export interface AtsVenta {
  tpIdCliente: string
  idCliente: string
  razonSocial: string
  tipoComprobante: string
  /** Código numérico del comprobante según catálogo SRI (01, 04, …) */
  tipoComprobanteCodigo?: string
  numeroComprobantes: number
  baseImponible: number
  baseNoGraIva: number
  baseImpExe?: number
  montoIva: number
  valorRetenidoIva: number
  valorRetenidoRenta: number
}

export interface AtsCompra {
  tpIdProveedor: string
  idProveedor: string
  razonSocial: string
  tipoComprobante: string
  /** Código numérico del comprobante según catálogo SRI (01, 03, …) */
  tipoComprobanteCodigo?: string
  numeroComprobantes: number
  baseImponible: number
  baseNoGraIva: number
  baseImpExe?: number
  montoIva: number
  valorRetenidoIva: number
  valorRetenidoRenta: number
}

export interface AtsRetencion {
  tipoComprobante: string
  /** Código numérico del comprobante según catálogo SRI (07) */
  tipoComprobanteCodigo?: string
  numeroComprobantes: number
  baseImponible: number
  valorRetenidoIva: number
  valorRetenidoRenta: number
}

export interface AtsAnulado {
  tipoComprobante: string
  establecimiento: string
  puntoEmision: string
  secuencialInicial: string
  secuencialFinal: string
  numeroAnulados: number
}

export interface AtsData {
  periodo: number
  razonSocial: string
  ruc: string
  establecimientos: { codigo: string; direccion: string }[]
  ventas: AtsVenta[]
  compras: AtsCompra[]
  retenciones: AtsRetencion[]
  anulados: AtsAnulado[]
  totalVentas: number
  totalCompras: number
  totalRetenciones: number
}

/** Catálogo de tipos de comprobante del SRI (Res. NAC-DGERCGC08-00000119) */
const TIPO_COMPROBANTE_MAP: Record<string, string> = {
  '01': 'FACTURA',
  '02': 'NOTA_VENTA',
  '03': 'LIQUIDACION_COMPRA',
  '04': 'NOTA_CREDITO',
  '05': 'NOTA_DEBITO',
  '06': 'GUIA_REMISION',
  '07': 'COMPROBANTE_RETENCION',
}

const CODIGO_POR_NOMBRE: Record<string, string> = Object.fromEntries(
  Object.entries(TIPO_COMPROBANTE_MAP).map(([codigo, nombre]) => [nombre, codigo])
)

/**
 * Catálogo ATS de tipos de identificación (Instructivo Anexo Transaccional):
 * 01=RUC, 02=CÉDULA, 03=PASAPORTE, 04=CONSUMIDOR FINAL, 05=IDENTIFICACIÓN DEL EXTERIOR.
 */
const TP_ID_ATS_POR_COMPROBANTE: Record<string, string> = {
  '04': '01', // RUC
  '05': '02', // cédula
  '06': '03', // pasaporte
  '07': '04', // consumidor final
  '08': '05', // exterior
}

function toNum(v: any): number {
  return Number(v) || 0
}

function redondear2(n: number): number {
  return Math.round(n * 100) / 100
}

/** Resuelve el código ATS de identificación a partir del tipo del comprobante o de la longitud del ID. */
export function toAtsTpId(tipoId: string | null | undefined, identificacion: string | null | undefined): string {
  if (tipoId && TP_ID_ATS_POR_COMPROBANTE[tipoId]) return TP_ID_ATS_POR_COMPROBANTE[tipoId]
  const id = (identificacion || '').trim()
  if (/^\d{13}$/.test(id)) return '01'
  if (/^\d{10}$/.test(id)) return '02'
  return '04'
}

export function parsePeriodo(periodo: number): { year: number; month: number } {
  const str = String(periodo)
  return {
    year: parseInt(str.substring(0, 4), 10),
    month: parseInt(str.substring(4, 6), 10),
  }
}

export function periodoDateBounds(periodo: number): { desde: string; hastaExclusivo: string } {
  const { year, month } = parsePeriodo(periodo)
  const desde = `${year}-${String(month).padStart(2, '0')}-01`
  const hastaExclusivo =
    month === 12
      ? `${year + 1}-01-01`
      : `${year}-${String(month + 1).padStart(2, '0')}-01`
  return { desde, hastaExclusivo }
}

interface ComprobanteRow {
  tipo?: string | null
  estado?: string | null
  emisor_ruc?: string | null
  receptor_tipo_id?: string | null
  receptor_identificacion?: string | null
  receptor_razon_social?: string | null
  emisor_razon_social?: string | null
  subtotal_sin_impuesto?: any
  total_sin_impuesto?: any
  total_descuento?: any
  total_iva?: any
  categoria?: string | null
}

function baseGravada(c: ComprobanteRow): number {
  return redondear2(toNum(c.subtotal_sin_impuesto ?? c.total_sin_impuesto) - toNum(c.total_descuento))
}

export async function getAtsData(tenantId: string, periodo: number): Promise<AtsData> {
  const emisor = await db.queryOne<any>(
    'SELECT * FROM emisores WHERE tenant_id = $1 AND activo = true',
    [tenantId]
  )

  if (!emisor) {
    throw new Error('No hay un emisor configurado para este contribuyente.')
  }

  const { desde, hastaExclusivo } = periodoDateBounds(periodo)

  const comprobantes = await db.queryAll<any>(
    `SELECT * FROM comprobantes
     WHERE tenant_id = $1 AND fecha_emision >= $2 AND fecha_emision < $3`,
    [tenantId, desde, hastaExclusivo]
  )

  const autorizado = (c: ComprobanteRow) => c.estado === 'AUTORIZADO'
  const facturasEmitidas = comprobantes.filter(
    (c: ComprobanteRow) => c.tipo === '01' && c.emisor_ruc === emisor.ruc && autorizado(c)
  )
  const notasCreditoEmitidas = comprobantes.filter(
    (c: ComprobanteRow) => c.tipo === '04' && c.emisor_ruc === emisor.ruc && autorizado(c)
  )
  const facturasRecibidas = comprobantes.filter(
    (c: ComprobanteRow) => c.tipo === '01' && c.emisor_ruc !== emisor.ruc && autorizado(c)
  )
  const notasCreditoRecibidas = comprobantes.filter(
    (c: ComprobanteRow) => c.tipo === '04' && c.emisor_ruc !== emisor.ruc && autorizado(c)
  )
  const retenciones = comprobantes.filter((c: ComprobanteRow) => c.tipo === '07' && autorizado(c))

  const ventaMap = new Map<string, AtsVenta>()

  for (const f of facturasEmitidas) {
    const key = `${f.receptor_tipo_id}-${f.receptor_identificacion}-${f.tipo}`
    const existing = ventaMap.get(key)
    const baseIva = baseGravada(f)
    const montoIva = redondear2(toNum(f.total_iva))
    const baseNoGraIva = montoIva === 0 ? baseIva : 0

    if (existing) {
      existing.numeroComprobantes++
      existing.baseImponible = redondear2(existing.baseImponible + baseIva)
      existing.baseNoGraIva = redondear2(existing.baseNoGraIva + baseNoGraIva)
      existing.montoIva = redondear2(existing.montoIva + montoIva)
    } else {
      ventaMap.set(key, {
        tpIdCliente: toAtsTpId(f.receptor_tipo_id, f.receptor_identificacion),
        idCliente: f.receptor_identificacion || '',
        razonSocial: f.receptor_razon_social || '',
        tipoComprobante: TIPO_COMPROBANTE_MAP[f.tipo || ''] || f.tipo || 'FACTURA',
        tipoComprobanteCodigo: f.tipo || '01',
        numeroComprobantes: 1,
        baseImponible: baseIva,
        baseNoGraIva,
        baseImpExe: 0,
        montoIva,
        valorRetenidoIva: 0,
        valorRetenidoRenta: 0,
      })
    }
  }

  // Notas de crédito emitidas → valores netos (fila negativa con código 04)
  for (const nc of notasCreditoEmitidas) {
    const key = `${nc.receptor_tipo_id}-${nc.receptor_identificacion}-NC`
    const existing = ventaMap.get(key)
    const baseIva = -baseGravada(nc)
    const montoIva = redondear2(-toNum(nc.total_iva))
    const baseNoGraIva = montoIva === 0 ? baseIva : 0

    if (existing) {
      existing.numeroComprobantes++
      existing.baseImponible = redondear2(existing.baseImponible + baseIva)
      existing.baseNoGraIva = redondear2(existing.baseNoGraIva + baseNoGraIva)
      existing.montoIva = redondear2(existing.montoIva + montoIva)
    } else {
      ventaMap.set(key, {
        tpIdCliente: toAtsTpId(nc.receptor_tipo_id, nc.receptor_identificacion),
        idCliente: nc.receptor_identificacion || '',
        razonSocial: nc.receptor_razon_social || '',
        tipoComprobante: TIPO_COMPROBANTE_MAP['04'],
        tipoComprobanteCodigo: '04',
        numeroComprobantes: 1,
        baseImponible: baseIva,
        baseNoGraIva,
        baseImpExe: 0,
        montoIva,
        valorRetenidoIva: 0,
        valorRetenidoRenta: 0,
      })
    }
  }

  const compraMap = new Map<string, AtsCompra>()

  for (const f of facturasRecibidas) {
    const key = `${f.emisor_ruc || ''}-${f.tipo}`
    const existing = compraMap.get(key)
    const baseIva = baseGravada(f)
    const montoIva = redondear2(toNum(f.total_iva))
    const baseNoGraIva = montoIva === 0 ? baseIva : 0

    if (existing) {
      existing.numeroComprobantes++
      existing.baseImponible = redondear2(existing.baseImponible + baseIva)
      existing.baseNoGraIva = redondear2(existing.baseNoGraIva + baseNoGraIva)
      existing.montoIva = redondear2(existing.montoIva + montoIva)
    } else {
      compraMap.set(key, {
        tpIdProveedor: toAtsTpId('04', f.emisor_ruc),
        idProveedor: f.emisor_ruc || '',
        razonSocial: f.emisor_razon_social || f.receptor_razon_social || '',
        tipoComprobante: TIPO_COMPROBANTE_MAP[f.tipo || ''] || f.tipo || 'FACTURA',
        tipoComprobanteCodigo: f.tipo || '01',
        numeroComprobantes: 1,
        baseImponible: baseIva,
        baseNoGraIva,
        baseImpExe: 0,
        montoIva,
        valorRetenidoIva: 0,
        valorRetenidoRenta: 0,
      })
    }
  }

  // Notas de crédito recibidas → valores netos (fila negativa con código 04)
  for (const nc of notasCreditoRecibidas) {
    const key = `${nc.emisor_ruc || ''}-NC`
    const existing = compraMap.get(key)
    const baseIva = -baseGravada(nc)
    const montoIva = redondear2(-toNum(nc.total_iva))
    const baseNoGraIva = montoIva === 0 ? baseIva : 0

    if (existing) {
      existing.numeroComprobantes++
      existing.baseImponible = redondear2(existing.baseImponible + baseIva)
      existing.baseNoGraIva = redondear2(existing.baseNoGraIva + baseNoGraIva)
      existing.montoIva = redondear2(existing.montoIva + montoIva)
    } else {
      compraMap.set(key, {
        tpIdProveedor: toAtsTpId('04', nc.emisor_ruc),
        idProveedor: nc.emisor_ruc || '',
        razonSocial: nc.emisor_razon_social || nc.receptor_razon_social || '',
        tipoComprobante: TIPO_COMPROBANTE_MAP['04'],
        tipoComprobanteCodigo: '04',
        numeroComprobantes: 1,
        baseImponible: baseIva,
        baseNoGraIva,
        baseImpExe: 0,
        montoIva,
        valorRetenidoIva: 0,
        valorRetenidoRenta: 0,
      })
    }
  }

  const retencionMap = new Map<string, AtsRetencion>()

  for (const r of retenciones) {
    const key = r.tipo || '07'
    const existing = retencionMap.get(key)
    const baseImp = redondear2(toNum(r.subtotal_sin_impuesto ?? r.total_sin_impuesto))
    const ivaRet = redondear2(toNum(r.total_iva))

    if (existing) {
      existing.numeroComprobantes++
      existing.baseImponible = redondear2(existing.baseImponible + baseImp)
      existing.valorRetenidoIva = redondear2(existing.valorRetenidoIva + ivaRet)
    } else {
      retencionMap.set(key, {
        tipoComprobante: TIPO_COMPROBANTE_MAP['07'],
        tipoComprobanteCodigo: '07',
        numeroComprobantes: 1,
        baseImponible: baseImp,
        valorRetenidoIva: ivaRet,
        valorRetenidoRenta: 0,
      })
    }
  }

  const ventas = Array.from(ventaMap.values())
  const compras = Array.from(compraMap.values())
  const retencionesData = Array.from(retencionMap.values())

  return {
    periodo,
    razonSocial: emisor.razon_social || '',
    ruc: emisor.ruc,
    establecimientos: [
      {
        codigo: emisor.establecimiento || '001',
        direccion: emisor.direccion_matriz || emisor.dir_matriz || '',
      },
    ],
    ventas,
    compras,
    retenciones: retencionesData,
    anulados: [],
    totalVentas: redondear2(ventas.reduce((s, v) => s + v.baseImponible + v.baseNoGraIva + toNum(v.baseImpExe), 0)),
    totalCompras: redondear2(compras.reduce((s, c) => s + c.baseImponible + c.baseNoGraIva + toNum(c.baseImpExe), 0)),
    totalRetenciones: redondear2(retencionesData.reduce((s, r) => s + r.valorRetenidoIva, 0)),
  }
}

export async function generateAts(tenantId: string, periodo: number): Promise<AtsData> {
  const data = await getAtsData(tenantId, periodo)

  await db.query(
    `INSERT INTO reportes_fiscales (tenant_id, tipo, periodo, data, estado, fecha_generacion)
     VALUES ($1, 'ATS', $2, $3::jsonb, 'GENERADO', NOW())
     ON CONFLICT (tenant_id, tipo, periodo)
     DO UPDATE SET data = $3::jsonb, estado = 'GENERADO', fecha_generacion = NOW()`,
    [tenantId, periodo, JSON.stringify(data)]
  )

  return data
}

const TP_IDS_VALIDOS = ['01', '02', '03', '04', '05']

function validarDetalleTpId(
  tpId: string,
  identificacion: string,
  etiqueta: string,
  quien: string,
  errores: string[]
): void {
  if (!TP_IDS_VALIDOS.includes(tpId)) {
    errores.push(`Tipo de identificación inválido (${tpId}) en ${etiqueta} de ${quien}.`)
    return
  }
  const id = (identificacion || '').trim()
  if (tpId === '01' && !/^\d{13}$/.test(id)) {
    errores.push(`Identificación RUC inválida en ${etiqueta} de ${quien}: debe tener 13 dígitos.`)
  }
  if (tpId === '02' && !/^\d{10}$/.test(id)) {
    errores.push(`Identificación cédula inválida en ${etiqueta} de ${quien}: debe tener 10 dígitos.`)
  }
}

export function validateAts(data: AtsData): { valido: boolean; errores: string[] } {
  const errores: string[] = []

  if (!data.ruc || data.ruc.length !== 13) {
    errores.push('El RUC del contribuyente es requerido (13 dígitos).')
  }

  if (!data.razonSocial) {
    errores.push('La razón social del contribuyente es requerida.')
  }

  const { year, month } = parsePeriodo(data.periodo)
  if (
    data.periodo < 202001 ||
    data.periodo > 999999 ||
    !Number.isFinite(data.periodo) ||
    String(Math.trunc(data.periodo)).length !== 6 ||
    !(month >= 1 && month <= 12) ||
    !(year >= 2000)
  ) {
    errores.push('Período fiscal inválido. Debe estar en formato YYYYMM.')
  }

  if (!data.establecimientos || data.establecimientos.length === 0) {
    errores.push('Debe existir al menos un establecimiento registrado.')
  }

  for (const venta of data.ventas) {
    if (!venta.idCliente) {
      errores.push('Una venta no tiene identificación de cliente.')
    } else {
      validarDetalleTpId(venta.tpIdCliente, venta.idCliente, 'venta', venta.razonSocial || venta.idCliente, errores)
    }
    if (venta.baseImponible < 0 && venta.tipoComprobanteCodigo !== '04') {
      errores.push(`Base imponible negativa en venta de ${venta.razonSocial}.`)
    }
  }

  for (const compra of data.compras) {
    if (!compra.idProveedor) {
      errores.push('Una compra no tiene identificación de proveedor.')
    } else {
      validarDetalleTpId(compra.tpIdProveedor, compra.idProveedor, 'compra', compra.razonSocial || compra.idProveedor, errores)
    }
    if (compra.baseImponible < 0 && compra.tipoComprobanteCodigo !== '04') {
      errores.push(`Base imponible negativa en compra de ${compra.razonSocial}.`)
    }
  }

  return {
    valido: errores.length === 0,
    errores,
  }
}

function fmt(n: any): string {
  return (Number(n) || 0).toFixed(2)
}

export function escapeXml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;')
}

function codigoComprobante(d: { tipoComprobanteCodigo?: string; tipoComprobante: string }, fallback: string): string {
  if (d.tipoComprobanteCodigo && CODIGO_POR_NOMBRE[d.tipoComprobante]) return d.tipoComprobanteCodigo
  if (CODIGO_POR_NOMBRE[d.tipoComprobante]) return CODIGO_POR_NOMBRE[d.tipoComprobante]
  if (/^\d{2}$/.test(d.tipoComprobanteCodigo || '')) return d.tipoComprobanteCodigo as string
  return fallback
}

/**
 * Genera el XML del Anexo Transaccional Simplificado (ATS) conforme al
 * esquema oficial del SRI (raíz `ivaRecaudado`, cabecera, compras y ventas).
 */
export function buildAtsXml(data: AtsData): string {
  const { year, month } = parsePeriodo(data.periodo)
  const mes = String(month).padStart(2, '0')

  const totBaseImponible = data.ventas.reduce((s, v) => s + v.baseImponible, 0)
  const totBaseNoGraIva = data.ventas.reduce((s, v) => s + v.baseNoGraIva, 0)
  const totBaseImpExe = data.ventas.reduce((s, v) => s + toNum(v.baseImpExe), 0)
  const totMontoIva = data.ventas.reduce((s, v) => s + v.montoIva, 0)
  const totRetIva = data.retenciones.reduce((s, r) => s + r.valorRetenidoIva, 0)
  const totRetRenta = data.retenciones.reduce((s, r) => s + r.valorRetenidoRenta, 0)

  const l: string[] = []
  l.push('<?xml version="1.0" encoding="UTF-8"?>')
  l.push('<ivaRecaudado>')
  l.push('  <cabecera>')
  l.push(`    <Ruc>${escapeXml(data.ruc)}</Ruc>`)
  l.push(`    <RazonSocial>${escapeXml(data.razonSocial)}</RazonSocial>`)
  l.push(`    <Mes>${mes}</Mes>`)
  l.push(`    <Anio>${year}</Anio>`)
  l.push('    <CabeceraTotales>')
  for (const est of data.establecimientos) {
    l.push(`      <Establecimiento>${escapeXml(est.codigo)}</Establecimiento>`)
  }
  l.push(`      <TotBaseImponible>${fmt(totBaseImponible)}</TotBaseImponible>`)
  l.push(`      <TotBaseNoGraIva>${fmt(totBaseNoGraIva)}</TotBaseNoGraIva>`)
  l.push(`      <TotBaseImpExe>${fmt(totBaseImpExe)}</TotBaseImpExe>`)
  l.push(`      <TotMontoIva>${fmt(totMontoIva)}</TotMontoIva>`)
  l.push('      <TotMontoIce>0.00</TotMontoIce>')
  l.push(`      <TotValorRetenidoRenta>${fmt(totRetRenta)}</TotValorRetenidoRenta>`)
  l.push(`      <TotValorRetenidoIva>${fmt(totRetIva)}</TotValorRetenidoIva>`)
  l.push('    </CabeceraTotales>')
  l.push('  </cabecera>')

  l.push('  <compras>')
  for (const c of data.compras) {
    const porcentajeIva =
      c.montoIva > 0 && c.baseImponible > 0
        ? redondear2((c.montoIva / c.baseImponible) * 100)
        : 0
    l.push('    <detalleCompras>')
    l.push(`      <codSustento>${c.montoIva > 0 ? '01' : '05'}</codSustento>`)
    l.push(`      <tpIdProv>${c.tpIdProveedor}</tpIdProv>`)
    l.push(`      <idProv>${escapeXml(c.idProveedor)}</idProv>`)
    l.push(`      <tipoComprobante>${codigoComprobante(c, '01')}</tipoComprobante>`)
    l.push(`      <baseNoGraIva>${fmt(c.baseNoGraIva)}</baseNoGraIva>`)
    l.push(`      <baseImponible>${fmt(c.baseImponible)}</baseImponible>`)
    l.push(`      <baseImpExe>${fmt(c.baseImpExe)}</baseImpExe>`)
    l.push(`      <porcentajeIva>${fmt(porcentajeIva)}</porcentajeIva>`)
    l.push(`      <montoIva>${fmt(c.montoIva)}</montoIva>`)
    l.push(`      <valorRetenidoRenta>${fmt(c.valorRetenidoRenta)}</valorRetenidoRenta>`)
    l.push('      <numAutRetRenta/>')
    l.push('      <valorRetenidoBien10>0.00</valorRetenidoBien10>')
    l.push('      <valorRetenidoServ20>0.00</valorRetenidoServ20>')
    l.push('      <valorRetenidoBien50>0.00</valorRetenidoBien50>')
    l.push('      <valorRetenidoServ30>0.00</valorRetenidoServ30>')
    l.push('      <valorRetenidoServ70>0.00</valorRetenidoServ70>')
    l.push('      <valorRetenidoServ100>0.00</valorRetenidoServ100>')
    l.push('    </detalleCompras>')
  }
  l.push('  </compras>')

  l.push('  <ventas>')
  for (const v of data.ventas) {
    l.push('    <detalleVentas>')
    l.push(`      <tpIdCliente>${v.tpIdCliente}</tpIdCliente>`)
    l.push(`      <idCliente>${escapeXml(v.idCliente)}</idCliente>`)
    l.push(`      <tipoComprobante>${codigoComprobante(v, '01')}</tipoComprobante>`)
    l.push(`      <baseNoGraIva>${fmt(v.baseNoGraIva)}</baseNoGraIva>`)
    l.push(`      <baseImponible>${fmt(v.baseImponible)}</baseImponible>`)
    l.push(`      <baseImpExe>${fmt(v.baseImpExe)}</baseImpExe>`)
    l.push(`      <montoIva>${fmt(v.montoIva)}</montoIva>`)
    l.push('      <montoIce>0.00</montoIce>')
    l.push('    </detalleVentas>')
  }
  l.push('  </ventas>')

  if (data.anulados.length > 0) {
    l.push('  <anulados>')
    for (const a of data.anulados) {
      l.push('    <anulado>')
      l.push(`      <tipoComprobante>${escapeXml(a.tipoComprobante)}</tipoComprobante>`)
      l.push(`      <establecimiento>${escapeXml(a.establecimiento)}</establecimiento>`)
      l.push(`      <puntoEmision>${escapeXml(a.puntoEmision)}</puntoEmision>`)
      l.push(`      <secuencialInicial>${escapeXml(a.secuencialInicial)}</secuencialInicial>`)
      l.push(`      <secuencialFinal>${escapeXml(a.secuencialFinal)}</secuencialFinal>`)
      l.push(`      <numeroAnulados>${a.numeroAnulados}</numeroAnulados>`)
      l.push('    </anulado>')
    }
    l.push('  </anulados>')
  }

  l.push('  <infoAdicional/>')
  l.push('</ivaRecaudado>')

  return l.join('\n') + '\n'
}

export async function exportAtsXml(tenantId: string, periodo: number): Promise<string> {
  const data = await getAtsData(tenantId, periodo)

  const validacion = validateAts(data)
  if (!validacion.valido) {
    throw new Error(`Datos ATS incompletos: ${validacion.errores.join('; ')}`)
  }

  const xml = buildAtsXml(data)

  await db.query(
    `INSERT INTO reportes_fiscales (tenant_id, tipo, periodo, xml_generado, data, estado, fecha_generacion)
     VALUES ($1, 'ATS', $2, $3, $4::jsonb, 'GENERADO', NOW())
     ON CONFLICT (tenant_id, tipo, periodo)
     DO UPDATE SET xml_generado = $3, data = $4::jsonb, estado = 'GENERADO', fecha_generacion = NOW()`,
    [tenantId, periodo, xml, JSON.stringify(data)]
  )

  return xml
}
