import { db } from './db'
import { validarIdentificacion } from './identificacion-ec'

export { validarIdentificacion }

export interface ContactoCreateInput {
  tenantId: string
  tipoIdentificacion: string
  identificacion: string
  razonSocial: string
  nombreComercial?: string
  email?: string
  telefono?: string
  direccion?: string
  tipoContribuyenteSri?: string
  obligadoContabilidad?: string
  agenteRetencion?: boolean
  esCliente?: boolean
  esProveedor?: boolean
}

export interface ContactoUpdateInput {
  razonSocial?: string
  nombreComercial?: string
  email?: string
  telefono?: string
  direccion?: string
  tipoContribuyenteSri?: string
  obligadoContabilidad?: string
  agenteRetencion?: boolean
  esCliente?: boolean
  esProveedor?: boolean
}

export interface ContactoListOptions {
  tipo?: string
  activo?: boolean
  search?: string
  esCliente?: boolean
  esProveedor?: boolean
}

export async function getAll(tenantId: string, options: ContactoListOptions = {}) {
  const conditions: string[] = ['tenant_id = $1']
  const params: any[] = [tenantId]
  let idx = 2

  if (options.activo !== undefined) {
    conditions.push(`activo = $${idx++}`)
    params.push(options.activo)
  }
  if (options.tipo) {
    conditions.push(`tipo_identificacion = $${idx++}`)
    params.push(options.tipo)
  }
  if (options.esCliente !== undefined) {
    conditions.push(`es_cliente = $${idx++}`)
    params.push(options.esCliente)
  }
  if (options.esProveedor !== undefined) {
    conditions.push(`es_proveedor = $${idx++}`)
    params.push(options.esProveedor)
  }

  if (options.search) {
    const searchTerm = `%${options.search}%`
    conditions.push(`(LOWER(razon_social) LIKE LOWER($${idx}) OR identificacion LIKE $${idx + 1} OR LOWER(nombre_comercial) LIKE LOWER($${idx + 2}))`)
    params.push(searchTerm, searchTerm, searchTerm)
    idx += 3
  }

  return db.queryAll<any>(
    `SELECT * FROM contactos WHERE ${conditions.join(' AND ')} ORDER BY razon_social ASC`,
    params
  )
}

export async function getById(id: string) {
  const contacto = await db.queryOne<any>('SELECT * FROM contactos WHERE id = $1', [id])
  if (!contacto) {
    throw new Error(`Contacto con ID ${id} no encontrado.`)
  }
  return contacto
}

export async function getByIdentificacion(tenantId: string, tipoIdentificacion: string, identificacion: string) {
  return db.queryOne<any>(
    'SELECT * FROM contactos WHERE tenant_id = $1 AND tipo_identificacion = $2 AND identificacion = $3',
    [tenantId, tipoIdentificacion, identificacion]
  )
}

export async function create(data: ContactoCreateInput) {
  const validacion = validarIdentificacion(data.tipoIdentificacion, data.identificacion)
  if (!validacion.valido) {
    throw new Error(validacion.mensaje)
  }

  const existente = await getByIdentificacion(data.tenantId, data.tipoIdentificacion, data.identificacion)
  if (existente) {
    throw new Error(`Ya existe un contacto con ${data.tipoIdentificacion === '05' ? 'cédula' : 'RUC'} ${data.identificacion}.`)
  }

  return db.insert('contactos', {
    tenant_id: data.tenantId,
    tipo_identificacion: data.tipoIdentificacion,
    identificacion: data.identificacion,
    razon_social: data.razonSocial,
    nombre_comercial: data.nombreComercial ?? null,
    email: data.email ?? null,
    telefono: data.telefono ?? null,
    direccion: data.direccion ?? null,
    tipo_contribuyente_sri: data.tipoContribuyenteSri ?? null,
    obligado_contabilidad: data.obligadoContabilidad ?? null,
    agente_retencion: data.agenteRetencion ?? false,
    es_cliente: data.esCliente ?? true,
    es_proveedor: data.esProveedor ?? false,
  })
}

export async function update(id: string, data: ContactoUpdateInput) {
  const contacto = await db.queryOne<any>('SELECT * FROM contactos WHERE id = $1', [id])
  if (!contacto) {
    throw new Error(`Contacto con ID ${id} no encontrado.`)
  }

  const updateData: Record<string, any> = {}
  if (data.razonSocial !== undefined) updateData.razon_social = data.razonSocial
  if (data.nombreComercial !== undefined) updateData.nombre_comercial = data.nombreComercial
  if (data.email !== undefined) updateData.email = data.email
  if (data.telefono !== undefined) updateData.telefono = data.telefono
  if (data.direccion !== undefined) updateData.direccion = data.direccion
  if (data.tipoContribuyenteSri !== undefined) updateData.tipo_contribuyente_sri = data.tipoContribuyenteSri
  if (data.obligadoContabilidad !== undefined) updateData.obligado_contabilidad = data.obligadoContabilidad
  if (data.agenteRetencion !== undefined) updateData.agente_retencion = data.agenteRetencion
  if (data.esCliente !== undefined) updateData.es_cliente = data.esCliente
  if (data.esProveedor !== undefined) updateData.es_proveedor = data.esProveedor

  await db.update('contactos', updateData, 'id = $1', [id])
  return db.queryOne<any>('SELECT * FROM contactos WHERE id = $1', [id])
}

export async function remove(id: string) {
  const contacto = await db.queryOne<any>('SELECT * FROM contactos WHERE id = $1', [id])
  if (!contacto) {
    throw new Error(`Contacto con ID ${id} no encontrado.`)
  }
  await db.update('contactos', { activo: false }, 'id = $1', [id])
  return db.queryOne<any>('SELECT * FROM contactos WHERE id = $1', [id])
}

export async function buscarEnSri(identificacion: string): Promise<{
  razonSocial: string
  tipoContribuyente?: string
  obligadoContabilidad?: string
  error?: string
}> {
  const validacion = validarIdentificacion(
    identificacion.length === 13 ? '04' : identificacion.length === 10 ? '05' : '06',
    identificacion
  )
  if (!validacion.valido) {
    return {
      razonSocial: identificacion,
      error: `Identificación inválida: ${validacion.mensaje}`,
    }
  }
  try {
    const response = await fetch(
      `https://srienlinea.sri.gob.ec/movil-servicios/api/v1.0/deudas/porIdentificacion/${identificacion}`,
      { signal: AbortSignal.timeout(5000) }
    )
    if (response.ok) {
      const data = await response.json()
      return {
        razonSocial: data.razonSocial || identificacion,
        tipoContribuyente: data.tipoContribuyente,
        obligadoContabilidad: data.obligadoContabilidad,
      }
    }
  } catch {
  }
  return {
    razonSocial: identificacion,
    error: 'No se pudo consultar el SRI. Verifica la conexión o intenta manualmente.',
  }
}
