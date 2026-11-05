import { existsSync, readFileSync } from 'fs'
import { join } from 'path'
import { db } from './db'
import { xmlStorage } from './xml-storage'

function looksLikeXml(value: string): boolean {
  const trimmed = value.trimStart()
  return (
    trimmed.startsWith('<?xml') ||
    trimmed.startsWith('<autorizacion') ||
    trimmed.startsWith('<factura') ||
    trimmed.startsWith('<comprobanteRetencion') ||
    trimmed.startsWith('<notaCredito') ||
    trimmed.startsWith('<notaDebito') ||
    trimmed.startsWith('<liquidacionCompra') ||
    trimmed.startsWith('<guiaRemision') ||
    trimmed.startsWith('<soap:') ||
    trimmed.startsWith('<Respuesta')
  )
}

function looksLikeFilePath(value: string): boolean {
  if (looksLikeXml(value)) return false
  // Base64 PDF / blobs largos no son rutas
  if (value.length > 500 && !value.includes('/') && !value.includes('\\')) return false
  if (value.includes('.xml') || value.includes('/') || value.includes('\\')) return true
  return value.length < 400
}

function readXmlPathIfExists(relativeOrAbsolute: string): string | null {
  if (!relativeOrAbsolute) return null
  const candidates = [
    relativeOrAbsolute,
    xmlStorage.getFullPath(relativeOrAbsolute),
    join(process.cwd(), relativeOrAbsolute),
  ]
  for (const fullPath of candidates) {
    if (existsSync(fullPath)) {
      try {
        return readFileSync(fullPath, 'utf-8')
      } catch {
        // continuar
      }
    }
  }
  return null
}

function resolveStoredField(value: string | null | undefined): string | null {
  if (!value) return null
  if (looksLikeXml(value)) return value
  if (looksLikeFilePath(value)) return readXmlPathIfExists(value)
  return null
}

/** Busca XML en disco por clave (emisión sin registro en comprobante_xmls). */
export function tryReadXmlFromDisk(claveAcceso: string): string | null {
  if (!claveAcceso || claveAcceso.length < 23) return null

  const month = claveAcceso.substring(2, 4)
  const year = claveAcceso.substring(4, 8)
  const ruc = claveAcceso.substring(10, 23)

  const relativeCandidates = [
    join(ruc, year, month, 'autorizados', `${claveAcceso}.xml`),
    join(ruc, year, month, 'firmados', `${claveAcceso}.xml`),
    join(ruc, year, month, 'sin_firmar', `${claveAcceso}.xml`),
  ]

  for (const rel of relativeCandidates) {
    const content = xmlStorage.readXml(rel)
    if (content) return content
  }

  const flatCandidates = [
    join(process.cwd(), 'downloads', 'XML', `${claveAcceso}.xml`),
    join(process.cwd(), 'downloads', 'xmls', `${claveAcceso}.xml`),
  ]
  for (const fullPath of flatCandidates) {
    if (existsSync(fullPath)) {
      try {
        return readFileSync(fullPath, 'utf-8')
      } catch {
        // continuar
      }
    }
  }

  return null
}

async function tryFetchXmlFromSri(
  claveAcceso: string,
  comprobanteId?: string
): Promise<string | null> {
  try {
    const { sriSoapClient } = await import('./sri-soap-client')
    // Una sola consulta corta: no bloquear la UI minutos
    const respuesta = await sriSoapClient.autorizarComprobanteRapido(claveAcceso)
    const auth = Array.isArray(respuesta?.autorizaciones?.autorizacion)
      ? respuesta.autorizaciones.autorizacion[0]
      : respuesta?.autorizaciones?.autorizacion

    if (!auth || auth.estado !== 'AUTORIZADO' || !auth.comprobante) {
      return null
    }

    const xmlContent =
      typeof auth.comprobante === 'string' ? auth.comprobante : String(auth.comprobante)

    if (comprobanteId) {
      try {
        const { saveAutorizadoXml } = await import('./comprobante-importer')
        const ruc = claveAcceso.substring(10, 23)
        const day = claveAcceso.substring(0, 2)
        const month = claveAcceso.substring(2, 4)
        const year = claveAcceso.substring(4, 8)
        const fecha = new Date(`${year}-${month}-${day}T12:00:00`)
        await saveAutorizadoXml(comprobanteId, ruc, claveAcceso, fecha, xmlContent)

        // Completar metadatos de autorización si faltan
        if (auth.numeroAutorizacion || auth.fechaAutorizacion) {
          await db.query(
            `UPDATE comprobantes SET
              estado = 'AUTORIZADO',
              estado_sri = 'AUTORIZADO',
              numero_autorizacion = COALESCE(?, numero_autorizacion),
              fecha_autorizacion = COALESCE(?, fecha_autorizacion),
              updated_at = NOW()
             WHERE id = ?`,
            [
              auth.numeroAutorizacion || null,
              auth.fechaAutorizacion ? new Date(auth.fechaAutorizacion) : null,
              comprobanteId,
            ]
          )
        }
      } catch (err) {
        console.warn(`[XML] No se pudo persistir XML del SRI para ${claveAcceso}:`, err)
      }
    }

    return xmlContent
  } catch (err) {
    console.warn(`[XML] Falló consulta SOAP de autorización para ${claveAcceso}:`, err)
    return null
  }
}

/**
 * Resuelve el XML del comprobante (misma fuente para descarga XML y generación RIDE).
 * Acepta ruta en disco o XML inline en comprobante_xmls.ruta_archivo.
 */
export async function resolveComprobanteXml(
  claveAcceso: string,
  options?: { comprobanteId?: string; fetchFromSri?: boolean }
): Promise<string | null> {
  const comprobanteId = options?.comprobanteId
  const fetchFromSri = options?.fetchFromSri !== false

  let id = comprobanteId
  if (!id) {
    const row = await db.queryOne<{ id: string }>(
      'SELECT id FROM comprobantes WHERE clave_acceso = ?',
      [claveAcceso]
    )
    id = row?.id
  }

  if (id) {
    const rows = await db.queryAll<{
      ruta_archivo: string | null
      xml_autorizado_path: string | null
      tipo: string | null
    }>(
      `SELECT ruta_archivo, xml_autorizado_path, tipo
       FROM comprobante_xmls
       WHERE comprobante_id = ?
       ORDER BY CASE WHEN tipo = 'autorizado' THEN 0 WHEN tipo = 'firmado' THEN 1 ELSE 2 END,
                created_at DESC`,
      [id]
    )

    for (const row of rows) {
      const fromRuta = resolveStoredField(row.ruta_archivo)
      if (fromRuta) return fromRuta
      const fromLegacy = resolveStoredField(row.xml_autorizado_path)
      if (fromLegacy) return fromLegacy
    }
  }

  const fromDisk = tryReadXmlFromDisk(claveAcceso)
  if (fromDisk) return fromDisk

  if (fetchFromSri) {
    return tryFetchXmlFromSri(claveAcceso, id)
  }

  return null
}
