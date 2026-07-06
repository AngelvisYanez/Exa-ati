import { db } from './db'

export interface AtsVenta {
  tpIdCliente: string
  idCliente: string
  razonSocial: string
  tipoComprobante: string
  numeroComprobantes: number
  baseImponible: number
  baseNoGraIva: number
  montoIva: number
  valorRetenidoIva: number
  valorRetenidoRenta: number
}

export interface AtsCompra {
  tpIdProveedor: string
  idProveedor: string
  razonSocial: string
  tipoComprobante: string
  numeroComprobantes: number
  baseImponible: number
  baseNoGraIva: number
  montoIva: number
  valorRetenidoIva: number
  valorRetenidoRenta: number
}

export interface AtsRetencion {
  tipoComprobante: string
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

const TIPO_COMPROBANTE_MAP: Record<string, string> = {
  '01': 'FACTURA',
  '02': 'NOTA_CREDITO',
  '03': 'NOTA_DEBITO',
  '04': 'NOTA_CREDITO',
  '05': 'NOTA_DEBITO',
  '06': 'GUIA_REMISION',
  '07': 'COMPROBANTE_RETENCION',
}

function toNum(v: any): number {
  return Number(v) || 0
}

export function parsePeriodo(periodo: number): { year: number; month: number } {
  const str = String(periodo)
  return {
    year: parseInt(str.substring(0, 4), 10),
    month: parseInt(str.substring(4, 6), 10),
  }
}

export function periodoDateBounds(periodo: number): { desde: Date; hasta: Date } {
  const { year, month } = parsePeriodo(periodo)
  const desde = new Date(year, month - 1, 1)
  const hasta = new Date(year, month, 0, 23, 59, 59, 999)
  return { desde, hasta }
}

export async function getAtsData(tenantId: string, periodo: number): Promise<AtsData> {
  const emisor = await db.queryOne<any>(
    'SELECT * FROM emisores WHERE tenant_id = $1 AND activo = true',
    [tenantId]
  )

  if (!emisor) {
    throw new Error('No hay un emisor configurado para este contribuyente.')
  }

  const { desde, hasta } = periodoDateBounds(periodo)

  const comprobantes = await db.queryAll<any>(
    'SELECT * FROM comprobantes WHERE tenant_id = $1 AND fecha_emision >= $2 AND fecha_emision <= $3',
    [tenantId, desde, hasta]
  )

  const facturasEmitidas = comprobantes.filter(
    (c) => c.tipo === '01' && c.emisor_ruc === emisor.ruc && c.estado === 'AUTORIZADO'
  )
  const facturasRecibidas = comprobantes.filter(
    (c) => c.tipo === '01' && c.emisor_ruc !== emisor.ruc && c.estado === 'AUTORIZADO'
  )
  const retenciones = comprobantes.filter((c) => c.tipo === '07' && c.estado === 'AUTORIZADO')

  const ventaMap = new Map<string, AtsVenta>()

  for (const f of facturasEmitidas) {
    const key = `${f.receptor_tipo_id}-${f.receptor_identificacion}-${f.tipo}`
    const existing = ventaMap.get(key)
    const baseIva = toNum(f.total_sin_impuesto) - toNum(f.total_descuento)
    const montoIva = toNum(f.total_iva)
    const baseNoGraIva = montoIva === 0 ? baseIva : 0

    if (existing) {
      existing.numeroComprobantes++
      existing.baseImponible += baseIva
      existing.baseNoGraIva += baseNoGraIva
      existing.montoIva += montoIva
    } else {
      ventaMap.set(key, {
        tpIdCliente: f.receptor_tipo_id || '05',
        idCliente: f.receptor_identificacion || '',
        razonSocial: f.receptor_razon_social || '',
        tipoComprobante: TIPO_COMPROBANTE_MAP[f.tipo || ''] || f.tipo || 'FACTURA',
        numeroComprobantes: 1,
        baseImponible: baseIva,
        baseNoGraIva,
        montoIva,
        valorRetenidoIva: 0,
        valorRetenidoRenta: 0,
      })
    }
  }

  const compraMap = new Map<string, AtsCompra>()

  for (const f of facturasRecibidas) {
    const key = `${f.receptor_tipo_id}-${f.receptor_identificacion}-${f.tipo}`
    const existing = compraMap.get(key)
    const baseIva = toNum(f.total_sin_impuesto) - toNum(f.total_descuento)
    const montoIva = toNum(f.total_iva)
    const baseNoGraIva = montoIva === 0 ? baseIva : 0

    if (existing) {
      existing.numeroComprobantes++
      existing.baseImponible += baseIva
      existing.baseNoGraIva += baseNoGraIva
      existing.montoIva += montoIva
    } else {
      compraMap.set(key, {
        tpIdProveedor: f.receptor_tipo_id || '04',
        idProveedor: f.receptor_identificacion || '',
        razonSocial: f.receptor_razon_social || '',
        tipoComprobante: TIPO_COMPROBANTE_MAP[f.tipo || ''] || f.tipo || 'FACTURA',
        numeroComprobantes: 1,
        baseImponible: baseIva,
        baseNoGraIva,
        montoIva,
        valorRetenidoIva: 0,
        valorRetenidoRenta: 0,
      })
    }
  }

  let totalRetenidoIva = 0
  let totalRetenidoRenta = 0
  let totalBaseRet = 0

  const retencionMap = new Map<string, AtsRetencion>()

  for (const r of retenciones) {
    const key = r.tipo || '07'
    const existing = retencionMap.get(key)
    const baseImp = toNum(r.total_sin_impuesto)
    const ivaRet = toNum(r.total_iva)

    if (existing) {
      existing.numeroComprobantes++
      existing.baseImponible += baseImp
      existing.valorRetenidoIva += ivaRet
    } else {
      retencionMap.set(key, {
        tipoComprobante: 'COMPROBANTE_RETENCION',
        numeroComprobantes: 1,
        baseImponible: baseImp,
        valorRetenidoIva: ivaRet,
        valorRetenidoRenta: 0,
      })
    }

    totalRetenidoIva += ivaRet
    totalBaseRet += baseImp
  }

  totalRetenidoRenta = 0

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
    totalVentas: ventas.reduce((s, v) => s + v.baseImponible, 0),
    totalCompras: compras.reduce((s, c) => s + c.baseImponible, 0),
    totalRetenciones: retencionesData.reduce((s, r) => s + r.valorRetenidoIva, 0),
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

export function validateAts(data: AtsData): { valido: boolean; errores: string[] } {
  const errores: string[] = []

  if (!data.ruc || data.ruc.length !== 13) {
    errores.push('El RUC del contribuyente es requerido (13 dígitos).')
  }

  if (!data.razonSocial) {
    errores.push('La razón social del contribuyente es requerida.')
  }

  if (data.periodo < 202001 || data.periodo > 999999) {
    errores.push('Período fiscal inválido. Debe estar en formato YYYYMM.')
  }

  if (!data.establecimientos || data.establecimientos.length === 0) {
    errores.push('Debe existir al menos un establecimiento registrado.')
  }

  for (const venta of data.ventas) {
    if (!venta.idCliente) {
      errores.push('Una venta no tiene identificación de cliente.')
    }
    if (venta.baseImponible < 0) {
      errores.push(`Base imponible negativa en venta de ${venta.razonSocial}.`)
    }
  }

  for (const compra of data.compras) {
    if (!compra.idProveedor) {
      errores.push('Una compra no tiene identificación de proveedor.')
    }
    if (compra.baseImponible < 0) {
      errores.push(`Base imponible negativa en compra de ${compra.razonSocial}.`)
    }
  }

  return {
    valido: errores.length === 0,
    errores,
  }
}

export async function exportAtsXml(tenantId: string, periodo: number): Promise<string> {
  const data = await getAtsData(tenantId, periodo)

  const validacion = validateAts(data)
  if (!validacion.valido) {
    throw new Error(`Datos ATS incompletos: ${validacion.errores.join('; ')}`)
  }

  const { year, month } = parsePeriodo(periodo)

  let xml = '<?xml version="1.0" encoding="UTF-8"?>\n'
  xml += '<![CDATA[\n'
  xml += '<![CDATA[\n'
  xml += '  <![CDATA[\n'
  xml += '    <![CDATA[\n'

  xml += '<ivaRecaudado></ivaRecaudado>\n'
  xml += '</ivaRecaudado>\n'

  xml += '<ventas>\n'
  for (const v of data.ventas) {
    xml += '  <venta>\n'
    xml += `    <tpIdCliente>${v.tpIdCliente}</tpIdCliente>\n`
    xml += `    <idCliente>${v.idCliente}</idCliente>\n`
    xml += `    <razonSocial>${escapeXml(v.razonSocial)}</razonSocial>\n`
    xml += `    <tipoComprobante>${v.tipoComprobante}</tipoComprobante>\n`
    xml += `    <numeroComprobantes>${v.numeroComprobantes}</numeroComprobantes>\n`
    xml += `    <baseImponible>${v.baseImponible.toFixed(2)}</baseImponible>\n`
    xml += `    <baseNoGraIva>${v.baseNoGraIva.toFixed(2)}</baseNoGraIva>\n`
    xml += `    <montoIva>${v.montoIva.toFixed(2)}</montoIva>\n`
    xml += `    <valorRetenidoIva>${v.valorRetenidoIva.toFixed(2)}</valorRetenidoIva>\n`
    xml += `    <valorRetenidoRenta>${v.valorRetenidoRenta.toFixed(2)}</valorRetenidoRenta>\n`
    xml += '  </venta>\n'
  }
  xml += '</ventas>\n'

  xml += '<compras>\n'
  for (const c of data.compras) {
    xml += '  <compra>\n'
    xml += `    <tpIdProveedor>${c.tpIdProveedor}</tpIdProveedor>\n`
    xml += `    <idProveedor>${c.idProveedor}</idProveedor>\n`
    xml += `    <razonSocial>${escapeXml(c.razonSocial)}</razonSocial>\n`
    xml += `    <tipoComprobante>${c.tipoComprobante}</tipoComprobante>\n`
    xml += `    <numeroComprobantes>${c.numeroComprobantes}</numeroComprobantes>\n`
    xml += `    <baseImponible>${c.baseImponible.toFixed(2)}</baseImponible>\n`
    xml += `    <baseNoGraIva>${c.baseNoGraIva.toFixed(2)}</baseNoGraIva>\n`
    xml += `    <montoIva>${c.montoIva.toFixed(2)}</montoIva>\n`
    xml += `    <valorRetenidoIva>${c.valorRetenidoIva.toFixed(2)}</valorRetenidoIva>\n`
    xml += `    <valorRetenidoRenta>${c.valorRetenidoRenta.toFixed(2)}</valorRetenidoRenta>\n`
    xml += '  </compra>\n'
  }
  xml += '</compras>\n'

  xml += '<retenciones>\n'
  for (const r of data.retenciones) {
    xml += '  <retencion>\n'
    xml += `    <tipoComprobante>${r.tipoComprobante}</tipoComprobante>\n`
    xml += `    <numeroComprobantes>${r.numeroComprobantes}</numeroComprobantes>\n`
    xml += `    <baseImponible>${r.baseImponible.toFixed(2)}</baseImponible>\n`
    xml += `    <valorRetenidoIva>${r.valorRetenidoIva.toFixed(2)}</valorRetenidoIva>\n`
    xml += `    <valorRetenidoRenta>${r.valorRetenidoRenta.toFixed(2)}</valorRetenidoRenta>\n`
    xml += '  </retencion>\n'
  }
  xml += '</retenciones>\n'

  if (data.anulados.length > 0) {
    xml += '<anulados>\n'
    for (const a of data.anulados) {
      xml += '  <anulado>\n'
      xml += `    <tipoComprobante>${a.tipoComprobante}</tipoComprobante>\n`
      xml += `    <establecimiento>${a.establecimiento}</establecimiento>\n`
      xml += `    <puntoEmision>${a.puntoEmision}</puntoEmision>\n`
      xml += `    <secuencialInicial>${a.secuencialInicial}</secuencialInicial>\n`
      xml += `    <secuencialFinal>${a.secuencialFinal}</secuencialFinal>\n`
      xml += `    <numeroAnulados>${a.numeroAnulados}</numeroAnulados>\n`
      xml += '  </anulado>\n'
    }
    xml += '</anulados>\n'
  }

  await db.query(
    `INSERT INTO reportes_fiscales (tenant_id, tipo, periodo, xml_generado, data, estado, fecha_generacion)
     VALUES ($1, 'ATS', $2, $3, $4::jsonb, 'GENERADO', NOW())
     ON CONFLICT (tenant_id, tipo, periodo)
     DO UPDATE SET xml_generado = $3, data = $4::jsonb, estado = 'GENERADO', fecha_generacion = NOW()`,
    [tenantId, periodo, xml, JSON.stringify(data)]
  )

  return xml
}

export function escapeXml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;')
}
