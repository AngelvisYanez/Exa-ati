import { NextRequest, NextResponse } from 'next/server'
import { verifyAuth, requireTenantId } from '@/services/sri-api/auth-helper'
import { upsertMensual, getMensual, listMensual, getCreditoPendienteAnterior } from '@/services/control-tributario/services/mensual.service'
import { requireModule } from '@/services/sri-api/rbac'

export async function GET(req: NextRequest) {
  try {
    const user = await verifyAuth(req)
    await requireModule(user, 'control-tributario')
    const tenantId = requireTenantId(user)
    const { searchParams } = new URL(req.url)
    const periodo = searchParams.get('periodo')
    const ruc = searchParams.get('ruc')

    if (periodo && ruc) {
      const data = await getMensual(tenantId, parseInt(periodo), ruc)
      return NextResponse.json({ data })
    }

    const data = await listMensual(tenantId, periodo ? parseInt(periodo) : undefined)
    return NextResponse.json({ data })
  } catch (error: any) {
    return NextResponse.json(
      { message: error.message || 'Error interno' },
      { status: error.message?.startsWith('No autorizado') ? 401 : 500 },
    )
  }
}

export async function POST(req: NextRequest) {
  try {
    const user = await verifyAuth(req)
    await requireModule(user, 'control-tributario')
    const tenantId = requireTenantId(user)
    const body = await req.json()
    const { periodo, ruc, ...data } = body

    if (!periodo || !ruc) {
      return NextResponse.json({ message: 'periodo y ruc requeridos' }, { status: 400 })
    }

    const creditoAnterior = await getCreditoPendienteAnterior(tenantId, ruc, periodo)
    const result = await upsertMensual(tenantId, periodo, ruc, data, creditoAnterior)

    return NextResponse.json({ data: result }, { status: 201 })
  } catch (error: any) {
    return NextResponse.json(
      { message: error.message || 'Error interno' },
      { status: error.message?.startsWith('No autorizado') ? 401 : 500 },
    )
  }
}
