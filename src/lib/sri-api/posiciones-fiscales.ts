import { db } from './db'

export interface CreatePosicionFiscalInput {
  nombre: string
  tipoContribuyente?: string | null
}

export interface UpdatePosicionFiscalInput {
  nombre?: string
  tipoContribuyente?: string | null
  activo?: boolean
}

export interface LineaData {
  impuestoId: number
  tipoOperacion: 'COMPRA' | 'VENTA'
  aplicaRetencion?: boolean
}

export async function getAll(tenantId: string) {
  return db.queryAll<any>(
    'SELECT * FROM posiciones_fiscales WHERE tenant_id = $1 AND activo = true ORDER BY nombre ASC',
    [tenantId]
  )
}

export async function getById(id: number) {
  const posicion = await db.queryOne<any>('SELECT * FROM posiciones_fiscales WHERE id = $1', [id])
  if (!posicion) throw new Error(`Posición fiscal con ID ${id} no encontrada`)
  return posicion
}

export async function getWithLines(id: number) {
  const posicion = await db.queryOne<any>('SELECT * FROM posiciones_fiscales WHERE id = $1', [id])
  if (!posicion) throw new Error(`Posición fiscal con ID ${id} no encontrada`)

  const lineas = await db.queryAll<any>(
    `SELECT pfl.*, i.* FROM posiciones_fiscales_lineas pfl
     INNER JOIN impuestos i ON i.id = pfl.impuesto_id
     WHERE pfl.posicion_fiscal_id = $1
     ORDER BY pfl.id ASC`,
    [id]
  )

  return { ...posicion, lineas }
}

export async function create(data: CreatePosicionFiscalInput & { tenantId: string }) {
  return db.insert('posiciones_fiscales', {
    tenant_id: data.tenantId,
    nombre: data.nombre,
    tipo_contribuyente: data.tipoContribuyente ?? null,
  })
}

export async function update(id: number, data: UpdatePosicionFiscalInput) {
  const posicion = await db.queryOne<any>('SELECT * FROM posiciones_fiscales WHERE id = $1', [id])
  if (!posicion) throw new Error(`Posición fiscal con ID ${id} no encontrada`)

  const updateData: Record<string, any> = {}
  if (data.nombre !== undefined) updateData.nombre = data.nombre
  if (data.tipoContribuyente !== undefined) updateData.tipo_contribuyente = data.tipoContribuyente
  if (data.activo !== undefined) updateData.activo = data.activo

  await db.update('posiciones_fiscales', updateData, 'id = $1', [id])
  return db.queryOne<any>('SELECT * FROM posiciones_fiscales WHERE id = $1', [id])
}

export async function remove(id: number) {
  const posicion = await db.queryOne<any>('SELECT * FROM posiciones_fiscales WHERE id = $1', [id])
  if (!posicion) throw new Error(`Posición fiscal con ID ${id} no encontrada`)
  await db.update('posiciones_fiscales', { activo: false }, 'id = $1', [id])
  return db.queryOne<any>('SELECT * FROM posiciones_fiscales WHERE id = $1', [id])
}

export async function findByTipoContribuyente(tenantId: string, tipo: string) {
  const posiciones = await db.queryAll<any>(
    'SELECT * FROM posiciones_fiscales WHERE tenant_id = $1 AND tipo_contribuyente = $2 AND activo = true ORDER BY nombre ASC',
    [tenantId, tipo]
  )

  for (const p of posiciones) {
    const lineas = await db.queryAll<any>(
      `SELECT pfl.*, i.* FROM posiciones_fiscales_lineas pfl
       INNER JOIN impuestos i ON i.id = pfl.impuesto_id
       WHERE pfl.posicion_fiscal_id = $1
       ORDER BY pfl.id ASC`,
      [p.id]
    )
    p.lineas = lineas
  }

  return posiciones
}

export async function addLinea(posicionFiscalId: number, data: LineaData) {
  const posicion = await db.queryOne<any>('SELECT * FROM posiciones_fiscales WHERE id = $1', [posicionFiscalId])
  if (!posicion) throw new Error(`Posición fiscal con ID ${posicionFiscalId} no encontrada`)

  const impuesto = await db.queryOne<any>('SELECT * FROM impuestos WHERE id = $1', [data.impuestoId])
  if (!impuesto) throw new Error(`Impuesto con ID ${data.impuestoId} no encontrado`)

  return db.insert('posiciones_fiscales_lineas', {
    posicion_fiscal_id: posicionFiscalId,
    impuesto_id: data.impuestoId,
    tipo_operacion: data.tipoOperacion,
    aplica_retencion: data.aplicaRetencion ?? false,
  })
}

export async function removeLinea(id: number) {
  const linea = await db.queryOne<any>('SELECT * FROM posiciones_fiscales_lineas WHERE id = $1', [id])
  if (!linea) throw new Error(`Línea de posición fiscal con ID ${id} no encontrada`)
  await db.query('DELETE FROM posiciones_fiscales_lineas WHERE id = $1', [id])
  return linea
}
