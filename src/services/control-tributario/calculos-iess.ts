import type { CalculoIESSResult, DatosIESS } from './types'

const APORTE_PATRONAL_PCT = 0.1175
const APORTE_INDIVIDUAL_PCT = 0.0945
const CCC_PCT = 0.005
const FONDOS_RESERVA_PCT = 0.0833
const DECIMO_TERCERO_PCT = 0.0833
const DECIMO_CUARTO_PCT = 0.0833
const VACACIONES_PCT = 0.0417
const SALARIO_BASICO_MINIMO = 470

export function calcularIESS(data: DatosIESS): CalculoIESSResult {
  const sueldoProporcional = (data.sueldo / 30) * data.diasTrabajados

  const aportePatronal = sueldoProporcional * APORTE_PATRONAL_PCT
  const aporteIndividual = sueldoProporcional * APORTE_INDIVIDUAL_PCT
  const valorCcc = sueldoProporcional * CCC_PCT

  const fondosReserva = data.tieneFondosReserva
    ? sueldoProporcional * FONDOS_RESERVA_PCT
    : 0

  const decimoTercero = data.tieneDecimoTercero
    ? sueldoProporcional * DECIMO_TERCERO_PCT
    : 0

  const decimoCuarto = data.tieneDecimoCuarto
    ? (SALARIO_BASICO_MINIMO / 12)
    : 0

  const vacaciones = data.tieneVacaciones
    ? sueldoProporcional * VACACIONES_PCT
    : 0

  const totalAporte = aportePatronal + aporteIndividual + valorCcc
  const sueldoLiquido = sueldoProporcional - aporteIndividual
  const costoTotalEmpresa = sueldoProporcional + aportePatronal + valorCcc + fondosReserva + decimoTercero + decimoCuarto + vacaciones

  return {
    aportePatronal: Math.round(aportePatronal * 100) / 100,
    aporteIndividual: Math.round(aporteIndividual * 100) / 100,
    valorCcc: Math.round(valorCcc * 100) / 100,
    fondosReserva: Math.round(fondosReserva * 100) / 100,
    decimoTercero: Math.round(decimoTercero * 100) / 100,
    decimoCuarto: Math.round(decimoCuarto * 100) / 100,
    vacaciones: Math.round(vacaciones * 100) / 100,
    totalAporte: Math.round(totalAporte * 100) / 100,
    sueldoLiquido: Math.round(sueldoLiquido * 100) / 100,
    costoTotalEmpresa: Math.round(costoTotalEmpresa * 100) / 100,
  }
}
