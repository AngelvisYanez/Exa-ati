import { db } from './db'

export async function getAll() {
  return db.queryAll<any>(
    'SELECT * FROM tipos_documento_sri WHERE activo = true ORDER BY codigo ASC'
  )
}

export async function getByCodigo(codigo: string) {
  const tipo = await db.queryOne<any>(
    'SELECT * FROM tipos_documento_sri WHERE codigo = $1',
    [codigo]
  )
  if (!tipo) throw new Error(`Tipo de documento SRI con código ${codigo} no encontrado`)
  return tipo
}
