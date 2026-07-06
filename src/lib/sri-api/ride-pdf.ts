import { randomUUID } from 'crypto'
import { PDFDocument, rgb, StandardFonts, type PDFFont, type PDFPage } from 'pdf-lib'
import * as QRCode from 'qrcode'
import { existsSync, readFileSync } from 'fs'
import { xmlBuilder } from './xml-builder'
import { xmlStorage } from './xml-storage'
import { db } from './db'

export interface RideEmisor {
  ruc: string
  razonSocial: string
  nombreComercial: string
  direccion: string
  telefono: string
  email: string
}

export interface RideDetalle {
  codigo: string
  descripcion: string
  cantidad: number
  precioUnitario: number
  descuento: number
  subtotal: number
}

export interface RideImpuesto {
  codigo: string
  codigoPorcentaje: string
  baseImponible: number
  valor: number
}

export interface RideFormaPago {
  forma: string
  valor: number
}

export interface RideAutorizacion {
  numero: string
  fecha: string
  ambiente: string
}

export interface RideData {
  emisor: RideEmisor
  comprobante: {
    tipo: string
    numeroCompleto: string
    fechaEmision: string
    claveAcceso: string
  }
  detalles: RideDetalle[]
  subtotal: number
  descuento: number
  totalImpuestos: number
  total: number
  autorizacion: RideAutorizacion
  qrData: string
  impuestos: RideImpuesto[]
  formasPago: RideFormaPago[]
}

const FORMA_PAGO_LABELS: Record<string, string> = {
  '01': 'Efectivo',
  '02': 'Cheque',
  '03': 'Tarjeta de Crédito',
  '04': 'Tarjeta de Débito',
  '05': 'Dinero Electrónico',
  '06': 'Tarjeta Empresarial',
  '07': 'Compensación Deudas',
  '08': 'Endoso de Títulos',
  '09': 'Garantía Bancaria',
  '10': 'Transferencia Depósito',
  '11': 'Giros',
  '12': 'Cobranzas',
  '13': 'Tarjeta Prepagada',
  '14': 'Tarjeta de Crédito Visa',
  '15': 'Tarjeta de Crédito Mastercard',
  '16': 'Tarjeta de Crédito Amex',
  '17': 'Tarjeta de Crédito Diners',
  '18': 'Nota de Crédito',
  '19': 'Otros',
  '20': 'Compensación',
}

export function getFormaPagoLabel(codigo: string): string {
  return FORMA_PAGO_LABELS[codigo] || `Código ${codigo}`
}

export function formatNumero(value: number | string, decimals = 2): string {
  const num = typeof value === 'string' ? parseFloat(value) : value
  return num.toFixed(decimals).replace(/\B(?=(\d{3})+(?!\d))/g, ',')
}

function ensureArray<T>(val: T | T[] | undefined): T[] {
  if (!val) return []
  return Array.isArray(val) ? val : [val]
}

async function parseXmlFromComprobante(claveAcceso: string): Promise<any> {
  const xmlRecord = await db.queryOne<any>(
    `SELECT cx.ruta_archivo, cx.xml_autorizado_path
     FROM comprobante_xmls cx
     JOIN comprobantes c ON c.id = cx.comprobante_id
     WHERE c.clave_acceso = ? AND cx.tipo = 'autorizado'
     ORDER BY cx.created_at DESC
     LIMIT 1`,
    [claveAcceso]
  )

  if (!xmlRecord) {
    const fallback = await db.queryOne<any>(
      `SELECT cx.ruta_archivo, cx.xml_autorizado_path
       FROM comprobante_xmls cx
       JOIN comprobantes c ON c.id = cx.comprobante_id
       WHERE c.clave_acceso = ?
       ORDER BY cx.created_at DESC
       LIMIT 1`,
      [claveAcceso]
    )
    if (!fallback) {
      throw new Error(`No se encontró el XML autorizado para el comprobante ${claveAcceso}`)
    }
  }

  const record = xmlRecord
  let xmlString: string | null = null

  if (record.xml_autorizado_path) {
    const fullPath = xmlStorage.getFullPath(record.xml_autorizado_path)
    if (existsSync(fullPath)) {
      xmlString = readFileSync(fullPath, 'utf-8')
    }
  }

  if (!xmlString && record.ruta_archivo) {
    const fullPath = xmlStorage.getFullPath(record.ruta_archivo)
    if (existsSync(fullPath)) {
      xmlString = readFileSync(fullPath, 'utf-8')
    }
  }

  if (!xmlString) {
    throw new Error(`No se pudo leer el archivo XML del comprobante ${claveAcceso}`)
  }

  let parsed: any = await xmlBuilder.parseXml(xmlString)

  if (parsed.autorizacion?.comprobante) {
    const inner = parsed.autorizacion.comprobante
    parsed = typeof inner === 'string' ? await xmlBuilder.parseXml(inner) : inner
  }

  return parsed
}

function extractRideDataFromParsed(parsed: any): RideData {
  let tipo = ''
  let infoTributaria: any = null
  let infoDoc: any = null
  let detalles: any[] = []
  let rootLevel: any = null

  if (parsed.factura) {
    tipo = '01'
    infoTributaria = parsed.factura.infoTributaria
    infoDoc = parsed.factura.infoFactura
    detalles = ensureArray(parsed.factura.detalles?.detalle)
    rootLevel = parsed.factura
  } else if (parsed.comprobanteRetencion) {
    tipo = '07'
    infoTributaria = parsed.comprobanteRetencion.infoTributaria
    infoDoc = parsed.comprobanteRetencion.infoCompRetencion
    rootLevel = parsed.comprobanteRetencion
  } else if (parsed.notaCredito) {
    tipo = '04'
    infoTributaria = parsed.notaCredito.infoTributaria
    infoDoc = parsed.notaCredito.infoNotaCredito
    detalles = ensureArray(parsed.notaCredito.detalles?.detalle)
    rootLevel = parsed.notaCredito
  } else if (parsed.notaDebito) {
    tipo = '05'
    infoTributaria = parsed.notaDebito.infoTributaria
    infoDoc = parsed.notaDebito.infoNotaDebito
    rootLevel = parsed.notaDebito
  } else if (parsed.liquidacionCompra) {
    tipo = '03'
    infoTributaria = parsed.liquidacionCompra.infoTributaria
    infoDoc = parsed.liquidacionCompra.infoLiquidacionCompra
    detalles = ensureArray(parsed.liquidacionCompra.detalles?.detalle)
    rootLevel = parsed.liquidacionCompra
  } else if (parsed.guiaRemision) {
    tipo = '06'
    infoTributaria = parsed.guiaRemision.infoTributaria
    infoDoc = parsed.guiaRemision.infoGuiaRemision
    rootLevel = parsed.guiaRemision
  } else {
    throw new Error('Tipo de comprobante no soportado para RIDE')
  }

  if (!infoTributaria || !infoDoc) {
    throw new Error('Estructura del comprobante inválida')
  }

  const ruc = infoTributaria.ruc || ''
  const razonSocial = infoTributaria.razonSocial || ''
  const nombreComercial = infoTributaria.nombreComercial || razonSocial

  const claveAcceso = infoTributaria.claveAcceso || ''
  const ambiente = infoTributaria.ambiente || '1'
  const ambienteLabel = ambiente === '2' ? 'PRODUCCIÓN' : 'PRUEBAS'
  const serie = `${infoTributaria.estab || '000'}-${infoTributaria.ptoEmi || '000'}`
  const secuencial = infoTributaria.secuencial || '000000000'
  const numeroCompleto = `${serie}-${secuencial}`

  let fechaEmision = String(infoDoc.fechaEmision || '')

  let totalSinImpuestos = 0
  let totalDescuento = 0
  let importeTotal = 0

  if (tipo === '01' || tipo === '04' || tipo === '03') {
    totalSinImpuestos = parseFloat(infoDoc.totalSinImpuestos) || 0
    totalDescuento = parseFloat(infoDoc.totalDescuento) || 0

    if (tipo === '01') {
      importeTotal = parseFloat(infoDoc.importeTotal) || 0
    } else if (tipo === '04') {
      importeTotal = parseFloat(infoDoc.valorModificacion) || 0
    } else {
      importeTotal = parseFloat(rootLevel?.importeTotal) || 0
    }
  } else if (tipo === '05') {
    totalSinImpuestos = parseFloat(infoDoc.totalSinImpuestos) || 0
    importeTotal = parseFloat(infoDoc.valorTotal) || 0
  } else if (tipo === '07') {
    importeTotal = parseFloat(rootLevel?.infoCompRetencion?.importeTotal) || 0
  }

  const rideDetalles: RideDetalle[] = detalles.map((d: any) => {
    const cantidad = parseFloat(d.cantidad) || 1
    const precioUnitario = parseFloat(d.precioUnitario) || 0
    const descuento = parseFloat(d.descuento) || 0
    const subtotal = parseFloat(d.precioTotalSinImpuesto) || 0

    return {
      codigo: d.codigoPrincipal || d.codigoInterno || '',
      descripcion: d.descripcion || '',
      cantidad,
      precioUnitario,
      descuento,
      subtotal,
    }
  })

  const totalConImpuestos: any[] = ensureArray(
    infoDoc.totalConImpuestos?.totalImpuesto || rootLevel?.totalConImpuestos?.totalImpuesto || []
  )
  const impuestos: RideImpuesto[] = totalConImpuestos.map((imp: any) => ({
    codigo: imp.codigo || '',
    codigoPorcentaje: imp.codigoPorcentaje || '',
    baseImponible: parseFloat(imp.baseImponible) || 0,
    valor: parseFloat(imp.valor) || 0,
  }))

  const totalImpuestosSum = impuestos.reduce((sum, i) => sum + i.valor, 0)

  const pagosArr: any[] = ensureArray(infoDoc.pagos?.pago || rootLevel?.pagos?.pago || [])
  const formasPago: RideFormaPago[] = pagosArr.map((p: any) => ({
    forma: p.formaPago || '01',
    valor: parseFloat(p.total) || 0,
  }))

  if (formasPago.length === 0) {
    formasPago.push({ forma: '01', valor: importeTotal })
  }

  const qrData = buildQrData({
    ruc,
    razonSocial,
    claveAcceso,
    importeTotal,
    ambiente,
  })

  return {
    emisor: {
      ruc,
      razonSocial,
      nombreComercial,
      direccion: infoTributaria.dirMatriz || '',
      telefono: '',
      email: '',
    },
    comprobante: {
      tipo,
      numeroCompleto,
      fechaEmision,
      claveAcceso,
    },
    detalles: rideDetalles,
    subtotal: totalSinImpuestos,
    descuento: totalDescuento,
    totalImpuestos: totalImpuestosSum,
    total: importeTotal,
    autorizacion: {
      numero: '',
      fecha: '',
      ambiente: ambienteLabel,
    },
    qrData,
    impuestos,
    formasPago,
  }
}

export function buildQrData(data: {
  ruc: string
  razonSocial: string
  claveAcceso: string
  importeTotal: number
  ambiente: string
}): string {
  return JSON.stringify({
    ruc: data.ruc,
    razonSocial: data.razonSocial,
    claveAcceso: data.claveAcceso,
    total: data.importeTotal.toFixed(2),
    ambiente: data.ambiente,
  })
}

async function getDireccionMatrizFromEmisor(ruc: string): Promise<string> {
  const emisor = await db.queryOne<{ direccion_matriz: string | null; dir_matriz: string | null }>(
    `SELECT direccion_matriz, dir_matriz FROM emisores WHERE ruc = ? AND activo = true LIMIT 1`,
    [ruc]
  )
  return emisor?.direccion_matriz || emisor?.dir_matriz || ''
}

export async function getDatosRide(comprobanteId: string): Promise<RideData> {
  const comprobante = await db.queryOne<any>(
    `SELECT id, clave_acceso, tipo, serie, secuencial, ambiente,
            estado, estado_sri, fecha_emision, fecha_autorizacion,
            numero_autorizacion, importe_total,
            emisor_ruc, emisor_razon_social
     FROM comprobantes WHERE id = ?`,
    [comprobanteId]
  )

  if (!comprobante) {
    throw new Error(`Comprobante con ID ${comprobanteId} no encontrado`)
  }

  const parsed = await parseXmlFromComprobante(comprobante.clave_acceso)
  const data = extractRideDataFromParsed(parsed)

  data.autorizacion.numero = comprobante.numero_autorizacion || ''
  data.autorizacion.fecha = comprobante.fecha_autorizacion
    ? new Date(comprobante.fecha_autorizacion).toISOString()
    : ''

  const dirMatriz = await getDireccionMatrizFromEmisor(data.emisor.ruc)
  if (dirMatriz) {
    data.emisor.direccion = dirMatriz
  }

  data.qrData = buildQrData({
    ruc: data.emisor.ruc,
    razonSocial: data.emisor.razonSocial,
    claveAcceso: data.comprobante.claveAcceso,
    importeTotal: data.total,
    ambiente: comprobante.ambiente || '1',
  })

  return data
}

export async function generateRidePdf(comprobanteId: string): Promise<Buffer> {
  const data = await getDatosRide(comprobanteId)

  const pdfDoc = await PDFDocument.create()
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica)
  const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold)
  const fontMono = await pdfDoc.embedFont(StandardFonts.Courier)

  let qrImage: { image: any; width: number; height: number } | null = null
  try {
    const qrDataUrl = await QRCode.toDataURL(data.qrData, { width: 200, margin: 2 })
    const qrPngBytes = Buffer.from(qrDataUrl.replace(/^data:image\/png;base64,/, ''), 'base64')
    const embed = await pdfDoc.embedPng(qrPngBytes)
    qrImage = { image: embed, width: embed.width, height: embed.height }
  } catch {
    // QR no disponible
  }

  const pageWidth = 612
  const pageHeight = 792
  const margin = 48
  const contentWidth = pageWidth - margin * 2

  let page = pdfDoc.addPage([pageWidth, pageHeight])
  let y = pageHeight - margin

  function addPageIfNeeded(requiredY: number): void {
    if (y - requiredY < margin + 20) {
      page = pdfDoc.addPage([pageWidth, pageHeight])
      y = pageHeight - margin
    }
  }

  function drawText(
    text: string,
    x: number,
    yPos: number,
    opts: { size?: number; font?: PDFFont; color?: number } = {}
  ): void {
    page.drawText(text, {
      x,
      y: yPos,
      size: opts.size ?? 9,
      font: opts.font ?? font,
      color: opts.color !== undefined ? rgb(opts.color, opts.color, opts.color) : rgb(0, 0, 0),
    })
  }

  function drawLine(yPos: number): void {
    page.drawLine({
      start: { x: margin, y: yPos },
      end: { x: pageWidth - margin, y: yPos },
      thickness: 0.5,
      color: rgb(0.4, 0.4, 0.4),
    })
  }

  function drawRect(yPos: number, height: number, fillColor: number[]): void {
    page.drawRectangle({
      x: margin,
      y: yPos,
      width: contentWidth,
      height,
      color: rgb(fillColor[0], fillColor[1], fillColor[2]),
    })
  }

  const environmentLabel = data.autorizacion.ambiente
  const isProduccion = environmentLabel === 'PRODUCCIÓN'

  drawRect(y - 4, 32, [0.95, 0.95, 0.97])
  drawText('RIDE - SRI', margin, y + 10, { size: 16, font: fontBold, color: 0.1 })
  drawText('Representación Impresa de Documentos Electrónicos', margin, y - 8, { size: 8, color: 0.4 })

  const envBadge = isProduccion ? 'PRODUCCIÓN' : 'PRUEBAS'
  const envColor = isProduccion ? [0.2, 0.6, 0.2] : [0.85, 0.5, 0.1]
  const badgeWidth = envBadge.length * 6 + 16
  page.drawRectangle({
    x: pageWidth - margin - badgeWidth,
    y: y + 8,
    width: badgeWidth,
    height: 18,
    color: rgb(envColor[0], envColor[1], envColor[2]),
  })
  drawText(envBadge, pageWidth - margin - badgeWidth + 8, y + 14, { size: 9, font: fontBold, color: 1 })

  y -= 48
  drawLine(y)
  y -= 12

  drawText('DATOS DEL EMISOR', margin, y, { size: 10, font: fontBold })
  y -= 14
  drawText(`RUC: ${data.emisor.ruc}`, margin, y, { size: 9 })
  y -= 12
  drawText(`Razón Social: ${data.emisor.razonSocial}`, margin, y, { size: 9 })
  y -= 12
  if (data.emisor.direccion) {
    drawText(`Dirección: ${data.emisor.direccion}`, margin, y, { size: 9 })
    y -= 12
  }

  drawLine(y)
  y -= 12

  drawText('DATOS DEL DOCUMENTO', margin, y, { size: 10, font: fontBold })
  y -= 14
  const tipoLabels: Record<string, string> = {
    '01': 'FACTURA',
    '02': 'NOTA DE VENTA',
    '03': 'LIQUIDACIÓN DE COMPRA',
    '04': 'NOTA DE CRÉDITO',
    '05': 'NOTA DE DÉBITO',
    '06': 'GUÍA DE REMISIÓN',
    '07': 'COMPROBANTE DE RETENCIÓN',
  }
  const tipoLabel = tipoLabels[data.comprobante.tipo] || `TIPO ${data.comprobante.tipo}`
  drawText(`Tipo: ${tipoLabel}`, margin, y, { size: 9 })
  y -= 12
  drawText(`Número: ${data.comprobante.numeroCompleto}`, margin, y, { size: 9 })
  y -= 12
  drawText(`Fecha de Emisión: ${data.comprobante.fechaEmision}`, margin, y, { size: 9 })
  y -= 12
  drawText(`Clave de Acceso: ${data.comprobante.claveAcceso}`, margin, y, { size: 8, font: fontMono })
  y -= 14

  drawLine(y)
  y -= 12

  if (data.detalles.length > 0) {
    drawText('DETALLE DE PRODUCTOS / SERVICIOS', margin, y, { size: 10, font: fontBold })
    y -= 16

    const tableHeaders = ['Código', 'Descripción', 'Cant.', 'P. Unit.', 'Desc.', 'Subtotal']
    const colWidths = [60, contentWidth - 280, 36, 60, 50, 60]
    let colX = margin
    const headerY = y + 2

    drawRect(y - 4, 18, [0.2, 0.2, 0.25])
    tableHeaders.forEach((header, i) => {
      drawText(header, colX + 2, headerY, { size: 8, font: fontBold, color: 1 })
      colX += colWidths[i]
    })

    y -= 24

    data.detalles.forEach((det, idx) => {
      addPageIfNeeded(48)

      if (idx % 2 === 1) {
        drawRect(y - 2, 16, [0.97, 0.97, 0.98])
      }

      const rowY = y + 2
      const cols = [
        det.codigo,
        det.descripcion,
        formatNumero(det.cantidad, 4),
        formatNumero(det.precioUnitario, 4),
        formatNumero(det.descuento),
        formatNumero(det.subtotal),
      ]

      colX = margin
      cols.forEach((val, ci) => {
        drawText(val.length > 18 ? val.substring(0, 18) + '...' : val, colX + 2, rowY, {
          size: 7.5,
        })
        colX += colWidths[ci]
      })

      y -= 20
    })

    drawLine(y)
    y -= 12
  }

  addPageIfNeeded(80)

  const totCol1 = margin + contentWidth * 0.55
  const totCol2 = margin + contentWidth * 0.78

  drawText('Subtotal:', totCol1, y, { size: 9 })
  drawText(`$ ${formatNumero(data.subtotal)}`, totCol2, y, { size: 9, font: fontBold })
  y -= 13

  if (data.descuento > 0) {
    drawText('Descuento:', totCol1, y, { size: 9 })
    drawText(`$ ${formatNumero(data.descuento)}`, totCol2, y, { size: 9 })
    y -= 13
  }

  data.impuestos.forEach((imp) => {
    addPageIfNeeded(32)
    const impLabel = getImpuestoLabel(imp.codigo, imp.codigoPorcentaje)
    drawText(`${impLabel}:`, totCol1, y, { size: 9 })
    drawText(`$ ${formatNumero(imp.valor)}`, totCol2, y, { size: 9 })
    y -= 13
  })

  drawLine(y)
  y -= 10

  drawText('TOTAL:', totCol1, y, { size: 11, font: fontBold })
  drawText(`$ ${formatNumero(data.total)}`, totCol2, y, { size: 11, font: fontBold })
  y -= 18

  drawLine(y)
  y -= 12

  if (data.formasPago.length > 0) {
    drawText('FORMAS DE PAGO', margin, y, { size: 10, font: fontBold })
    y -= 14
    data.formasPago.forEach((fp) => {
      addPageIfNeeded(28)
      drawText(`${getFormaPagoLabel(fp.forma)}:`, margin, y, { size: 9 })
      drawText(`$ ${formatNumero(fp.valor)}`, totCol2, y, { size: 9 })
      y -= 13
    })
    drawLine(y)
    y -= 12
  }

  addPageIfNeeded(100)

  if (qrImage) {
    const qrSize = 96
    page.drawImage(qrImage.image, {
      x: pageWidth - margin - qrSize - 8,
      y: y - qrSize - 8,
      width: qrSize,
      height: qrSize,
    })
  }

  drawText('AUTORIZACIÓN', margin, y, { size: 10, font: fontBold })
  y -= 14
  drawText(`Número de Autorización: ${data.autorizacion.numero || 'N/A'}`, margin, y, { size: 9, font: fontMono })
  y -= 12
  drawText(`Fecha de Autorización: ${data.autorizacion.fecha || 'N/A'}`, margin, y, { size: 9 })
  y -= 12
  drawText(`Ambiente: ${data.autorizacion.ambiente}`, margin, y, { size: 9 })
  y -= 14
  drawLine(y)
  y -= 10

  drawText(
    'Documento electrónico generado conforme a la Ley de Comercio Electrónico, Firmas Electrónicas y Mensajes de Datos.',
    margin,
    y,
    { size: 7, color: 0.5 }
  )
  y -= 10
  drawText(
    'Este documento puede ser verificado en el portal web del SRI: https://www.sri.gob.ec',
    margin,
    y,
    { size: 7, color: 0.5 }
  )

  const pdfBytes = await pdfDoc.save()
  return Buffer.from(pdfBytes)
}

function getImpuestoLabel(codigo: string, codigoPorcentaje: string): string {
  const map: Record<string, string> = {
    '2': 'IVA',
    '3': 'ICE',
    '5': 'IRBPNR',
    '6': 'RENTA',
    '7': 'RENTA',
    '8': 'IVA',
  }
  const base = map[codigo] || `Imp. ${codigo}`
  const pcts: Record<string, string> = {
    '0': '0%',
    '2': '12%',
    '3': '14%',
    '4': '15%',
    '6': '0%',
    '7': '0%',
    '8': '0%',
    '9': '0%',
    '10': '0%',
  }
  return `${base} ${pcts[codigoPorcentaje] || codigoPorcentaje}`
}
