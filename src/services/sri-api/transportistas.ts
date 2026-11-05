import { db } from './db'

export interface TransportistaCreateInput {
  tenantId: string
  ruc: string
  razonSocial: string
  tipoIdentificacion?: string
  placa: string
  direccion?: string
  telefono?: string
  email?: string
}

export interface TransportistaUpdateInput {
  razonSocial?: string
  placa?: string
  direccion?: string
  telefono?: string
  email?: string
  activo?: boolean
}

export async function getByTenant(tenantId: string, activo?: boolean) {
  const conditions: string[] = ['tenant_id = $1']
  const params: any[] = [tenantId]

  if (activo !== undefined) {
    conditions.push('activo = $2')
    params.push(activo)
  }

  return db.queryAll<any>(
    `SELECT * FROM transportistas WHERE ${conditions.join(' AND ')} ORDER BY razon_social ASC`,
    params
  )
}

export async function getById(id: string) {
  const transportista = await db.queryOne<any>('SELECT * FROM transportistas WHERE id = $1', [id])
  if (!transportista) {
    throw new Error(`Transportista con ID ${id} no encontrado.`)
  }
  return transportista
}

export async function create(data: TransportistaCreateInput) {
  if (!/^\d{13}$/.test(data.ruc) || data.ruc.substring(10, 13) !== '001') {
    throw new Error('El RUC del transportista debe tener 13 dígitos y terminar en 001.')
  }

  if (!data.placa || data.placa.trim().length < 6) {
    throw new Error('La placa del vehículo es requerida (mínimo 6 caracteres).')
  }

  const existente = await db.queryOne<any>(
    'SELECT id FROM transportistas WHERE tenant_id = $1 AND ruc = $2 AND placa = $3',
    [data.tenantId, data.ruc, data.placa]
  )

  if (existente) {
    throw new Error(`Ya existe un transportista con RUC ${data.ruc} y placa ${data.placa}.`)
  }

  return db.insert('transportistas', {
    tenant_id: data.tenantId,
    ruc: data.ruc,
    razon_social: data.razonSocial,
    tipo_identificacion: data.tipoIdentificacion || '04',
    placa: data.placa.toUpperCase(),
    direccion: data.direccion ?? null,
    telefono: data.telefono ?? null,
    email: data.email ?? null,
  })
}

export async function update(id: string, data: TransportistaUpdateInput) {
  const transportista = await db.queryOne<any>('SELECT * FROM transportistas WHERE id = $1', [id])
  if (!transportista) {
    throw new Error(`Transportista con ID ${id} no encontrado.`)
  }

  const updateData: Record<string, any> = {}
  if (data.razonSocial !== undefined) updateData.razon_social = data.razonSocial
  if (data.placa !== undefined) updateData.placa = data.placa.toUpperCase()
  if (data.direccion !== undefined) updateData.direccion = data.direccion
  if (data.telefono !== undefined) updateData.telefono = data.telefono
  if (data.email !== undefined) updateData.email = data.email
  if (data.activo !== undefined) updateData.activo = data.activo

  await db.update('transportistas', updateData, 'id = $1', [id])
  return db.queryOne<any>('SELECT * FROM transportistas WHERE id = $1', [id])
}

export async function remove(id: string) {
  const transportista = await db.queryOne<any>('SELECT * FROM transportistas WHERE id = $1', [id])
  if (!transportista) {
    throw new Error(`Transportista con ID ${id} no encontrado.`)
  }
  await db.update('transportistas', { activo: false }, 'id = $1', [id])
  return db.queryOne<any>('SELECT * FROM transportistas WHERE id = $1', [id])
}

export async function hardDelete(id: string) {
  const transportista = await db.queryOne<any>('SELECT * FROM transportistas WHERE id = $1', [id])
  if (!transportista) {
    throw new Error(`Transportista con ID ${id} no encontrado.`)
  }
  await db.query('DELETE FROM transportistas WHERE id = $1', [id])
  return transportista
}
