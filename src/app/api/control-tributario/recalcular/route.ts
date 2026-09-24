import { NextRequest, NextResponse } from 'next/server'
import { verifyAuth, requireTenantId } from '@/services/sri-api/auth-helper'
import { upsertMensual, getMensual, getCreditoPendienteAnterior } from '@/services/control-tributario/services/mensual.service'
import { upsertResumenIR, getResumenIR } from '@/services/control-tributario/services/resumen-ir.service'
import { upsertPlanilla, getTotalesPlanilla } from '@/services/control-tributario/services/planillas.service'

export async function POST(req: NextRequest) {
  try {
    const user = await verifyAuth(req)
    const tenantId = requireTenantId(user)
    const body = await req.json()
    const { periodo, ruc, anio, modulo } = body

    const resultados: Record<string, any> = {}

    if ((modulo === 'mensual' || !modulo) && periodo && ruc) {
      const actual = await getMensual(tenantId, periodo, ruc)
      if (actual) {
        const creditoAnterior = await getCreditoPendienteAnterior(tenantId, ruc, periodo)
        const recalculado = await upsertMensual(tenantId, periodo, ruc, actual, creditoAnterior)
        resultados.mensual = {
          ivaCausado: recalculado?.iva_causado ?? recalculado?.ivaCausado,
          ivaAPagar: recalculado?.iva_a_pagar ?? recalculado?.ivaAPagar,
          creditoPendiente: recalculado?.credito_pendiente ?? recalculado?.creditoPendiente,
        }
      }
    }

    if ((modulo === 'planillas' || !modulo) && periodo) {
      const totales = await getTotalesPlanilla(tenantId, periodo)
      resultados.planillas = totales
    }

    if ((modulo === 'ir' || !modulo) && anio && ruc) {
      const existente = await getResumenIR(tenantId, anio, ruc)
      if (existente) {
        const recalculado = await upsertResumenIR(tenantId, anio, ruc, existente)
        resultados.ir = {
          impuestoCausado: recalculado?.impuesto_causado ?? recalculado?.impuestoCausado,
          irAPagar: recalculado?.ir_a_pagar ?? recalculado?.irAPagar,
          saldoAFavor: recalculado?.saldo_a_favor ?? recalculado?.saldoAFavor,
        }
      }
    }

    return NextResponse.json({ success: true, resultados })
  } catch (error: any) {
    return NextResponse.json(
      { message: error.message || 'Error al recalcular' },
      { status: 500 },
    )
  }
}
