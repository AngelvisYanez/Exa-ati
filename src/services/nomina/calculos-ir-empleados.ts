export interface GastosPersonales {
  vivienda?: number;
  educacion?: number;
  alimentacion?: number;
  vestimenta?: number;
  salud?: number;
  turismo?: number;
}

export interface CalculoIRParams {
  ingresoAnualBruto: number;
  aporteIESSAnual: number;
  cargasFamiliares?: number;
  gastosPersonales?: GastosPersonales;
  esDiscapacitado?: boolean;
  porcentajeDiscapacidad?: number;
  esTerceraEdad?: boolean;
}

export interface CalculoIRResult {
  baseImponibleAnual: number;
  impuestoCausadoBruto: number;
  totalGastosPersonales: number;
  limiteGastosPermitido: number;
  rebajaGastosPersonales: number;
  impuestoAnualAPagar: number;
  retencionMensualSugerida: number;
}

// Tabla Impuesto a la Renta SRI Ecuador Personas Naturales
const TABLA_IR_SRI = [
  { basica: 0, exceso: 11902, impuestoBasico: 0, porcentajeExceso: 0 },
  { basica: 11902, exceso: 15159, impuestoBasico: 0, porcentajeExceso: 0.05 },
  { basica: 15159, exceso: 19682, impuestoBasico: 163, porcentajeExceso: 0.10 },
  { basica: 19682, exceso: 26031, impuestoBasico: 615, porcentajeExceso: 0.12 },
  { basica: 26031, exceso: 34255, impuestoBasico: 1377, porcentajeExceso: 0.15 },
  { basica: 34255, exceso: 45407, impuestoBasico: 2611, porcentajeExceso: 0.20 },
  { basica: 45407, exceso: 60450, impuestoBasico: 4841, porcentajeExceso: 0.25 },
  { basica: 60450, exceso: 80605, impuestoBasico: 8602, porcentajeExceso: 0.30 },
  { basica: 80605, exceso: 107199, impuestoBasico: 14648, porcentajeExceso: 0.35 },
  { basica: 107199, exceso: Infinity, impuestoBasico: 23956, porcentajeExceso: 0.37 },
];

const CANASTA_BASICA_FAMILIAR = 795; // Valor canasta básica de referencia

export function calcularIREmpleado(params: CalculoIRParams): CalculoIRResult {
  const {
    ingresoAnualBruto,
    aporteIESSAnual,
    cargasFamiliares = 0,
    gastosPersonales = {},
    esDiscapacitado = false,
    esTerceraEdad = false,
  } = params;

  // 1. Base Imponible
  let baseImponible = Math.max(0, ingresoAnualBruto - aporteIESSAnual);

  // Exoneración por tercera edad (2 fracciones básicas gravadas con 0%)
  if (esTerceraEdad) {
    baseImponible = Math.max(0, baseImponible - 11902 * 2);
  }

  // Exoneración por discapacidad (proporcional al porcentaje)
  if (esDiscapacitado && params.porcentajeDiscapacidad) {
    const pctDiscapacidad = Math.min(100, Math.max(30, params.porcentajeDiscapacidad)) / 100;
    baseImponible = Math.max(0, baseImponible - 11902 * 2 * pctDiscapacidad);
  }

  // 2. Impuesto Causado Bruto según Tabla SRI
  let impuestoCausadoBruto = 0;
  for (const tramo of TABLA_IR_SRI) {
    if (baseImponible > tramo.basica) {
      const parteExcedente = Math.min(baseImponible, tramo.exceso) - tramo.basica;
      impuestoCausadoBruto = tramo.impuestoBasico + parteExcedente * tramo.porcentajeExceso;
    }
  }

  // 3. Gastos Personales y Rebaja según Cargas Familiares
  const totalGastos =
    (gastosPersonales.vivienda ?? 0) +
    (gastosPersonales.educacion ?? 0) +
    (gastosPersonales.alimentacion ?? 0) +
    (gastosPersonales.vestimenta ?? 0) +
    (gastosPersonales.salud ?? 0) +
    (gastosPersonales.turismo ?? 0);

  // Factor Canastas según número de cargas
  let factorCanastas = 7;
  if (cargasFamiliares === 1) factorCanastas = 9;
  else if (cargasFamiliares === 2) factorCanastas = 11;
  else if (cargasFamiliares === 3) factorCanastas = 14;
  else if (cargasFamiliares === 4) factorCanastas = 17;
  else if (cargasFamiliares >= 5) factorCanastas = 20;

  const limiteGastosPermitido = factorCanastas * CANASTA_BASICA_FAMILIAR;
  const gastosAplicables = Math.min(totalGastos, limiteGastosPermitido);

  // Rebaja del 18% sobre los gastos aplicables
  const rebajaGastosPersonales = Math.min(impuestoCausadoBruto, gastosAplicables * 0.18);

  // 4. Impuesto Neto Anual a Pagar y Retención Mensual
  const impuestoAnualAPagar = Math.max(0, impuestoCausadoBruto - rebajaGastosPersonales);
  const retencionMensualSugerida = Number((impuestoAnualAPagar / 12).toFixed(2));

  return {
    baseImponibleAnual: Number(baseImponible.toFixed(2)),
    impuestoCausadoBruto: Number(impuestoCausadoBruto.toFixed(2)),
    totalGastosPersonales: Number(totalGastos.toFixed(2)),
    limiteGastosPermitido: Number(limiteGastosPermitido.toFixed(2)),
    rebajaGastosPersonales: Number(rebajaGastosPersonales.toFixed(2)),
    impuestoAnualAPagar: Number(impuestoAnualAPagar.toFixed(2)),
    retencionMensualSugerida,
  };
}
