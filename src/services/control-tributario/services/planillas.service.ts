import { db } from '@/services/sri-api/db'
import { calcularIESS } from '../calculos-iess'
import type { CalculoIESSResult } from '../types'

export async function upsertPlanilla(
  tenantId: string,
  periodo: number,
  data: {
    cedula: string
    nombreCompleto: string
    sueldo: number
    diasTrabajados?: number
    tieneFondosReserva?: boolean
    tieneDecimoTercero?: boolean
    tieneDecimoCuarto?: boolean
    tieneVacaciones?: boolean
  },
) {
  const resultado = calcularIESS({
    sueldo: data.sueldo,
    diasTrabajados: data.diasTrabajados ?? 30,
    tieneFondosReserva: data.tieneFondosReserva ?? false,
    tieneDecimoTercero: data.tieneDecimoTercero ?? true,
    tieneDecimoCuarto: data.tieneDecimoCuarto ?? true,
    tieneVacaciones: data.tieneVacaciones ?? true,
  })

  const payload = {
    tenant_id: tenantId,
    periodo,
    cedula: data.cedula,
    nombre_completo: data.nombreCompleto,
    sueldo: data.sueldo,
    dias_trabajados: data.diasTrabajados ?? 30,
    aporte_patronal: resultado.aportePatronal,
    aporte_individual: resultado.aporteIndividual,
    valor_ccc: resultado.valorCcc,
    fondos_reserva: resultado.fondosReserva,
    decimo_tercero: resultado.decimoTercero,
    decimo_cuarto: resultado.decimoCuarto,
    vacaciones: resultado.vacaciones,
    total_aporte: resultado.totalAporte,
    sueldo_liquido: resultado.sueldoLiquido,
    costo_total_empresa: resultado.costoTotalEmpresa,
    created_at: new Date(),
    updated_at: new Date(),
  }

  const existing = await db.queryOne(
    'SELECT id FROM planillas_iess WHERE tenant_id = $1 AND periodo = $2 AND cedula = $3',
    [tenantId, periodo, data.cedula],
  )

  if (existing) {
    const { id, created_at, ...updateData } = payload as any
    updateData.updated_at = new Date()
    return db.update('planillas_iess', updateData, 'id = $1', [existing.id])
  }

  return db.insert('planillas_iess', payload)
}

export async function listPlanillas(tenantId: string, periodo?: number) {
  const conditions = ['tenant_id = $1']
  const params: any[] = [tenantId]
  if (periodo) {
    conditions.push('periodo = $2')
    params.push(periodo)
  }
  return db.queryAll(
    `SELECT * FROM planillas_iess WHERE ${conditions.join(' AND ')} ORDER BY periodo DESC, nombre_completo ASC`,
    params,
  )
}

export async function getTotalesPlanilla(tenantId: string, periodo: number) {
  const planillas = await db.queryAll<any>(
    'SELECT * FROM planillas_iess WHERE tenant_id = $1 AND periodo = $2',
    [tenantId, periodo],
  )

  return {
    totalSueldos: planillas.reduce((s: number, p: any) => s + parseFloat(p.sueldo), 0),
    totalAportePatronal: planillas.reduce((s: number, p: any) => s + parseFloat(p.aporte_patronal ?? 0), 0),
    totalAporteIndividual: planillas.reduce((s: number, p: any) => s + parseFloat(p.aporte_individual ?? 0), 0),
    totalCostoEmpresa: planillas.reduce((s: number, p: any) => s + parseFloat(p.costo_total_empresa ?? 0), 0),
    totalFondosReserva: planillas.reduce((s: number, p: any) => s + parseFloat(p.fondos_reserva ?? 0), 0),
    totalDecimoTercero: planillas.reduce((s: number, p: any) => s + parseFloat(p.decimo_tercero ?? 0), 0),
    totalDecimoCuarto: planillas.reduce((s: number, p: any) => s + parseFloat(p.decimo_cuarto ?? 0), 0),
    totalVacaciones: planillas.reduce((s: number, p: any) => s + parseFloat(p.vacaciones ?? 0), 0),
    numEmpleados: planillas.length,
  }
}

export async function deletePlanilla(tenantId: string, periodo: number, cedula: string) {
  return db.query(
    'DELETE FROM planillas_iess WHERE tenant_id = $1 AND periodo = $2 AND cedula = $3',
    [tenantId, periodo, cedula],
  )
}
