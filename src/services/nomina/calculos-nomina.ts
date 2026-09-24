import { calcularIREmpleado, GastosPersonales } from './calculos-ir-empleados';

export interface DatosEmpleadoNomina {
  cedula: string;
  nombreCompleto: string;
  sueldoBase: number;
  diasTrabajados?: number; // defecto 30
  horasExtras50?: number;
  horasExtras100?: number;
  comisiones?: number;
  bonos?: number;
  acumulaDecimoTercero?: boolean;
  acumulaDecimoCuarto?: boolean;
  acumulaFondosReserva?: boolean;
  aniosServicio?: number;
  cargasFamiliares?: number;
  gastosPersonalesProyectados?: GastosPersonales;
  descuentosAdicionales?: number;
}

export interface ResultadoNominaEmpleado {
  sueldoGanado: number;
  valorHorasExtras50: number;
  valorHorasExtras100: number;
  totalHorasExtras: number;
  totalIngresosGravados: number;
  aporteIndividualIESS: number;  // 9.45%
  aportePatronalIESS: number;    // 11.15%
  fondosReserva: number;         // 8.33%
  decimoTercero: number;         // 1/12
  decimoCuarto: number;          // 1/12 de $470
  vacaciones: number;            // 1/24
  impuestoRentaRetenido: number; // Retención IR mensual
  totalDescuentos: number;
  sueldoNetoAPagar: number;
  costoTotalEmpresa: number;
}

const SALARIO_BASICO_UNIFICADO = 470; // SBU 2025/2026 Ecuador

export function calcularNominaEmpleado(datos: DatosEmpleadoNomina): ResultadoNominaEmpleado {
  const {
    sueldoBase,
    diasTrabajados = 30,
    horasExtras50 = 0,
    horasExtras100 = 0,
    comisiones = 0,
    bonos = 0,
    acumulaDecimoTercero = false,
    acumulaDecimoCuarto = false,
    acumulaFondosReserva = false,
    aniosServicio = 1,
    cargasFamiliares = 0,
    gastosPersonalesProyectados = {},
    descuentosAdicionales = 0,
  } = datos;

  // 1. Sueldo Proporcional y Horas Extras
  const sueldoGanado = Number(((sueldoBase / 30) * Math.min(30, diasTrabajados)).toFixed(2));
  const valorHoraNormal = sueldoBase / 240; // 30 días * 8h = 240 horas
  const valorHorasExtras50 = Number((horasExtras50 * valorHoraNormal * 1.5).toFixed(2));
  const valorHorasExtras100 = Number((horasExtras100 * valorHoraNormal * 2.0).toFixed(2));
  const totalHorasExtras = Number((valorHorasExtras50 + valorHorasExtras100).toFixed(2));

  // 2. Total Ingresos Gravados
  const totalIngresosGravados = Number(
    (sueldoGanado + totalHorasExtras + comisiones + bonos).toFixed(2)
  );

  // 3. Aportes IESS
  const aporteIndividualIESS = Number((totalIngresosGravados * 0.0945).toFixed(2));
  const aportePatronalIESS = Number((totalIngresosGravados * 0.1115).toFixed(2));

  // 4. Beneficios y Provisiones Sociales
  const fondosReserva =
    aniosServicio >= 1
      ? Number((totalIngresosGravados * 0.0833).toFixed(2))
      : 0;

  const decimoTercero = Number((totalIngresosGravados / 12).toFixed(2));
  const decimoCuarto = Number(((SALARIO_BASICO_UNIFICADO / 12) * (diasTrabajados / 30)).toFixed(2));
  const vacaciones = Number((totalIngresosGravados / 24).toFixed(2));

  // 5. Retención de Impuesto a la Renta Mensual Proyectado
  const ingresoAnualProyectado = totalIngresosGravados * 12;
  const aporteIESSAnualProyectado = aporteIndividualIESS * 12;

  const calculoIR = calcularIREmpleado({
    ingresoAnualBruto: ingresoAnualProyectado,
    aporteIESSAnual: aporteIESSAnualProyectado,
    cargasFamiliares,
    gastosPersonales: gastosPersonalesProyectados,
  });

  const impuestoRentaRetenido = calculoIR.retencionMensualSugerida;

  // 6. Beneficios a pagar directamente en el rol (si no se acumulan)
  let ingresosAdicionalesEnRol = 0;
  if (!acumulaDecimoTercero) ingresosAdicionalesEnRol += decimoTercero;
  if (!acumulaDecimoCuarto) ingresosAdicionalesEnRol += decimoCuarto;
  if (!acumulaFondosReserva) ingresosAdicionalesEnRol += fondosReserva;

  // 7. Totales
  const totalDescuentos = Number(
    (aporteIndividualIESS + impuestoRentaRetenido + descuentosAdicionales).toFixed(2)
  );

  const sueldoNetoAPagar = Number(
    (totalIngresosGravados + ingresosAdicionalesEnRol - totalDescuentos).toFixed(2)
  );

  const costoTotalEmpresa = Number(
    (
      totalIngresosGravados +
      aportePatronalIESS +
      decimoTercero +
      decimoCuarto +
      fondosReserva +
      vacaciones
    ).toFixed(2)
  );

  return {
    sueldoGanado,
    valorHorasExtras50,
    valorHorasExtras100,
    totalHorasExtras,
    totalIngresosGravados,
    aporteIndividualIESS,
    aportePatronalIESS,
    fondosReserva,
    decimoTercero,
    decimoCuarto,
    vacaciones,
    impuestoRentaRetenido,
    totalDescuentos,
    sueldoNetoAPagar,
    costoTotalEmpresa,
  };
}
