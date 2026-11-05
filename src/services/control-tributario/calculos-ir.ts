import type { CalculoIRResult, TramosIR } from './types'

const PARTICIPACION_TRABAJADORES = 0.15
const GASTOS_PERSONALES_DEFAULT = 0

export function calcularIR(
  ingresos: {
    ventas: number
    financieros: number
    otrosGravados: number
    exentos: number
  },
  gastos: {
    compras: number
    sueldos: number
    beneficiosSociales: number
    seguridadSocial: number
    depreciaciones: number
    interesesBancarios: number
    otrosDeducibles: number
  },
  gastosNoDeducibles: number,
  retencionesRecibidas: number,
  creditoTributarioAnioAnterior: number,
  anticipoIR: number,
  tramos: TramosIR[],
  gastosPersonales = GASTOS_PERSONALES_DEFAULT,
): CalculoIRResult {
  const totalIngresos = ingresos.ventas + ingresos.financieros + ingresos.otrosGravados + ingresos.exentos
  const totalGastosDeducibles =
    gastos.compras +
    gastos.sueldos +
    gastos.beneficiosSociales +
    gastos.seguridadSocial +
    gastos.depreciaciones +
    gastos.interesesBancarios +
    gastos.otrosDeducibles

  const utilidadAntesParticipacion = totalIngresos - totalGastosDeducibles - gastosNoDeducibles
  const participacionTrabajadores = Math.max(0, utilidadAntesParticipacion * PARTICIPACION_TRABAJADORES)

  const utilidadGravable = Math.max(0, utilidadAntesParticipacion - participacionTrabajadores)

  const impuestoCausado = calcularImpuestoProgresivo(utilidadGravable, tramos)

  const totalRetenciones = retencionesRecibidas + gastosPersonales
  const irNeto = Math.max(0, impuestoCausado - totalRetenciones)

  const irAPagar = Math.max(0, irNeto - creditoTributarioAnioAnterior + anticipoIR)
  const saldoAFavor = Math.max(0, creditoTributarioAnioAnterior - irNeto)

  return {
    utilidadAntesParticipacion: Math.round(utilidadAntesParticipacion * 100) / 100,
    participacionTrabajadores: Math.round(participacionTrabajadores * 100) / 100,
    utilidadGravable: Math.round(utilidadGravable * 100) / 100,
    impuestoCausado: Math.round(impuestoCausado * 100) / 100,
    irAPagar: Math.round(irAPagar * 100) / 100,
    saldoAFavor: Math.round(saldoAFavor * 100) / 100,
  }
}

function calcularImpuestoProgresivo(base: number, tramos: TramosIR[]): number {
  for (const tramo of tramos) {
    if (tramo.excesoHasta === null || base <= tramo.excesoHasta) {
      const exceso = base - tramo.fraccionBasica
      const impuestoExceso = Math.max(0, exceso * (tramo.porcentajeExcedente / 100))
      return tramo.impuestoFraccionBasica + impuestoExceso
    }
  }
  return 0
}
