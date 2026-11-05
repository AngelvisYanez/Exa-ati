import { randomUUID } from 'crypto'
import { z } from 'zod'
import { db } from './db'

export const RIDE_PLANTILLAS = ['clasico', 'compacto', 'banda'] as const
export type RidePlantilla = (typeof RIDE_PLANTILLAS)[number]

export interface RideDiseno {
  codigo: string
  nombre: string
  descripcion: string | null
  plantilla: RidePlantilla
  mostrarLogo: boolean
  mostrarQr: boolean
  mostrarAdicional: boolean
  mostrarPagos: boolean
  colorModo: 'ruc' | 'fijo'
  colorHex: string | null
  esPredeterminado: boolean
  esSistema: boolean
}

export const DISENO_CLASICO: RideDiseno = {
  codigo: 'clasico',
  nombre: 'Clásico SRI',
  descripcion: 'Caja de autorización a la derecha, logo del emisor y código QR.',
  plantilla: 'clasico',
  mostrarLogo: true,
  mostrarQr: true,
  mostrarAdicional: true,
  mostrarPagos: true,
  colorModo: 'ruc',
  colorHex: null,
  esPredeterminado: true,
  esSistema: true,
}

export const rideDisenoSchema = z.object({
  codigo: z
    .string()
    .trim()
    .min(3)
    .max(40)
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, 'El código solo admite minúsculas, números y guiones'),
  nombre: z.string().trim().min(2).max(120),
  descripcion: z.string().trim().max(500).nullable().optional(),
  plantilla: z.enum(RIDE_PLANTILLAS),
  mostrarLogo: z.boolean(),
  mostrarQr: z.boolean(),
  mostrarAdicional: z.boolean(),
  mostrarPagos: z.boolean(),
  colorModo: z.enum(['ruc', 'fijo']),
  colorHex: z
    .string()
    .trim()
    .regex(/^#[0-9A-Fa-f]{6}$/, 'El color debe ser hexadecimal, por ejemplo #1f4b3a')
    .nullable()
    .optional(),
})

export type RideDisenoInput = z.infer<typeof rideDisenoSchema>

interface RideDisenoRow {
  codigo: string
  nombre: string
  descripcion: string | null
  plantilla: string
  mostrar_logo: boolean | number
  mostrar_qr: boolean | number
  mostrar_adicional: boolean | number
  mostrar_pagos: boolean | number
  color_modo: string
  color_hex: string | null
  es_predeterminado: boolean | number
  es_sistema: boolean | number
}

function flag(value: boolean | number): boolean {
  return value === true || value === 1
}

function mapRow(row: RideDisenoRow): RideDiseno {
  const plantilla = RIDE_PLANTILLAS.includes(row.plantilla as RidePlantilla)
    ? (row.plantilla as RidePlantilla)
    : 'clasico'
  return {
    codigo: row.codigo,
    nombre: row.nombre,
    descripcion: row.descripcion,
    plantilla,
    mostrarLogo: flag(row.mostrar_logo),
    mostrarQr: flag(row.mostrar_qr),
    mostrarAdicional: flag(row.mostrar_adicional),
    mostrarPagos: flag(row.mostrar_pagos),
    colorModo: row.color_modo === 'fijo' ? 'fijo' : 'ruc',
    colorHex: row.color_hex,
    esPredeterminado: flag(row.es_predeterminado),
    esSistema: flag(row.es_sistema),
  }
}

const SELECT = `SELECT codigo, nombre, descripcion, plantilla, mostrar_logo, mostrar_qr,
  mostrar_adicional, mostrar_pagos, color_modo, color_hex, es_predeterminado, es_sistema
  FROM ride_disenos`

export async function listRideDisenos(): Promise<RideDiseno[]> {
  const result = await db.query<RideDisenoRow>(
    `${SELECT} ORDER BY es_predeterminado DESC, es_sistema DESC, nombre`
  )
  return result.rows.map(mapRow)
}

export async function getRideDiseno(codigo: string): Promise<RideDiseno | null> {
  const row = await db.queryOne<RideDisenoRow>(`${SELECT} WHERE codigo = $1`, [codigo])
  return row ? mapRow(row) : null
}

export async function getActiveRideDiseno(): Promise<RideDiseno> {
  try {
    const row = await db.queryOne<RideDisenoRow>(
      `${SELECT} WHERE es_predeterminado = true ORDER BY updated_at DESC LIMIT 1`
    )
    return row ? mapRow(row) : DISENO_CLASICO
  } catch {
    return DISENO_CLASICO
  }
}

function assertColor(input: RideDisenoInput) {
  if (input.colorModo === 'fijo' && !input.colorHex) {
    throw new Error('Elige un color hexadecimal para la plantilla')
  }
}

export async function createRideDiseno(input: RideDisenoInput): Promise<RideDiseno> {
  assertColor(input)
  const existing = await getRideDiseno(input.codigo)
  if (existing) throw new Error('Ya existe un diseño con ese código')
  await db.query(
    `INSERT INTO ride_disenos (
      codigo, nombre, descripcion, plantilla, mostrar_logo, mostrar_qr, mostrar_adicional, mostrar_pagos,
      color_modo, color_hex, es_predeterminado, es_sistema, created_at, updated_at
    ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,false,false,NOW(),NOW())`,
    [
      input.codigo,
      input.nombre,
      input.descripcion || null,
      input.plantilla,
      input.mostrarLogo,
      input.mostrarQr,
      input.mostrarAdicional,
      input.mostrarPagos,
      input.colorModo,
      input.colorModo === 'fijo' ? input.colorHex : null,
    ]
  )
  const created = await getRideDiseno(input.codigo)
  if (!created) throw new Error('No se pudo crear el diseño')
  return created
}

export async function updateRideDiseno(codigo: string, input: RideDisenoInput): Promise<RideDiseno> {
  assertColor(input)
  const current = await getRideDiseno(codigo)
  if (!current) throw new Error('Diseño no encontrado')
  if (current.esSistema && input.plantilla !== current.plantilla) {
    throw new Error('La plantilla base de un diseño del sistema no se cambia. Duplica el diseño para usar otra.')
  }
  await db.query(
    `UPDATE ride_disenos SET
      nombre = $1,
      descripcion = $2,
      plantilla = $3,
      mostrar_logo = $4,
      mostrar_qr = $5,
      mostrar_adicional = $6,
      mostrar_pagos = $7,
      color_modo = $8,
      color_hex = $9,
      updated_at = NOW()
    WHERE codigo = $10`,
    [
      input.nombre,
      input.descripcion || null,
      current.esSistema ? current.plantilla : input.plantilla,
      input.mostrarLogo,
      input.mostrarQr,
      input.mostrarAdicional,
      input.mostrarPagos,
      input.colorModo,
      input.colorModo === 'fijo' ? input.colorHex : null,
      codigo,
    ]
  )
  const updated = await getRideDiseno(codigo)
  if (!updated) throw new Error('Diseño no encontrado')
  return updated
}

export async function deleteRideDiseno(codigo: string): Promise<void> {
  const current = await getRideDiseno(codigo)
  if (!current) throw new Error('Diseño no encontrado')
  if (current.esSistema) throw new Error('Los diseños del sistema no se eliminan')
  await db.query(`DELETE FROM ride_disenos WHERE codigo = $1`, [codigo])
  if (current.esPredeterminado) {
    await db.query(
      `UPDATE ride_disenos SET es_predeterminado = true, updated_at = NOW() WHERE codigo = 'clasico'`
    )
  }
}

export async function activarRideDiseno(codigo: string): Promise<RideDiseno> {
  const current = await getRideDiseno(codigo)
  if (!current) throw new Error('Diseño no encontrado')
  await db.query(`UPDATE ride_disenos SET es_predeterminado = false, updated_at = NOW()`)
  await db.query(
    `UPDATE ride_disenos SET es_predeterminado = true, updated_at = NOW() WHERE codigo = $1`,
    [codigo]
  )
  const active = await getRideDiseno(codigo)
  if (!active) throw new Error('Diseño no encontrado')
  return active
}

export function nuevoCodigoDiseno(): string {
  return `diseno-${randomUUID().slice(0, 8)}`
}
