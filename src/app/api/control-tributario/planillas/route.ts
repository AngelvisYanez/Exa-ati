import { NextRequest, NextResponse } from 'next/server'
import { verifyAuth, requireTenantId } from '@/services/sri-api/auth-helper'
import { db } from '@/services/sri-api/db'
import {
  upsertPlanilla,
  listPlanillas,
  getTotalesPlanilla,
  deletePlanilla,
} from '@/services/control-tributario/services/planillas.service'

export async function GET(req: NextRequest) {
  try {
    const user = await verifyAuth(req)
    const tenantId = requireTenantId(user)
    const { searchParams } = new URL(req.url)
    const periodo = searchParams.get('periodo')

    if (searchParams.get('totales') === 'true' && periodo) {
      const totales = await getTotalesPlanilla(tenantId, parseInt(periodo))
      return NextResponse.json({ data: totales })
    }

    const data = await listPlanillas(tenantId, periodo ? parseInt(periodo) : undefined)
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
    const tenantId = requireTenantId(user)
    const body = await req.json()
    const { periodo, ...data } = body

    if (!periodo || !data.cedula || !data.nombreCompleto || data.sueldo === undefined) {
      return NextResponse.json({ message: 'periodo, cedula, nombreCompleto y sueldo requeridos' }, { status: 400 })
    }

    const result = await upsertPlanilla(tenantId, periodo, data)
    return NextResponse.json({ data: result }, { status: 201 })
  } catch (error: any) {
    return NextResponse.json(
      { message: error.message || 'Error interno' },
      { status: error.message?.startsWith('No autorizado') ? 401 : 500 },
    )
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const user = await verifyAuth(req)
    const tenantId = requireTenantId(user)
    const { searchParams } = new URL(req.url)
    const periodo = searchParams.get('periodo')
    const cedula = searchParams.get('cedula')

    if (!periodo || !cedula) {
      return NextResponse.json({ message: 'periodo y cedula requeridos' }, { status: 400 })
    }

    await deletePlanilla(tenantId, parseInt(periodo), cedula)
    return NextResponse.json({ success: true })
  } catch (error: any) {
    return NextResponse.json(
      { message: error.message || 'Error interno' },
      { status: error.message?.startsWith('No autorizado') ? 401 : 500 },
    )
  }
}
