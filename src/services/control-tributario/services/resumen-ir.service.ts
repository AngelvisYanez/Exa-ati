import { db } from '@/services/sri-api/db'
import { calcularIR } from '../calculos-ir'
import type { TramosIR, CalculoIRResult } from '../types'

export async function upsertResumenIR(
  tenantId: string,
  anio: number,
  ruc: string,
  data: Record<string, any>,
) {
  const tramos = await getTramosIR(tenantId, anio)

  const resultado = calcularIR(
    {
      ventas: data.ingresosVentas ?? 0,
      financieros: data.ingresosFinancieros ?? 0,
      otrosGravados: data.otrosIngresosGravados ?? 0,
      exentos: data.ingresosExentos ?? 0,
    },
    {
      compras: data.gastosCompras ?? 0,
      sueldos: data.gastosSueldos ?? 0,
      beneficiosSociales: data.gastosBeneficiosSociales ?? 0,
      seguridadSocial: data.gastosSeguridadSocial ?? 0,
      depreciaciones: data.gastosDepreciaciones ?? 0,
      interesesBancarios: data.gastosInteresesBancarios ?? 0,
      otrosDeducibles: data.otrosGastosDeducibles ?? 0,
    },
    data.gastosNoDeducibles ?? 0,
    data.retencionesRecibidas ?? 0,
    data.creditoTributarioAnioAnterior ?? 0,
    data.anticipoIR ?? 0,
    tramos,
    data.gastosPersonales ?? 0,
  )

  const payload = {
    tenant_id: tenantId,
    anio,
    ruc,
    ingresos_ventas: data.ingresosVentas ?? 0,
    ingresos_financieros: data.ingresosFinancieros ?? 0,
    otros_ingresos_gravados: data.otrosIngresosGravados ?? 0,
    ingresos_exentos: data.ingresosExentos ?? 0,
    gastos_compras: data.gastosCompras ?? 0,
    gastos_sueldos: data.gastosSueldos ?? 0,
    gastos_beneficios_sociales: data.gastosBeneficiosSociales ?? 0,
    gastos_seguridad_social: data.gastosSeguridadSocial ?? 0,
    gastos_depreciaciones: data.gastosDepreciaciones ?? 0,
    gastos_intereses_bancarios: data.gastosInteresesBancarios ?? 0,
    otros_gastos_deducibles: data.otrosGastosDeducibles ?? 0,
    utilidad_antes_participacion: resultado.utilidadAntesParticipacion,
    participacion_trabajadores: resultado.participacionTrabajadores,
    gastos_no_deducibles: data.gastosNoDeducibles ?? 0,
    utilidad_gravable: resultado.utilidadGravable,
    impuesto_causado: resultado.impuestoCausado,
    gastos_personales: data.gastosPersonales ?? 0,
    retenciones_recibidas: data.retencionesRecibidas ?? 0,
    credito_tributario_anio_anterior: data.creditoTributarioAnioAnterior ?? 0,
    anticipo_ir: data.anticipoIR ?? 0,
    ir_a_pagar: resultado.irAPagar,
    saldo_a_favor: resultado.saldoAFavor,
    created_at: new Date(),
    updated_at: new Date(),
  }

  const existing = await db.queryOne(
    'SELECT id FROM resumen_ir WHERE tenant_id = $1 AND anio = $2 AND ruc = $3',
    [tenantId, anio, ruc],
  )

  if (existing) {
    const { id, created_at, ...updateData } = payload as any
    updateData.updated_at = new Date()
    return db.update('resumen_ir', updateData, 'id = $1', [existing.id])
  }

  return db.insert('resumen_ir', payload)
}

export async function getResumenIR(tenantId: string, anio: number, ruc: string) {
  return db.queryOne(
    'SELECT * FROM resumen_ir WHERE tenant_id = $1 AND anio = $2 AND ruc = $3',
    [tenantId, anio, ruc],
  )
}

export async function listResumenIR(tenantId: string, anio?: number) {
  const conditions = ['tenant_id = $1']
  const params: any[] = [tenantId]
  if (anio) {
    conditions.push('anio = $2')
    params.push(anio)
  }
  return db.queryAll(
    `SELECT * FROM resumen_ir WHERE ${conditions.join(' AND ')} ORDER BY anio DESC`,
    params,
  )
}

export async function getTramosIR(tenantId: string, anio: number): Promise<TramosIR[]> {
  const tramos = await db.queryAll<any>(
    'SELECT * FROM tabla_ir_progresiva WHERE tenant_id = $1 AND anio = $2 ORDER BY fraccion_basica ASC',
    [tenantId, anio],
  )
  return tramos.map((t: any) => ({
    fraccionBasica: parseFloat(t.fraccion_basica),
    excesoHasta: t.exceso_hasta ? parseFloat(t.exceso_hasta) : null,
    impuestoFraccionBasica: parseFloat(t.impuesto_fraccion_basica),
    porcentajeExcedente: parseFloat(t.porcentaje_excedente),
  }))
}

export async function upsertTramoIR(
  tenantId: string,
  anio: number,
  fraccionBasica: number,
  excesoHasta: number | null,
  impuestoFraccionBasica: number,
  porcentajeExcedente: number,
) {
  const payload = {
    tenant_id: tenantId,
    anio,
    fraccion_basica: fraccionBasica,
    exceso_hasta: excesoHasta ?? null,
    impuesto_fraccion_basica: impuestoFraccionBasica,
    porcentaje_excedente: porcentajeExcedente,
  }

  const existing = await db.queryOne(
    'SELECT id FROM tabla_ir_progresiva WHERE tenant_id = $1 AND anio = $2 AND fraccion_basica = $3',
    [tenantId, anio, fraccionBasica],
  )

  if (existing) {
    return db.update('tabla_ir_progresiva', payload, 'id = $1', [existing.id])
  }

  return db.insert('tabla_ir_progresiva', payload)
}
