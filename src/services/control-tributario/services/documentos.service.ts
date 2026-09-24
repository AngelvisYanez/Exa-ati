import { db } from '@/services/sri-api/db'
import type { TipoDocumentoFiscal } from '../types'

export async function crearDocumento(
  tenantId: string,
  data: {
    periodo: number
    nombre: string
    tipo: TipoDocumentoFiscal
    modulo?: string
    categoria?: string
    archivoPath?: string
    mimeType?: string
    tamanoBytes?: number
    metadata?: Record<string, unknown>
  },
) {
  return db.insert('documentos_fiscales', {
    tenant_id: tenantId,
    periodo: data.periodo,
    nombre: data.nombre,
    tipo: data.tipo,
    modulo: data.modulo ?? 'GENERAL',
    categoria: data.categoria ?? null,
    archivo_path: data.archivoPath ?? null,
    mime_type: data.mimeType ?? null,
    tamano_bytes: data.tamanoBytes ?? null,
    metadata: data.metadata ? JSON.stringify(data.metadata) : null,
    created_at: new Date(),
    updated_at: new Date(),
  })
}

export async function listDocumentos(
  tenantId: string,
  options?: { periodo?: number; tipo?: TipoDocumentoFiscal; modulo?: string },
) {
  const conditions = ['tenant_id = $1']
  const params: any[] = [tenantId]
  let idx = 2

  if (options?.periodo) {
    conditions.push(`periodo = $${idx++}`)
    params.push(options.periodo)
  }
  if (options?.tipo) {
    conditions.push(`tipo = $${idx++}`)
    params.push(options.tipo)
  }
  if (options?.modulo) {
    conditions.push(`modulo = $${idx++}`)
    params.push(options.modulo)
  }

  return db.queryAll(
    `SELECT * FROM documentos_fiscales WHERE ${conditions.join(' AND ')} ORDER BY created_at DESC`,
    params,
  )
}

export async function getDocumento(id: string, tenantId: string) {
  return db.queryOne(
    'SELECT * FROM documentos_fiscales WHERE id = $1 AND tenant_id = $2',
    [id, tenantId],
  )
}

export async function eliminarDocumento(id: string, tenantId: string) {
  return db.query(
    'DELETE FROM documentos_fiscales WHERE id = $1 AND tenant_id = $2',
    [id, tenantId],
  )
}
