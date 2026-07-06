import { db } from './db'

export interface GetAllOptions {
  tipo?: string
  nivel?: number
  activo?: boolean
}

export interface CreatePlanCuentaInput {
  codigo: string
  nombre: string
  nivel: number
  tipo: string
  esAuxiliar?: boolean
  permiteMovimiento?: boolean
  cuentaPadreId?: number | null
}

export interface UpdatePlanCuentaInput {
  codigo?: string
  nombre?: string
  nivel?: number
  tipo?: string
  esAuxiliar?: boolean
  permiteMovimiento?: boolean
  cuentaPadreId?: number | null
  activo?: boolean
}

export async function getAll(tenantId: string, options?: GetAllOptions) {
  const conditions: string[] = ['tenant_id = $1']
  const params: any[] = [tenantId]
  let idx = 2

  if (options?.tipo) {
    conditions.push(`tipo = $${idx++}`)
    params.push(options.tipo)
  }
  if (options?.nivel !== undefined) {
    conditions.push(`nivel = $${idx++}`)
    params.push(options.nivel)
  }
  if (options?.activo !== undefined) {
    conditions.push(`activo = $${idx++}`)
    params.push(options.activo)
  }

  return db.queryAll<any>(
    `SELECT * FROM plan_cuentas WHERE ${conditions.join(' AND ')} ORDER BY codigo ASC`,
    params
  )
}

export async function getById(id: number) {
  const cuenta = await db.queryOne<any>('SELECT * FROM plan_cuentas WHERE id = $1', [id])
  if (!cuenta) throw new Error(`Plan de cuenta con ID ${id} no encontrado`)
  return cuenta
}

export async function getByCodigo(tenantId: string, codigo: string) {
  const cuenta = await db.queryOne<any>(
    'SELECT * FROM plan_cuentas WHERE tenant_id = $1 AND codigo = $2',
    [tenantId, codigo]
  )
  if (!cuenta) throw new Error(`Plan de cuenta con código ${codigo} no encontrado`)
  return cuenta
}

export async function create(data: CreatePlanCuentaInput & { tenantId: string }) {
  const existing = await db.queryOne<any>(
    'SELECT id FROM plan_cuentas WHERE tenant_id = $1 AND codigo = $2',
    [data.tenantId, data.codigo]
  )
  if (existing) throw new Error(`Ya existe una cuenta con el código ${data.codigo}`)

  if (data.cuentaPadreId) {
    const padre = await db.queryOne<any>('SELECT * FROM plan_cuentas WHERE id = $1', [data.cuentaPadreId])
    if (!padre) throw new Error(`Cuenta padre ID ${data.cuentaPadreId} no encontrada`)
    if (data.nivel !== padre.nivel + 1) throw new Error(`El nivel debe ser ${padre.nivel + 1} para la cuenta padre seleccionada`)
  } else if (data.nivel !== 1) {
    throw new Error('Una cuenta sin padre debe tener nivel 1')
  }

  return db.insert('plan_cuentas', {
    tenant_id: data.tenantId,
    codigo: data.codigo,
    nombre: data.nombre,
    nivel: data.nivel,
    tipo: data.tipo,
    es_auxiliar: data.esAuxiliar ?? false,
    permite_movimiento: data.permiteMovimiento ?? true,
    cuenta_padre_id: data.cuentaPadreId ?? null,
  })
}

export async function update(id: number, data: UpdatePlanCuentaInput) {
  const cuenta = await db.queryOne<any>('SELECT * FROM plan_cuentas WHERE id = $1', [id])
  if (!cuenta) throw new Error(`Plan de cuenta con ID ${id} no encontrado`)

  if (data.cuentaPadreId) {
    const padre = await db.queryOne<any>('SELECT * FROM plan_cuentas WHERE id = $1', [data.cuentaPadreId])
    if (!padre) throw new Error(`Cuenta padre ID ${data.cuentaPadreId} no encontrada`)
    const nivel = data.nivel ?? cuenta.nivel
    if (nivel !== padre.nivel + 1) throw new Error(`El nivel debe ser ${padre.nivel + 1} para la cuenta padre seleccionada`)
  }

  if (data.codigo && data.codigo !== cuenta.codigo) {
    const dup = await db.queryOne<any>(
      'SELECT id FROM plan_cuentas WHERE tenant_id = $1 AND codigo = $2',
      [cuenta.tenant_id, data.codigo]
    )
    if (dup) throw new Error(`Ya existe una cuenta con el código ${data.codigo}`)
  }

  const updateData: Record<string, any> = {}
  if (data.codigo !== undefined) updateData.codigo = data.codigo
  if (data.nombre !== undefined) updateData.nombre = data.nombre
  if (data.nivel !== undefined) updateData.nivel = data.nivel
  if (data.tipo !== undefined) updateData.tipo = data.tipo
  if (data.esAuxiliar !== undefined) updateData.es_auxiliar = data.esAuxiliar
  if (data.permiteMovimiento !== undefined) updateData.permite_movimiento = data.permiteMovimiento
  if (data.cuentaPadreId !== undefined) updateData.cuenta_padre_id = data.cuentaPadreId
  if (data.activo !== undefined) updateData.activo = data.activo

  await db.update('plan_cuentas', updateData, 'id = $1', [id])
  return db.queryOne<any>('SELECT * FROM plan_cuentas WHERE id = $1', [id])
}

export async function remove(id: number) {
  const cuenta = await db.queryOne<any>('SELECT * FROM plan_cuentas WHERE id = $1', [id])
  if (!cuenta) throw new Error(`Plan de cuenta con ID ${id} no encontrado`)
  await db.update('plan_cuentas', { activo: false }, 'id = $1', [id])
  return db.queryOne<any>('SELECT * FROM plan_cuentas WHERE id = $1', [id])
}

export async function getArbol(tenantId: string) {
  const cuentas = await db.queryAll<any>(
    'SELECT * FROM plan_cuentas WHERE tenant_id = $1 AND activo = true ORDER BY codigo ASC',
    [tenantId]
  )

  const map = new Map<number, any>()
  const raices: any[] = []

  for (const c of cuentas) {
    map.set(c.id, { ...c, subcuentas: [] })
  }

  for (const c of cuentas) {
    const nodo = map.get(c.id)
    if (c.cuenta_padre_id && map.has(c.cuenta_padre_id)) {
      map.get(c.cuenta_padre_id).subcuentas.push(nodo)
    } else {
      raices.push(nodo)
    }
  }

  return raices
}

export async function getHijas(id: number) {
  const cuenta = await db.queryOne<any>('SELECT * FROM plan_cuentas WHERE id = $1', [id])
  if (!cuenta) throw new Error(`Plan de cuenta con ID ${id} no encontrado`)
  return db.queryAll<any>(
    'SELECT * FROM plan_cuentas WHERE cuenta_padre_id = $1 AND activo = true ORDER BY codigo ASC',
    [id]
  )
}
