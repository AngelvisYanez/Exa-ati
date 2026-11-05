import { NextRequest, NextResponse } from 'next/server'
import { verifyAuth, requireTenantId } from '@/services/sri-api/auth-helper'
import { upsertResumenIR, getResumenIR, listResumenIR } from '@/services/control-tributario/services/resumen-ir.service'

export async function GET(req: NextRequest) {
  try {
    const user = await verifyAuth(req)
    const tenantId = requireTenantId(user)
    const { searchParams } = new URL(req.url)
    const anio = searchParams.get('anio')
    const ruc = searchParams.get('ruc')

    if (anio && ruc) {
      const data = await getResumenIR(tenantId, parseInt(anio), ruc)
      return NextResponse.json({ data })
    }

    const data = await listResumenIR(tenantId, anio ? parseInt(anio) : undefined)
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
    const { anio, ruc, ...data } = body

    if (!anio || !ruc) {
      return NextResponse.json({ message: 'anio y ruc requeridos' }, { status: 400 })
    }

    const result = await upsertResumenIR(tenantId, anio, ruc, data)
    return NextResponse.json({ data: result }, { status: 201 })
  } catch (error: any) {
    return NextResponse.json(
      { message: error.message || 'Error interno' },
      { status: error.message?.startsWith('No autorizado') ? 401 : 500 },
    )
  }
}
