import { db } from './db'

export async function getAll() {
  return db.queryAll<any>(
    'SELECT * FROM tipos_sustento_tributario WHERE activo = true ORDER BY codigo ASC'
  )
}

export async function getByCodigo(codigo: string) {
  const tipo = await db.queryOne<any>(
    'SELECT * FROM tipos_sustento_tributario WHERE codigo = $1',
    [codigo]
  )
  if (!tipo) throw new Error(`Tipo de sustento tributario con código ${codigo} no encontrado`)
  return tipo
}
