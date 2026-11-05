import { randomUUID } from 'crypto'
import { xmlBuilder } from './xml-builder'
import { xmlSigner } from './xml-signer'
import { sriSoapClient } from './sri-soap-client'
import { claveAccesoService, type Ambiente, type TipoEmision } from './clave-acceso'
import { xmlStorage } from './xml-storage'
import { db } from './db'

export interface DestinatarioData {
  razonSocial: string
  identificacion: string
  tipoIdentificacion: string
  direccion?: string
  telefono?: string
  email?: string
}

export interface TransporteData {
  placa: string
  transportistaRuc: string
  transportistaRazonSocial: string
}

export interface GuiaDetalle {
  codigo: string
  descripcion: string
  cantidad: number
}

export interface GuiaRemisionData {
  emisor: {
    ruc: string
    razonSocial: string
    direccionEstablecimiento: string
    contribuyenteEspecial?: string
    obligadoContabilidad?: string
  }
  destinatario: DestinatarioData
  transporte: TransporteData
  fechaInicioTransporte: string
  fechaFinTransporte?: string
  motivoTraslado: string
  direccionPartida: string
  direccionLlegada: string
  detalle: GuiaDetalle[]
  numeroFactura?: string
  tenantId: string
}

export interface SendResult {
  success: boolean
  claveAcceso: string
  numeroAutorizacion?: string
  error?: string
}

export interface AuthResult {
  success: boolean
  numeroAutorizacion: string
  fechaAutorizacion: string
  xmlAutorizado: string
}

async function generarSecuencialGuia(
  emisorId: string,
  estab: string,
  ptoEmi: string
): Promise<string> {
  const serie = `${estab}-${ptoEmi}`

  let sec = await db.queryOne<{ ultimo_secuencial: number }>(
    `SELECT ultimo_secuencial FROM secuenciales
     WHERE emisor_id = ? AND tipo_comprobante = '06' AND serie = ?
     FOR UPDATE`,
    [emisorId, serie]
  )

  const nextVal = (sec?.ultimo_secuencial || 0) + 1

  if (sec) {
    await db.query(
      `UPDATE secuenciales SET ultimo_secuencial = ?, updated_at = NOW()
       WHERE emisor_id = ? AND tipo_comprobante = '06' AND serie = ?`,
      [nextVal, emisorId, serie]
    )
  } else {
    await db.query(
      `INSERT INTO secuenciales (emisor_id, tipo_comprobante, serie, ultimo_secuencial, created_at, updated_at)
       VALUES (?, '06', ?, ?, NOW(), NOW())`,
      [emisorId, serie, nextVal]
    )
  }

  return String(nextVal).padStart(9, '0')
}

async function buscarFacturaSustento(
  numeroFactura: string
): Promise<{
  numDoc: string
  numAut: string
  fechaEmision: string
  codDoc: string
} | null> {
  const comprobante = await db.queryOne<any>(
    `SELECT clave_acceso, numero_autorizacion, serie, secuencial, fecha_emision
     FROM comprobantes
     WHERE tipo = '01'
       AND (clave_acceso = ? OR numero_autorizacion = ?)
     ORDER BY fecha_emision DESC
     LIMIT 1`,
    [numeroFactura, numeroFactura]
  )

  if (!comprobante) {
    const parts = numeroFactura.split('-')
    if (parts.length === 3) {
      const [estab, ptoEmi, sec] = parts
      const match = await db.queryOne<any>(
        `SELECT clave_acceso, numero_autorizacion, serie, secuencial, fecha_emision
         FROM comprobantes
         WHERE tipo = '01' AND serie = ? AND secuencial = ?
         ORDER BY fecha_emision DESC
         LIMIT 1`,
        [`${estab}-${ptoEmi}`, sec]
      )
      if (!match) return null
      return {
        numDoc: `${estab}${ptoEmi}${sec}`,
        numAut: match.numero_autorizacion || match.clave_acceso,
        fechaEmision: match.fecha_emision
          ? new Date(match.fecha_emision).toISOString().split('T')[0]
          : '',
        codDoc: '01',
      }
    }
    return null
  }

  const serieParts = (comprobante.serie || '-').split('-')
  const estab = serieParts[0] || '001'
  const ptoEmi = serieParts[1] || '001'
  const sec = comprobante.secuencial || '000000001'

  return {
    numDoc: `${estab}${ptoEmi}${sec}`,
    numAut: comprobante.numero_autorizacion || comprobante.clave_acceso,
    fechaEmision: comprobante.fecha_emision
      ? new Date(comprobante.fecha_emision).toISOString().split('T')[0]
      : new Date().toISOString().split('T')[0],
    codDoc: '01',
  }
}

export async function buildGuiaXml(data: GuiaRemisionData): Promise<string> {
  const emisor = await db.queryOne<any>(
    `SELECT id, ruc, razon_social, nombre_comercial, ambiente, tipo_emision,
            establecimiento, punto_emision, dir_matriz, direccion_matriz,
            contribuyente_rimpe, obligado_contabilidad
     FROM emisores
     WHERE ruc = ? AND tenant_id = ? AND activo = true`,
    [data.emisor.ruc, data.tenantId]
  )

  if (!emisor) {
    throw new Error(`Emisor con RUC ${data.emisor.ruc} no encontrado o inactivo`)
  }

  const ambiente = (emisor.ambiente || '1') as unknown as Ambiente
  const tipoEmision = (emisor.tipo_emision || '1') as unknown as TipoEmision
  const estab = (emisor.establecimiento || '001').padStart(3, '0')
  const ptoEmi = (emisor.punto_emision || '001').padStart(3, '0')
  const secuencial = await generarSecuencialGuia(emisor.id, estab, ptoEmi)

  const claveAcceso = claveAccesoService.generate({
    fechaEmision: new Date(),
    tipoComprobante: '06',
    ruc: emisor.ruc,
    ambiente,
    establecimiento: estab,
    puntoEmision: ptoEmi,
    secuencial,
    tipoEmision,
  })

  const destino = data.direccionLlegada
  const raizNombre = data.destinatario.razonSocial
  const codDocSustento = '01'
  let numDocSustento = ''
  let numAutDocSustento = ''
  let fechaEmisionDocSustento = ''

  if (data.numeroFactura) {
    const factura = await buscarFacturaSustento(data.numeroFactura)
    if (factura) {
      numDocSustento = factura.numDoc
      numAutDocSustento = factura.numAut
      fechaEmisionDocSustento = factura.fechaEmision
    } else {
      numDocSustento = data.numeroFactura.replace(/-/g, '')
      numAutDocSustento = ''
      fechaEmisionDocSustento = new Date().toISOString().split('T')[0]
    }
  } else {
    numDocSustento = estab + ptoEmi + secuencial
    numAutDocSustento = claveAcceso
    fechaEmisionDocSustento = new Date().toISOString().split('T')[0]
  }

  const xml = xmlBuilder.buildGuiaRemision({
    infoTributaria: {
      ambiente,
      tipoEmision,
      razonSocial: emisor.razon_social,
      nombreComercial: emisor.nombre_comercial || undefined,
      ruc: emisor.ruc,
      claveAcceso,
      codDoc: '06',
      estab,
      ptoEmi: ptoEmi,
      secuencial,
      dirMatriz: emisor.dir_matriz || emisor.direccion_matriz || '',
    },
    infoGuiaRemision: {
      fechaEmision: new Date().toISOString().split('T')[0],
      dirEstablecimiento: data.emisor.direccionEstablecimiento,
      dirPartida: data.direccionPartida,
      razonSocialTransportista: data.transporte.transportistaRazonSocial,
      tipoIdentificacionTransportista: '04',
      rucTransportista: data.transporte.transportistaRuc,
      obligadoContabilidad: data.emisor.obligadoContabilidad || 'NO',
      contribuyenteEspecial: data.emisor.contribuyenteEspecial || undefined,
      fechaIniTransporte: data.fechaInicioTransporte,
      fechaFinTransporte: data.fechaFinTransporte || undefined,
      placa: data.transporte.placa,
    },
    destinatarios: [
      {
        identificacionDestinatario: data.destinatario.identificacion,
        razonSocialDestinatario: raizNombre,
        dirDestinatario: destino,
        motivoTraslado: data.motivoTraslado,
        codDocSustento,
        numDocSustento,
        numAutDocSustento,
        fechaEmisionDocSustento,
        detalles: data.detalle.map((d) => ({
          codigoInterno: d.codigo,
          descripcion: d.descripcion,
          cantidad: d.cantidad,
        })),
      },
    ],
  })

  return xml
}

export async function sendGuiaRemision(guiaData: GuiaRemisionData): Promise<SendResult> {
  try {
    const emisor = await db.queryOne<any>(
      `SELECT id, ruc, ambiente FROM emisores
       WHERE ruc = ? AND tenant_id = ? AND activo = true`,
      [guiaData.emisor.ruc, guiaData.tenantId]
    )

    if (!emisor) {
      throw new Error(`Emisor con RUC ${guiaData.emisor.ruc} no encontrado o inactivo`)
    }

    const xmlSinFirma = await buildGuiaXml(guiaData)

    const parsedObj = await xmlBuilder.parseXml<any>(xmlSinFirma)
    const claveAcceso = parsedObj.guiaRemision.infoTributaria.claveAcceso

    const existing = await db.queryOne<any>(
      'SELECT id FROM comprobantes WHERE clave_acceso = ?',
      [claveAcceso]
    )

    if (existing) {
      return { success: false, claveAcceso, error: 'La guía de remisión ya existe en el sistema' }
    }

    const fechaEmision = new Date()
    const ruc = emisor.ruc

    xmlStorage.saveXml(ruc, claveAcceso, fechaEmision, 'sin_firma', xmlSinFirma)

    const xmlFirmado = await xmlSigner.signXmlForEmisor(xmlSinFirma, ruc)

    xmlStorage.saveXml(ruc, claveAcceso, fechaEmision, 'firmado', xmlFirmado)

    const result = await sriSoapClient.enviarYAutorizar(xmlFirmado, claveAcceso)

    const comprobanteId = randomUUID()

    await db.query(
      `INSERT INTO comprobantes (
        id, tenant_id, tipo, clave_acceso, serie, secuencial,
        ambiente, tipo_emision, estado, estado_sri,
        fecha_emision, fecha_autorizacion, numero_autorizacion,
        emisor_ruc, emisor_razon_social,
        receptor_identificacion, receptor_razon_social,
        created_at, updated_at
      ) VALUES (?, ?, '06', ?, ?, ?, ?, '1', ?, ?,
        ?, ?, ?, ?, ?, ?, ?, NOW(), NOW())`,
      [
        comprobanteId,
        guiaData.tenantId,
        claveAcceso,
        '',
        '',
        emisor.ambiente || '1',
        result.estado || 'RECHAZADO',
        result.estado || 'RECHAZADO',
        fechaEmision.toISOString().split('T')[0],
        result.fechaAutorizacion ? new Date(result.fechaAutorizacion) : fechaEmision,
        result.numeroAutorizacion || claveAcceso,
        ruc,
        guiaData.emisor.razonSocial,
        guiaData.destinatario.identificacion,
        guiaData.destinatario.razonSocial,
      ]
    )

    if (result.success && result.xmlAutorizado) {
      xmlStorage.saveXml(ruc, claveAcceso, fechaEmision, 'autorizado', result.xmlAutorizado)
    }

    return {
      success: result.success,
      claveAcceso,
      numeroAutorizacion: result.numeroAutorizacion,
      error: result.success
        ? undefined
        : result.mensajes?.map((m: any) => m.mensaje).join('; ') || 'Error al enviar al SRI',
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Error desconocido'
    return { success: false, claveAcceso: '', error: message }
  }
}

export async function autorizarGuia(comprobanteId: string): Promise<AuthResult> {
  const comprobante = await db.queryOne<any>(
    `SELECT id, clave_acceso, tipo, estado, emisor_ruc
     FROM comprobantes WHERE id = ?`,
    [comprobanteId]
  )

  if (!comprobante) {
    throw new Error(`Comprobante con ID ${comprobanteId} no encontrado`)
  }

  if (comprobante.tipo !== '06') {
    throw new Error('El comprobante no es una Guía de Remisión')
  }

  if (comprobante.estado === 'AUTORIZADO') {
    throw new Error('La Guía de Remisión ya está autorizada')
  }

  const authResponse = await sriSoapClient.autorizarComprobante(comprobante.clave_acceso)

  const auth = Array.isArray(authResponse?.autorizaciones?.autorizacion)
    ? authResponse.autorizaciones.autorizacion[0]
    : authResponse?.autorizaciones?.autorizacion

  if (!auth) {
    throw new Error('No se obtuvo respuesta de autorización del SRI')
  }

  const estado = auth.estado || 'DEVUELTA'

  if (estado !== 'AUTORIZADO') {
    const mensajes = auth.mensajes?.mensaje
    const msgs = Array.isArray(mensajes) ? mensajes : [mensajes]
    const errores = msgs
      .filter((m: any) => m)
      .map((m: any) => m.mensaje || '')
      .join('; ')
    throw new Error(`Guía de Remisión no autorizada: ${errores || estado}`)
  }

  await db.query(
    `UPDATE comprobantes SET
      estado = 'AUTORIZADO',
      estado_sri = 'AUTORIZADO',
      fecha_autorizacion = ?,
      numero_autorizacion = ?,
      updated_at = NOW()
     WHERE id = ?`,
    [
      auth.fechaAutorizacion ? new Date(auth.fechaAutorizacion) : new Date(),
      auth.numeroAutorizacion || comprobante.clave_acceso,
      comprobanteId,
    ]
  )

  if (typeof auth.comprobante === 'string') {
    const ruc = comprobante.emisor_ruc || ''
    const autorizadoPath = xmlStorage.saveXml(
      ruc,
      comprobante.clave_acceso,
      new Date(),
      'autorizado',
      auth.comprobante
    )

    await db
      .query(
        `INSERT INTO comprobante_xmls (comprobante_id, tipo, xml_autorizado_path, created_at)
         VALUES (?, 'autorizado', ?, NOW())`,
        [comprobanteId, autorizadoPath]
      )
      .catch(() => undefined)
  }

  return {
    success: true,
    numeroAutorizacion: auth.numeroAutorizacion || comprobante.clave_acceso,
    fechaAutorizacion: auth.fechaAutorizacion || new Date().toISOString(),
    xmlAutorizado: typeof auth.comprobante === 'string' ? auth.comprobante : '',
  }
}
