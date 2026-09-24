import { db } from './db'

export interface GetAllOptions {
  tipoImpuesto?: string
  activo?: boolean
}

export interface CreateImpuestoInput {
  codigo: string
  codigoPorcentaje: string
  nombre: string
  porcentaje: number
  tarifa: number
  tipoImpuesto: string
  codigoAts?: string | null
  codigoFormulario103?: string | null
  codigoFormulario104?: string | null
}

export interface UpdateImpuestoInput {
  codigo?: string
  codigoPorcentaje?: string
  nombre?: string
  porcentaje?: number
  tarifa?: number
  tipoImpuesto?: string
  codigoAts?: string | null
  codigoFormulario103?: string | null
  codigoFormulario104?: string | null
  activo?: boolean
}

export async function getAll(tenantId: string, options?: GetAllOptions) {
  const conditions: string[] = ['tenant_id = $1']
  const params: any[] = [tenantId]
  let idx = 2

  if (options?.tipoImpuesto) {
    conditions.push(`tipo_impuesto = $${idx++}`)
    params.push(options.tipoImpuesto)
  }
  if (options?.activo !== undefined) {
    conditions.push(`activo = $${idx++}`)
    params.push(options.activo)
  }

  return db.queryAll<any>(
    `SELECT * FROM impuestos WHERE ${conditions.join(' AND ')} ORDER BY tipo_impuesto ASC, codigo ASC`,
    params
  )
}

export async function getById(id: number) {
  const impuesto = await db.queryOne<any>('SELECT * FROM impuestos WHERE id = $1', [id])
  if (!impuesto) throw new Error(`Impuesto con ID ${id} no encontrado`)
  return impuesto
}

export async function getByCodigo(tenantId: string, codigo: string, codigoPorcentaje: string) {
  const impuesto = await db.queryOne<any>(
    'SELECT * FROM impuestos WHERE tenant_id = $1 AND codigo = $2 AND codigo_porcentaje = $3',
    [tenantId, codigo, codigoPorcentaje]
  )
  if (!impuesto) throw new Error(`Impuesto ${codigo}-${codigoPorcentaje} no encontrado`)
  return impuesto
}

export async function create(data: CreateImpuestoInput & { tenantId: string }) {
  const existing = await db.queryOne<any>(
    'SELECT id FROM impuestos WHERE tenant_id = $1 AND codigo = $2 AND codigo_porcentaje = $3',
    [data.tenantId, data.codigo, data.codigoPorcentaje]
  )
  if (existing) throw new Error(`Ya existe un impuesto con código ${data.codigo}-${data.codigoPorcentaje}`)

  return db.insert('impuestos', {
    tenant_id: data.tenantId,
    codigo: data.codigo,
    codigo_porcentaje: data.codigoPorcentaje,
    nombre: data.nombre,
    porcentaje: data.porcentaje,
    tarifa: data.tarifa,
    tipo_impuesto: data.tipoImpuesto,
    codigo_ats: data.codigoAts ?? null,
    codigo_formulario_103: data.codigoFormulario103 ?? null,
    codigo_formulario_104: data.codigoFormulario104 ?? null,
  })
}

export async function update(id: number, data: UpdateImpuestoInput) {
  const impuesto = await db.queryOne<any>('SELECT * FROM impuestos WHERE id = $1', [id])
  if (!impuesto) throw new Error(`Impuesto con ID ${id} no encontrado`)

  if (data.codigo || data.codigoPorcentaje) {
    const codigo = data.codigo ?? impuesto.codigo
    const codigoPorcentaje = data.codigoPorcentaje ?? impuesto.codigo_porcentaje
    if (codigo !== impuesto.codigo || codigoPorcentaje !== impuesto.codigo_porcentaje) {
      const dup = await db.queryOne<any>(
        'SELECT id FROM impuestos WHERE tenant_id = $1 AND codigo = $2 AND codigo_porcentaje = $3',
        [impuesto.tenant_id, codigo, codigoPorcentaje]
      )
      if (dup) throw new Error(`Ya existe un impuesto con código ${codigo}-${codigoPorcentaje}`)
    }
  }

  const updateData: Record<string, any> = {}
  if (data.codigo !== undefined) updateData.codigo = data.codigo
  if (data.codigoPorcentaje !== undefined) updateData.codigo_porcentaje = data.codigoPorcentaje
  if (data.nombre !== undefined) updateData.nombre = data.nombre
  if (data.porcentaje !== undefined) updateData.porcentaje = data.porcentaje
  if (data.tarifa !== undefined) updateData.tarifa = data.tarifa
  if (data.tipoImpuesto !== undefined) updateData.tipo_impuesto = data.tipoImpuesto
  if (data.codigoAts !== undefined) updateData.codigo_ats = data.codigoAts
  if (data.codigoFormulario103 !== undefined) updateData.codigo_formulario_103 = data.codigoFormulario103
  if (data.codigoFormulario104 !== undefined) updateData.codigo_formulario_104 = data.codigoFormulario104
  if (data.activo !== undefined) updateData.activo = data.activo

  await db.update('impuestos', updateData, 'id = $1', [id])
  return db.queryOne<any>('SELECT * FROM impuestos WHERE id = $1', [id])
}

export async function remove(id: number) {
  const impuesto = await db.queryOne<any>('SELECT * FROM impuestos WHERE id = $1', [id])
  if (!impuesto) throw new Error(`Impuesto con ID ${id} no encontrado`)
  await db.update('impuestos', { activo: false }, 'id = $1', [id])
  return db.queryOne<any>('SELECT * FROM impuestos WHERE id = $1', [id])
}

export async function getByTipo(tenantId: string, tipoImpuesto: string) {
  return db.queryAll<any>(
    'SELECT * FROM impuestos WHERE tenant_id = $1 AND tipo_impuesto = $2 AND activo = true ORDER BY codigo ASC',
    [tenantId, tipoImpuesto]
  )
}

export async function getRetencionesIVA(tenantId: string) {
  return db.queryAll<any>(
    'SELECT * FROM impuestos WHERE tenant_id = $1 AND tipo_impuesto = $2 AND activo = true ORDER BY porcentaje ASC',
    [tenantId, 'IVA_RET']
  )
}

export async function getRetencionesRenta(tenantId: string) {
  return db.queryAll<any>(
    'SELECT * FROM impuestos WHERE tenant_id = $1 AND tipo_impuesto = $2 AND activo = true ORDER BY porcentaje ASC',
    [tenantId, 'RENTA']
  )
}
