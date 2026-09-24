export interface Form103Data {
  periodo: number
  ruc: string
  retIr303?: number
  retIr303A?: number
  retIr304?: number
  retIr307?: number
  retIr310?: number
  retIr312?: number
  retIr322?: number
  retIr332?: number
  retIr343?: number
  retIr344?: number
  retIr346?: number
}

export function parseForm103CSV(contenido: string): Form103Data {
  const lineas = contenido.trim().split('\n')
  const headers = lineas[0].split(',')
  const valores = lineas[1].split(',')
  const casillas: Record<string, number> = {}

  headers.forEach((h, i) => {
    casillas[h.trim()] = parseFloat(valores[i]?.trim() ?? '0')
  })

  return {
    periodo: casillas['periodo'] || 0,
    ruc: '',
    retIr303: casillas['303'] || casillas['ret_ir_303'],
    retIr303A: casillas['303a'] || casillas['ret_ir_303a'],
    retIr304: casillas['304'] || casillas['ret_ir_304'],
    retIr307: casillas['307'] || casillas['ret_ir_307'],
    retIr310: casillas['310'] || casillas['ret_ir_310'],
    retIr312: casillas['312'] || casillas['ret_ir_312'],
    retIr322: casillas['322'] || casillas['ret_ir_322'],
    retIr332: casillas['332'] || casillas['ret_ir_332'],
    retIr343: casillas['343'] || casillas['ret_ir_343'],
    retIr344: casillas['344'] || casillas['ret_ir_344'],
    retIr346: casillas['346'] || casillas['ret_ir_346'],
  }
}
