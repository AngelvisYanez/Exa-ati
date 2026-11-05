export interface PlanillaIESSRow {
  cedula: string
  nombreCompleto: string
  sueldo: number
  diasTrabajados: number
}

export function parsePlanillaIESSCSV(contenido: string): PlanillaIESSRow[] {
  const lineas = contenido.trim().split('\n')

  // Skip header
  const dataLines = lineas.slice(1)

  return dataLines
    .filter(linea => linea.trim().length > 0)
    .map(linea => {
      const cols = linea.split(',')
      return {
        cedula: cols[0]?.trim() ?? '',
        nombreCompleto: cols[1]?.trim() ?? '',
        sueldo: parseFloat(cols[2]?.replace(/[^0-9.,-]/g, '').replace(',', '.') ?? '0'),
        diasTrabajados: parseInt(cols[3]?.trim() || '30', 10),
      }
    })
    .filter(row => row.cedula.length > 0)
}

export function parsePlanillaIESSExcel(buffer: ArrayBuffer): PlanillaIESSRow[] {
  const rows: PlanillaIESSRow[] = []
  const data = new Uint8Array(buffer)
  const textDecoder = new TextDecoder('utf-8')
  const text = textDecoder.decode(data)

  const lineas = text.split('\n').filter(l => l.trim())
  for (let i = 1; i < lineas.length; i++) {
    const cols = lineas[i].split('\t')
    const cedula = cols[0]?.trim()
    if (!cedula) continue

    rows.push({
      cedula,
      nombreCompleto: cols[1]?.trim() ?? '',
      sueldo: parseFloat(cols[2]?.replace(/[^0-9.,-]/g, '').replace(',', '.') ?? '0'),
      diasTrabajados: parseInt(cols[3]?.trim() || '30', 10),
    })
  }

  return rows
}
