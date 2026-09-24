import { NextRequest, NextResponse } from 'next/server'
import { verifyAuth, requireTenantId } from '@/services/sri-api/auth-helper'
import { db } from '@/services/sri-api/db'

export async function GET(req: NextRequest) {
  try {
    const user = await verifyAuth(req)
    const tenantId = requireTenantId(user)
    const { searchParams } = new URL(req.url)
    const periodo = searchParams.get('periodo')
    const formulario = searchParams.get('formulario')

    const conditions = ['tenant_id = $1']
    const params: any[] = [tenantId]
    let idx = 2

    if (periodo) {
      conditions.push(`periodo = $${idx++}`)
      params.push(parseInt(periodo))
    }
    if (formulario) {
      conditions.push(`formulario = $${idx++}`)
      params.push(formulario)
    }

    const pagos = await db.queryAll<any>(
      `SELECT * FROM comprobantes_sri_pagos WHERE ${conditions.join(' AND ')} ORDER BY periodo DESC, formulario ASC`,
      params,
    )

    return NextResponse.json({ data: pagos })
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
    const { rucContribuyente, numeroSerie, formulario, periodo, fechaDeclaracion, valorPagado, tipo, archivoPath, estadoSri, observaciones } = body

    if (!rucContribuyente || !formulario || !periodo) {
      return NextResponse.json({ message: 'rucContribuyente, formulario y periodo requeridos' }, { status: 400 })
    }

    const result = await db.insert('comprobantes_sri_pagos', {
      tenant_id: tenantId,
      ruc_contribuyente: rucContribuyente,
      numero_serie: numeroSerie ?? null,
      formulario,
      periodo,
      fecha_declaracion: fechaDeclaracion ? new Date(fechaDeclaracion) : null,
      valor_pagado: valorPagado ?? 0,
      tipo: tipo ?? 'ORIGINAL',
      archivo_path: archivoPath ?? null,
      estado_sri: estadoSri ?? null,
      observaciones: observaciones ?? null,
      created_at: new Date(),
      updated_at: new Date(),
    })

    return NextResponse.json({ data: result }, { status: 201 })
  } catch (error: any) {
    return NextResponse.json(
      { message: error.message || 'Error interno' },
      { status: error.message?.startsWith('No autorizado') ? 401 : 500 },
    )
  }
}
