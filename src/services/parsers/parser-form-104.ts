export interface Form104Data {
  periodo: number
  ruc: string
  ventasIva?: number
  ventas0?: number
  ncVentas15?: number
  ncVentas0?: number
  compras15?: number
  compras0?: number
  compras5?: number
  compras8?: number
  activosFijos?: number
  importaciones?: number
  ncCompras15?: number
  ncComprasSinIva?: number
  retIva20?: number
  retIva30?: number
  retIva70?: number
  retIva100?: number
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

interface Casilla {
  codigo: string
  valor: number
}

export function parseForm104CSV(contenido: string): Form104Data {
  const lineas = contenido.trim().split('\n')
  const headers = lineas[0].split(',')
  const valores = lineas[1].split(',')
  const casillas: Record<string, number> = {}

  headers.forEach((h, i) => {
    casillas[h.trim()] = parseFloat(valores[i]?.trim() ?? '0')
  })

  return {
    periodo: extraerPeriodoConCasilla4(casillas),
    ruc: '',
    ventasIva: casillas['401'] || casillas['ventas_iva'],
    ventas0: casillas['403'] || casillas['ventas_0'],
    ncVentas15: casillas['404'] || casillas['nc_ventas_15'],
    ncVentas0: casillas['405'] || casillas['nc_ventas_0'],
    compras15: casillas['501'] || casillas['compras_15'],
    compras0: casillas['503'] || casillas['compras_0'],
    compras5: casillas['504'] || casillas['compras_5'],
    compras8: casillas['505'] || casillas['compras_8'],
    activosFijos: casillas['506'] || casillas['activos_fijos'],
    importaciones: casillas['507'] || casillas['importaciones'],
    ncCompras15: casillas['509'] || casillas['nc_compras_15'],
    ncComprasSinIva: casillas['510'] || casillas['nc_compras_sin_iva'],
    retIva20: casillas['601'] || casillas['ret_iva_20'],
    retIva30: casillas['602'] || casillas['ret_iva_30'],
    retIva70: casillas['603'] || casillas['ret_iva_70'],
    retIva100: casillas['604'] || casillas['ret_iva_100'],
  }
}

function extraerPeriodoConCasilla4(casillas: Record<string, number>): number {
  if (casillas['periodo']) return casillas['periodo']
  const mes = Math.round(casillas['4'] ?? 0)
  const anio = Math.round(casillas['5'] ?? 0)
  if (mes && anio) return anio * 100 + mes
  return 0
}

export function parseForm104XML(xmlContent: string): Form104Data {
  const getTag = (tag: string): number => {
    const match = xmlContent.match(new RegExp(`<${tag}>\\s*([\\d.,-]+)\\s*</${tag}>`, 'i'))
    if (!match) return 0
    return parseFloat(match[1].replace(/\./g, '').replace(',', '.'))
  }

  const getTagStr = (tag: string): string => {
    const match = xmlContent.match(new RegExp(`<${tag}>\\s*(.*?)\\s*</${tag}>`, 'i'))
    return match ? match[1] : ''
  }

  const periodoStr = getTagStr('periodo') || getTagStr('per_fiscal')
  const periodo = periodoStr ? parseInt(periodoStr.replace(/[^0-9]/g, ''), 10) : 0

  return {
    periodo,
    ruc: getTagStr('ruc') || getTagStr('identificacion'),
    ventasIva: getTag('ventas_iva') || getTag('casilla_401'),
    ventas0: getTag('ventas_0') || getTag('casilla_403'),
    compras15: getTag('compras_15') || getTag('casilla_501'),
    compras0: getTag('compras_0') || getTag('casilla_503'),
    compras5: getTag('compras_5') || getTag('casilla_504'),
    compras8: getTag('compras_8') || getTag('casilla_505'),
    activosFijos: getTag('activos_fijos') || getTag('casilla_506'),
    importaciones: getTag('importaciones') || getTag('casilla_507'),
    retIva20: getTag('ret_iva_20') || getTag('casilla_601'),
    retIva30: getTag('ret_iva_30') || getTag('casilla_602'),
    retIva70: getTag('ret_iva_70') || getTag('casilla_603'),
    retIva100: getTag('ret_iva_100') || getTag('casilla_604'),
  }
}
