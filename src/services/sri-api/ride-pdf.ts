import * as QRCode from 'qrcode'
import type { PDFImage } from 'pdf-lib'
import { BrandPdf } from '@/services/pdf/layout'
import { xmlBuilder } from './xml-builder'
import { db } from './db'
import { resolveComprobanteXml } from './comprobante-xml-resolver'
import { getActiveRideDiseno, type RideDiseno } from './ride-diseno'

export interface RideEmisor {
  ruc: string
  razonSocial: string
  nombreComercial: string
  direccion: string
  dirEstablecimiento: string
  obligadoContabilidad: string
  contribuyenteEspecial: string
  agenteRetencion: string
  rimpe: string
  telefono: string
  email: string
}

export interface RideComprador {
  razonSocial: string
  identificacion: string
  tipoIdentificacion: string
  direccion: string
}

export interface RideDetalle {
  codigo: string
  codigoAuxiliar: string
  descripcion: string
  detalleAdicional: string
  cantidad: number
  precioUnitario: number
  descuento: number
  subtotal: number
}

export interface RideImpuesto {
  codigo: string
  codigoPorcentaje: string
  tarifa: number | null
  baseImponible: number
  valor: number
}

export interface RideFormaPago {
  forma: string
  valor: number
  plazo: string
  unidadTiempo: string
}

export interface RideCampo {
  nombre: string
  valor: string
}

export interface RideAutorizacion {
  numero: string
  fecha: string
  ambiente: string
  emision: string
}

export interface RideData {
  emisor: RideEmisor
  comprador: RideComprador
  comprobante: {
    tipo: string
    numeroCompleto: string
    fechaEmision: string
    claveAcceso: string
    guiaRemision: string
    moneda: string
  }
  referencias: RideCampo[]
  infoAdicional: RideCampo[]
  detalles: RideDetalle[]
  subtotal: number
  descuento: number
  propina: number | null
  totalImpuestos: number
  total: number
  autorizacion: RideAutorizacion
  qrData: string
  impuestos: RideImpuesto[]
  formasPago: RideFormaPago[]
  logo?: { bytes: Buffer; mime: 'image/png' | 'image/jpeg' } | null
}

const FORMA_PAGO_LABELS: Record<string, string> = {
  '01': 'Sin utilización del sistema financiero',
  '02': 'Cheque',
  '03': 'Tarjeta de crédito',
  '04': 'Tarjeta de débito',
  '05': 'Dinero electrónico',
  '06': 'Tarjeta empresarial',
  '07': 'Compensación de deudas',
  '08': 'Endoso de títulos',
  '09': 'Garantía bancaria',
  '10': 'Transferencia o depósito',
  '11': 'Giros',
  '12': 'Cobranzas',
  '13': 'Tarjeta prepago',
  '14': 'Tarjeta de crédito Visa',
  '15': 'Compensación de deudas',
  '16': 'Tarjeta de débito',
  '17': 'Dinero electrónico',
  '18': 'Tarjeta prepago',
  '19': 'Tarjeta de crédito',
  '20': 'Otros con utilización del sistema financiero',
  '21': 'Endoso de títulos',
}

const TIPO_ID_LABELS: Record<string, string> = {
  '04': 'RUC',
  '05': 'Cédula',
  '06': 'Pasaporte',
  '07': 'Consumidor final',
  '08': 'Identificación del exterior',
  '09': 'Placa',
}

export function getFormaPagoLabel(codigo: string): string {
  return FORMA_PAGO_LABELS[codigo] || `Código ${codigo}`
}

export function getTipoIdentificacionLabel(codigo: string): string {
  return TIPO_ID_LABELS[codigo] || 'Identificación'
}

function nodeText(node: unknown): string {
  if (node == null) return ''
  if (typeof node === 'string' || typeof node === 'number') return String(node).trim()
  if (typeof node === 'object' && node !== null && '_' in node) {
    const text = (node as { _: unknown })._
    if (typeof text === 'string' || typeof text === 'number') return String(text).trim()
  }
  return ''
}

function nodeAttr(node: unknown, name: string): string {
  if (!node || typeof node !== 'object') return ''
  const attrs = (node as { $?: Record<string, unknown> }).$
  const value = attrs?.[name]
  return value == null ? '' : String(value).trim()
}

function campoNombre(node: any): string {
  return nodeAttr(node, 'nombre') || String(node?.nombre || '').trim()
}

function campoValor(node: any): string {
  return nodeText(node) || nodeAttr(node, 'valor') || String(node?.valor || '').trim()
}

function readCampos(source: any): RideCampo[] {
  return ensureArray(source).flatMap((node) => {
    const nombre = campoNombre(node)
    const valor = campoValor(node)
    return nombre || valor ? [{ nombre: nombre || 'Dato', valor }] : []
  })
}

export function formatNumero(value: number | string, decimals = 2): string {
  const num = typeof value === 'string' ? parseFloat(value) : value
  return num.toFixed(decimals).replace(/\B(?=(\d{3})+(?!\d))/g, ',')
}

function ensureArray<T>(val: T | T[] | undefined): T[] {
  if (!val) return []
  return Array.isArray(val) ? val : [val]
}

async function parseXmlFromComprobante(
  claveAcceso: string,
  comprobanteId?: string
): Promise<{ documento: any; autorizacion: { numero: string; fecha: string } | null }> {
  const xmlString = await resolveComprobanteXml(claveAcceso, {
    comprobanteId,
    // RIDE usa XML local; si falta, Documentos encola descarga masiva del portal SRI.
    fetchFromSri: false,
  })

  if (!xmlString) {
    throw new Error(
      `No se encontró el XML autorizado para el comprobante ${claveAcceso}. ` +
        `Se puede recuperar con la descarga masiva del portal SRI.`
    )
  }

  let parsed: any = await xmlBuilder.parseXml(xmlString)
  const envelope = parsed?.autorizacion
  const autorizacion = envelope
    ? {
        numero: String(envelope.numeroAutorizacion || ''),
        fecha: String(envelope.fechaAutorizacion || ''),
      }
    : null

  if (envelope?.comprobante) {
    const inner = envelope.comprobante
    parsed = typeof inner === 'string' ? await xmlBuilder.parseXml(inner) : inner
  }

  return { documento: parsed, autorizacion }
}

export function extractRideDataFromParsed(parsed: any): RideData {
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
    const adicionales = readCampos(d.detallesAdicionales?.detAdicional)
      .map((campo) => (campo.nombre && campo.valor ? `${campo.nombre}: ${campo.valor}` : campo.valor || campo.nombre))
      .filter(Boolean)

    return {
      codigo: d.codigoPrincipal || d.codigoInterno || '',
      codigoAuxiliar: d.codigoAuxiliar || '',
      descripcion: d.descripcion || '',
      detalleAdicional: adicionales.join(' · '),
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
    codigo: String(imp.codigo || ''),
    codigoPorcentaje: String(imp.codigoPorcentaje || ''),
    tarifa: imp.tarifa == null || imp.tarifa === '' ? null : parseFloat(imp.tarifa),
    baseImponible: parseFloat(imp.baseImponible) || 0,
    valor: parseFloat(imp.valor) || 0,
  }))

  const totalImpuestosSum = impuestos.reduce((sum, i) => sum + i.valor, 0)
  const propina = infoDoc.propina == null || infoDoc.propina === '' ? null : parseFloat(infoDoc.propina) || 0

  const pagosArr: any[] = ensureArray(infoDoc.pagos?.pago || rootLevel?.pagos?.pago || [])
  const formasPago: RideFormaPago[] = pagosArr.map((p: any) => ({
    forma: String(p.formaPago || ''),
    valor: parseFloat(p.total) || 0,
    plazo: p.plazo == null ? '' : String(p.plazo),
    unidadTiempo: String(p.unidadTiempo || ''),
  }))

  const referencias: RideCampo[] = []
  const pushRef = (nombre: string, valor: unknown) => {
    const text = String(valor || '').trim()
    if (text) referencias.push({ nombre, valor: text })
  }
  pushRef('Guía de remisión', infoDoc.guiaRemision)
  pushRef('Documento modificado', infoDoc.numDocModificado)
  pushRef('Fecha documento sustento', infoDoc.fechaEmisionDocSustento)
  pushRef('Motivo', infoDoc.motivo)
  pushRef('Período fiscal', infoDoc.periodoFiscal)
  pushRef('Dirección de partida', infoDoc.dirPartida)
  pushRef('Inicio de transporte', infoDoc.fechaIniTransporte)
  pushRef('Fin de transporte', infoDoc.fechaFinTransporte)
  pushRef('Placa', infoDoc.placa)

  const qrData = buildQrData({
    ruc,
    razonSocial,
    claveAcceso,
    importeTotal,
    ambiente,
  })

  const tipoEmision = String(infoTributaria.tipoEmision || '1')

  return {
    emisor: {
      ruc,
      razonSocial,
      nombreComercial,
      direccion: infoTributaria.dirMatriz || '',
      dirEstablecimiento: String(infoDoc.dirEstablecimiento || ''),
      obligadoContabilidad: String(infoDoc.obligadoContabilidad || ''),
      contribuyenteEspecial: String(infoDoc.contribuyenteEspecial || ''),
      agenteRetencion: String(infoTributaria.agenteRetencion || ''),
      rimpe: String(infoTributaria.contribuyenteRimpe || infoTributaria.regimenMicroempresas || ''),
      telefono: '',
      email: '',
    },
    comprador: {
      razonSocial: String(
        infoDoc.razonSocialComprador || infoDoc.razonSocialSujetoRetenido || infoDoc.razonSocialTransportista || ''
      ),
      identificacion: String(
        infoDoc.identificacionComprador || infoDoc.identificacionSujetoRetenido || infoDoc.rucTransportista || ''
      ),
      tipoIdentificacion: String(
        infoDoc.tipoIdentificacionComprador ||
          infoDoc.tipoIdentificacionSujetoRetenido ||
          infoDoc.tipoIdentificacionTransportista ||
          ''
      ),
      direccion: String(infoDoc.direccionComprador || ''),
    },
    comprobante: {
      tipo,
      numeroCompleto,
      fechaEmision,
      claveAcceso,
      guiaRemision: String(infoDoc.guiaRemision || ''),
      moneda: String(infoDoc.moneda || 'DOLAR'),
    },
    referencias,
    infoAdicional: readCampos(rootLevel?.infoAdicional?.campoAdicional),
    detalles: rideDetalles,
    subtotal: totalSinImpuestos,
    descuento: totalDescuento,
    propina,
    totalImpuestos: totalImpuestosSum,
    total: importeTotal,
    autorizacion: {
      numero: '',
      fecha: '',
      ambiente: ambienteLabel,
      emision: tipoEmision === '2' ? 'CONTINGENCIA' : 'NORMAL',
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

async function loadEmisorMarca(ruc: string): Promise<{
  nombreComercial: string | null
  direccion: string
  logo: Buffer | null
  logoMime: string | null
} | null> {
  try {
    const emisor = await db.queryOne<{
      nombre_comercial: string | null
      direccion_matriz: string | null
      dir_matriz: string | null
      logo: unknown
      logo_mime: string | null
    }>(
      `SELECT nombre_comercial, direccion_matriz, dir_matriz, logo, logo_mime
       FROM emisores WHERE ruc = ? AND activo = true LIMIT 1`,
      [ruc]
    )
    if (!emisor) return null
    const raw = emisor.logo
    const logo = Buffer.isBuffer(raw)
      ? raw
      : raw instanceof Uint8Array
        ? Buffer.from(raw)
        : typeof raw === 'string' && raw.startsWith('\\x') && /^[0-9a-fA-F]+$/.test(raw.slice(2))
          ? Buffer.from(raw.slice(2), 'hex')
          : typeof raw === 'object' && raw !== null && 'data' in raw && Array.isArray((raw as { data: unknown }).data)
            ? Buffer.from((raw as { data: number[] }).data)
            : null
    return {
      nombreComercial: emisor.nombre_comercial,
      direccion: emisor.direccion_matriz || emisor.dir_matriz || '',
      logo,
      logoMime: emisor.logo_mime,
    }
  } catch {
    return null
  }
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

  const { documento, autorizacion } = await parseXmlFromComprobante(comprobante.clave_acceso, comprobante.id)
  const data = extractRideDataFromParsed(documento)

  if (autorizacion?.numero) data.autorizacion.numero = autorizacion.numero
  if (autorizacion?.fecha) data.autorizacion.fecha = autorizacion.fecha
  if (comprobante.numero_autorizacion) data.autorizacion.numero = comprobante.numero_autorizacion
  if (comprobante.fecha_autorizacion) {
    data.autorizacion.fecha = formatFechaAutorizacion(comprobante.fecha_autorizacion)
  } else if (data.autorizacion.fecha) {
    data.autorizacion.fecha = formatFechaAutorizacion(data.autorizacion.fecha)
  }

  const marca = await loadEmisorMarca(data.emisor.ruc)
  if (marca?.direccion) {
    data.emisor.direccion = marca.direccion
  }
  if (marca?.nombreComercial) {
    data.emisor.nombreComercial = marca.nombreComercial
  }
  if (marca?.logo && (marca.logoMime === 'image/png' || marca.logoMime === 'image/jpeg')) {
    data.logo = { bytes: marca.logo, mime: marca.logoMime }
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

const TIPO_LABELS: Record<string, string> = {
  '01': 'FACTURA',
  '02': 'NOTA DE VENTA',
  '03': 'LIQUIDACIÓN DE COMPRA',
  '04': 'NOTA DE CRÉDITO',
  '05': 'NOTA DE DÉBITO',
  '06': 'GUÍA DE REMISIÓN',
  '07': 'COMPROBANTE DE RETENCIÓN',
}

function money(value: number): string {
  return `$ ${formatNumero(value)}`
}

export function formatFechaAutorizacion(value: string | Date): string {
  const raw = value instanceof Date ? value.toISOString() : String(value || '').trim()
  if (!raw) return ''
  if (/^\d{2}\/\d{2}\/\d{4}/.test(raw)) return raw
  const date = new Date(raw)
  if (Number.isNaN(date.getTime())) return raw
  const parts = new Intl.DateTimeFormat('es-EC', {
    timeZone: 'America/Guayaquil',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(date)
  const pick = (type: Intl.DateTimeFormatPartTypes) => parts.find((part) => part.type === type)?.value || ''
  return `${pick('day')}/${pick('month')}/${pick('year')} ${pick('hour')}:${pick('minute')}:${pick('second')}`
}

function tarifaLabel(imp: RideImpuesto): string {
  if (imp.codigoPorcentaje === '6') return 'NO OBJETO DE IVA'
  if (imp.codigoPorcentaje === '7') return 'EXENTO DE IVA'
  if (imp.tarifa != null && !Number.isNaN(imp.tarifa)) {
    const tarifa = Number.isInteger(imp.tarifa) ? String(imp.tarifa) : formatNumero(imp.tarifa)
    return `${tarifa}%`
  }
  const known: Record<string, string> = {
    '0': '0%',
    '2': '12%',
    '3': '14%',
    '4': '15%',
    '5': '5%',
    '8': 'diferenciado',
    '10': '13%',
  }
  return known[imp.codigoPorcentaje] || imp.codigoPorcentaje
}

export function buildRideTotales(data: RideData): { label: string; value: string; strong?: boolean }[] {
  const lines: { label: string; value: string; strong?: boolean }[] = []
  for (const imp of data.impuestos.filter((item) => item.codigo === '2')) {
    lines.push({ label: `SUBTOTAL ${tarifaLabel(imp)}`, value: money(imp.baseImponible) })
  }
  lines.push({ label: 'SUBTOTAL SIN IMPUESTOS', value: money(data.subtotal) })
  lines.push({ label: 'TOTAL DESCUENTO', value: money(data.descuento) })
  for (const imp of data.impuestos) {
    const esIvaCero = imp.codigo === '2' && imp.valor === 0 && ['0', '6', '7'].includes(imp.codigoPorcentaje)
    if (esIvaCero) continue
    const nombre = imp.codigo === '2' ? `IVA ${tarifaLabel(imp)}` : imp.codigo === '3' ? 'ICE' : imp.codigo === '5' ? 'IRBPNR' : `IMPUESTO ${imp.codigo}`
    lines.push({ label: nombre, value: money(imp.valor) })
  }
  if (data.propina != null) lines.push({ label: 'PROPINA', value: money(data.propina) })
  const moneda = data.comprobante.moneda && data.comprobante.moneda !== 'DOLAR' ? ` ${data.comprobante.moneda}` : ''
  lines.push({ label: `VALOR TOTAL${moneda}`, value: money(data.total), strong: true })
  return lines
}

function emisorPanel(data: RideData): { label: string; value: string }[] {
  const lines: { label: string; value: string }[] = [
    { label: 'Razón social', value: data.emisor.razonSocial },
  ]
  const comercial = data.emisor.nombreComercial.trim()
  if (comercial && comercial.toLowerCase() !== data.emisor.razonSocial.trim().toLowerCase()) {
    lines.push({ label: 'Nombre comercial', value: comercial })
  }
  if (data.emisor.direccion) lines.push({ label: 'Dir. matriz', value: data.emisor.direccion })
  if (data.emisor.dirEstablecimiento && data.emisor.dirEstablecimiento !== data.emisor.direccion) {
    lines.push({ label: 'Dir. sucursal', value: data.emisor.dirEstablecimiento })
  }
  if (data.emisor.obligadoContabilidad) {
    lines.push({ label: 'Obligado a llevar contabilidad', value: data.emisor.obligadoContabilidad })
  }
  if (data.emisor.contribuyenteEspecial) {
    lines.push({ label: 'Contribuyente especial', value: data.emisor.contribuyenteEspecial })
  }
  if (data.emisor.agenteRetencion) lines.push({ label: 'Agente de retención', value: data.emisor.agenteRetencion })
  if (data.emisor.rimpe) lines.push({ label: 'Régimen', value: data.emisor.rimpe })
  return lines
}

function emisorLines(data: RideData): string[] {
  const lines = [data.emisor.razonSocial]
  const comercial = data.emisor.nombreComercial.trim()
  if (comercial && comercial.toLowerCase() !== data.emisor.razonSocial.trim().toLowerCase()) {
    lines.push(comercial)
  }
  if (data.emisor.direccion) lines.push(`Dir. matriz: ${data.emisor.direccion}`)
  if (data.emisor.dirEstablecimiento && data.emisor.dirEstablecimiento !== data.emisor.direccion) {
    lines.push(`Dir. sucursal: ${data.emisor.dirEstablecimiento}`)
  }
  if (data.emisor.obligadoContabilidad) {
    lines.push(`Obligado a llevar contabilidad: ${data.emisor.obligadoContabilidad}`)
  }
  if (data.emisor.contribuyenteEspecial) {
    lines.push(`Contribuyente especial Nro. ${data.emisor.contribuyenteEspecial}`)
  }
  if (data.emisor.agenteRetencion) lines.push(`Agente de retención: ${data.emisor.agenteRetencion}`)
  if (data.emisor.rimpe) lines.push(data.emisor.rimpe)
  return lines
}

function textoDetalle(det: RideDetalle): string {
  const extra = [det.codigoAuxiliar ? `Aux. ${det.codigoAuxiliar}` : '', det.detalleAdicional].filter(Boolean).join(' · ')
  return extra ? `${det.descripcion} · ${extra}` : det.descripcion
}

export async function renderRidePdf(data: RideData, diseno?: RideDiseno): Promise<Buffer> {
  const estilo = diseno ?? (await getActiveRideDiseno())
  const tipoLabel = TIPO_LABELS[data.comprobante.tipo] || `TIPO ${data.comprobante.tipo}`
  const pdf = await BrandPdf.create({
    ruc: data.emisor.ruc,
    razonSocial: data.emisor.razonSocial,
    nombreComercial: data.emisor.nombreComercial,
    accentHex: estilo.colorModo === 'fijo' ? estilo.colorHex : null,
  })

  let qrImage: PDFImage | null = null
  if (estilo.mostrarQr) {
    try {
      const qrDataUrl = await QRCode.toDataURL(data.qrData, { width: 180, margin: 0 })
      const qrPngBytes = Buffer.from(qrDataUrl.replace(/^data:image\/png;base64,/, ''), 'base64')
      qrImage = await pdf.doc.embedPng(qrPngBytes)
    } catch {
      qrImage = null
    }
  }

  let logoImage: PDFImage | null = null
  if (estilo.mostrarLogo && data.logo) {
    try {
      logoImage = data.logo.mime === 'image/png'
        ? await pdf.doc.embedPng(data.logo.bytes)
        : await pdf.doc.embedJpg(data.logo.bytes)
    } catch {
      logoImage = null
    }
  }

  const numeroAutorizacion = data.autorizacion.numero || data.comprobante.claveAcceso
  if (estilo.plantilla === 'banda') {
    pdf.drawHeader({
      documentTitle: tipoLabel,
      subtitle: `${data.comprobante.numeroCompleto} · ${data.autorizacion.ambiente}`,
      badge: data.autorizacion.emision,
      badgeTone: data.autorizacion.ambiente === 'PRODUCCIÓN' ? 'ok' : 'warn',
      logo: logoImage,
    })
    pdf.drawPanels(
      {
        title: 'EMISOR',
        lines: emisorPanel(data),
      },
      {
        title: 'AUTORIZACIÓN',
        lines: [
          { label: 'Número', value: numeroAutorizacion },
          { label: 'Fecha', value: data.autorizacion.fecha || '—' },
          { label: 'Ambiente', value: data.autorizacion.ambiente },
          { label: 'Emisión', value: data.autorizacion.emision },
          { label: 'Clave de acceso', value: data.comprobante.claveAcceso },
        ],
      }
    )
  } else {
    pdf.drawRideMasthead({
      logo: logoImage,
      emisorLines: emisorLines(data),
      documentTitle: tipoLabel,
      ruc: data.emisor.ruc,
      numero: data.comprobante.numeroCompleto,
      numeroAutorizacion,
      fechaAutorizacion: data.autorizacion.fecha,
      ambiente: data.autorizacion.ambiente,
      emision: data.autorizacion.emision,
      claveAcceso: data.comprobante.claveAcceso,
      qr: estilo.plantilla === 'clasico' ? qrImage : null,
    })
  }

  const buyerRows: { label: string; value: string }[][] = []
  if (data.comprador.razonSocial || data.comprador.identificacion) {
    buyerRows.push([
      { label: 'Razón social / nombres y apellidos', value: data.comprador.razonSocial || '—' },
      { label: getTipoIdentificacionLabel(data.comprador.tipoIdentificacion), value: data.comprador.identificacion || '—' },
      { label: 'Fecha de emisión', value: data.comprobante.fechaEmision || '—' },
    ])
  } else if (data.comprobante.fechaEmision) {
    buyerRows.push([{ label: 'Fecha de emisión', value: data.comprobante.fechaEmision }])
  }
  if (data.comprador.direccion) {
    buyerRows.push([{ label: 'Dirección del comprador', value: data.comprador.direccion }])
  }
  for (let i = 0; i < data.referencias.length; i += 3) {
    buyerRows.push(
      data.referencias.slice(i, i + 3).map((campo) => ({ label: campo.nombre, value: campo.valor }))
    )
  }
  pdf.drawLabeledRows(buyerRows)

  if (data.detalles.length > 0) {
    pdf.drawSectionTitle('Detalle')
    const descW = pdf.contentWidth - 68 - 42 - 58 - 48 - 64
    pdf.drawTable(
      [
        { header: 'Código', width: 68 },
        { header: 'Descripción', width: descW },
        { header: 'Cant.', width: 42, align: 'right' },
        { header: 'P. unitario', width: 58, align: 'right' },
        { header: 'Descuento', width: 48, align: 'right' },
        { header: 'Precio', width: 64, align: 'right' },
      ],
      data.detalles.map((det) => [
        det.codigo,
        textoDetalle(det),
        formatNumero(det.cantidad, 2),
        formatNumero(det.precioUnitario, 2),
        formatNumero(det.descuento),
        formatNumero(det.subtotal),
      ])
    )
  }

  pdf.drawRideClosing({
    adicional: estilo.mostrarAdicional
      ? data.infoAdicional.map((campo) => ({ label: campo.nombre, value: campo.valor }))
      : [],
    pagos: estilo.mostrarPagos
      ? data.formasPago.map((pago) => ({
          forma: getFormaPagoLabel(pago.forma),
          detalle: pago.plazo ? `Plazo: ${pago.plazo} ${pago.unidadTiempo || 'días'}` : '',
          valor: money(pago.valor),
        }))
      : [],
    totales: buildRideTotales(data),
  })

  if (estilo.plantilla !== 'clasico' && qrImage) {
    pdf.drawImage(qrImage, 72, 72, 'left')
  }

  pdf.drawMuted(
    'Representación impresa de un documento electrónico. Consulte su validez con la clave de acceso en www.sri.gob.ec'
  )

  return pdf.toBuffer()
}

export async function generateRidePdf(comprobanteId: string): Promise<Buffer> {
  const data = await getDatosRide(comprobanteId)
  const diseno = await getActiveRideDiseno()
  return renderRidePdf(data, diseno)
}

const LOGO_MUESTRA = Buffer.from(
  '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',
  'base64'
)

/** Factura de ejemplo para la vista previa del diseñador. */
export function facturaRideDeMuestra(): RideData {
  const clave = '0110202601179000000000110010010000001231234567811'
  return {
    emisor: {
      ruc: '1790000000001',
      razonSocial: 'OFSERCONT CIA. LTDA.',
      nombreComercial: 'OFSERCONT',
      direccion: 'Av. Amazonas N34-120 y Republica, Quito',
      dirEstablecimiento: 'Av. Republica E7-45 y Amazonas',
      obligadoContabilidad: 'SI',
      contribuyenteEspecial: '12345',
      agenteRetencion: 'NAC-DNCRASC20-00000001',
      rimpe: 'CONTRIBUYENTE REGIMEN RIMPE',
      telefono: '',
      email: '',
    },
    comprador: {
      razonSocial: 'CLIENTE DEMO S.A.',
      identificacion: '0990000000001',
      tipoIdentificacion: '04',
      direccion: 'Av. 6 de Diciembre N34-210, Quito',
    },
    comprobante: {
      tipo: '01',
      numeroCompleto: '001-001-000000123',
      fechaEmision: '01/10/2026',
      claveAcceso: clave,
      guiaRemision: '001-001-000000045',
      moneda: 'DOLAR',
    },
    referencias: [{ nombre: 'Guía de remisión', valor: '001-001-000000045' }],
    infoAdicional: [
      { nombre: 'Email', valor: 'cliente@demo.com' },
      { nombre: 'Teléfono', valor: '0991234567' },
    ],
    detalles: [
      {
        codigo: 'SERV-01',
        codigoAuxiliar: 'AUX-9',
        descripcion: 'Honorarios contables y tributarios del periodo',
        detalleAdicional: 'Periodo: Septiembre 2026',
        cantidad: 1,
        precioUnitario: 80,
        descuento: 0,
        subtotal: 80,
      },
      {
        codigo: 'SERV-02',
        codigoAuxiliar: '',
        descripcion: 'Declaracion mensual de IVA',
        detalleAdicional: '',
        cantidad: 1,
        precioUnitario: 20,
        descuento: 5,
        subtotal: 15,
      },
    ],
    subtotal: 95,
    descuento: 5,
    propina: 0,
    totalImpuestos: 14.25,
    total: 109.25,
    autorizacion: {
      numero: clave,
      fecha: '01/10/2026 10:15:32',
      ambiente: 'PRUEBAS',
      emision: 'NORMAL',
    },
    qrData: JSON.stringify({ ruc: '1790000000001', claveAcceso: clave, total: '109.25' }),
    impuestos: [
      { codigo: '2', codigoPorcentaje: '4', tarifa: 15, baseImponible: 95, valor: 14.25 },
      { codigo: '2', codigoPorcentaje: '0', tarifa: 0, baseImponible: 0, valor: 0 },
    ],
    formasPago: [{ forma: '20', valor: 109.25, plazo: '30', unidadTiempo: 'dias' }],
    logo: { bytes: LOGO_MUESTRA, mime: 'image/png' },
  }
}
