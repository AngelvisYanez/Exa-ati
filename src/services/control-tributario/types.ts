export type EstadoObligacion = 'PENDIENTE' | 'EN_PROCESO' | 'CUMPLIDO' | 'TARDIO'

export type TipoFormulario = '104' | '103' | '101' | '102'

export type TipoDocumentoFiscal =
  | 'COMPROBANTE_SRI'
  | 'PLANILLA_IESS'
  | 'ATS'
  | 'ANEXO'
  | 'DECLARACION'
  | 'OTRO'

export type TipoPagoSRI = 'ORIGINAL' | 'SUSTITUTIVA'

export interface CalculoIVAResult {
  totalVentas: number
  totalCompras: number
  ivaCausado: number
  creditoTributario: number
  ivaAPagar: number
  creditoPendiente: number
}

export interface CalculoIRResult {
  utilidadAntesParticipacion: number
  participacionTrabajadores: number
  utilidadGravable: number
  impuestoCausado: number
  irAPagar: number
  saldoAFavor: number
}

export interface CalculoIESSResult {
  aportePatronal: number
  aporteIndividual: number
  valorCcc: number
  fondosReserva: number
  decimoTercero: number
  decimoCuarto: number
  vacaciones: number
  totalAporte: number
  sueldoLiquido: number
  costoTotalEmpresa: number
}

export interface DatosForm104 {
  ventasIva: number
  ventas0: number
  compras15: number
  compras0: number
  compras5: number
  compras8: number
  activosFijos: number
  importaciones: number
  retIva20: number
  retIva30: number
  retIva70: number
  retIva100: number
}

export interface DatosForm103 {
  retIr303: number
  retIr303A: number
  retIr304: number
  retIr307: number
  retIr310: number
  retIr312: number
  retIr322: number
  retIr332: number
  retIr343: number
  retIr344: number
  retIr346: number
}

export interface DatosIESS {
  sueldo: number
  diasTrabajados: number
  tieneFondosReserva: boolean
  tieneDecimoTercero: boolean
  tieneDecimoCuarto: boolean
  tieneVacaciones: boolean
}

export interface TramosIR {
  fraccionBasica: number
  excesoHasta: number | null
  impuestoFraccionBasica: number
  porcentajeExcedente: number
}
