export interface SemestreObligacion {
  periodo: number
  fechaVencimiento: Date
  tipo: string
  descripcion: string
}

const DIAS_VENCIMIENTO_POR_TIPO: Record<string, number> = {
  IVA: 10,
  RET_IR: 10,
  ATS: 15,
  IR_ANUAL: 90,
  ANTICIPO_IR: 30,
  IESS: 15,
}

type DictamenTipo = 'NINGUNO' | 'POSITIVO' | 'NEGATIVO'

export function calcularFechaVencimiento(
  tipo: string,
  periodo: number,
  novenoDigito: number,
  dictamen?: DictamenTipo,
): Date {
  const periodoStr = String(periodo)
  const year = parseInt(periodoStr.substring(0, 4))
  const month = parseInt(periodoStr.substring(4, 6))

  // Para obligaciones anuales (IR_ANUAL, ANTICIPO_IR)
  const esObligacionAnual = tipo === 'IR_ANUAL' || tipo === 'ANTICIPO_IR'

  let baseDate: Date
  if (esObligacionAnual) {
    // Ej: periodo 202512 -> vence en marzo 2026
    baseDate = new Date(year + 1, 2, 1) // Marzo del siguiente año
  } else {
    // Obligaciones mensuales: mes siguiente
    const siguienteMes = month === 12 ? 1 : month + 1
    const siguienteAno = month === 12 ? year + 1 : year
    baseDate = new Date(siguienteAno, siguienteMes - 1, 1)
  }

  // Días hábiles según noveno dígito del RUC
  const diasBase = DIAS_VENCIMIENTO_POR_TIPO[tipo] || 10
  let vencimiento = new Date(baseDate.getTime() + (diasBase + novenoDigito) * 86400000)

  if (dictamen === 'POSITIVO' && tipo === 'IR_ANUAL') {
    vencimiento = new Date(vencimiento.getTime() + 90 * 86400000)
  }

  return vencimiento
}

export function debePresentarATS(totalVentasAnual: number, umbral: number = 0): boolean {
  return totalVentasAnual > umbral
}

export function estaVencida(fechaVencimiento: Date, fechaActual: Date = new Date()): boolean {
  return fechaActual > fechaVencimiento
}

export function calcularAnticipoMinimo(impuestoCausadoAnual: number): number {
  return Math.round(impuestoCausadoAnual * 0.5 * 100) / 100
}
