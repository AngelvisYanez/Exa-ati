import { NextRequest, NextResponse } from 'next/server'
import { verifyAuth, requireTenantId } from '@/services/sri-api/auth-helper'
import { db } from '@/services/sri-api/db'
import { calcularFechaVencimiento, estaVencida } from '@/services/control-tributario/obligaciones'

export async function GET(req: NextRequest) {
  try {
    const user = await verifyAuth(req)
    const tenantId = requireTenantId(user)
    const { searchParams } = new URL(req.url)
    const estado = searchParams.get('estado')

    const conditions = ['o.tenant_id = $1']
    const params: any[] = [tenantId]
    if (estado) {
      conditions.push('o.estado = $2')
      params.push(estado)
    }

    const obligaciones = await db.queryAll<any>(
      `SELECT * FROM obligaciones_externas o WHERE ${conditions.join(' AND ')} ORDER BY o.periodo DESC, o.tipo ASC`,
      params,
    )

    const ahora = new Date()
    const conEstado = obligaciones.map((o: any) => ({
      ...o,
      vencida: o.fecha_vencimiento ? estaVencida(new Date(o.fecha_vencimiento), ahora) && o.estado !== 'CUMPLIDO' : false,
    }))

    return NextResponse.json({ data: conEstado })
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
    const { ruc, tipo, periodo, descripcion, fechaVencimiento, novenoDigito, dictamen, observaciones } = body

    if (!ruc || !tipo || !periodo) {
      return NextResponse.json({ message: 'ruc, tipo y periodo requeridos' }, { status: 400 })
    }

    const vencimiento = fechaVencimiento
      ? new Date(fechaVencimiento)
      : calcularFechaVencimiento(tipo, periodo, novenoDigito ?? 0, dictamen)

    const existing = await db.queryOne(
      'SELECT id FROM obligaciones_externas WHERE tenant_id = $1 AND ruc = $2 AND tipo = $3 AND periodo = $4',
      [tenantId, ruc, tipo, periodo],
    )

    let result
    if (existing) {
      result = await db.update('obligaciones_externas', {
        descripcion,
        fecha_vencimiento: vencimiento,
        observaciones,
        updated_at: new Date(),
      }, 'id = $1', [existing.id])
    } else {
      result = await db.insert('obligaciones_externas', {
        tenant_id: tenantId,
        ruc,
        tipo,
        periodo,
        descripcion,
        fecha_vencimiento: vencimiento,
        observaciones,
        created_at: new Date(),
        updated_at: new Date(),
      })
    }

    return NextResponse.json({ data: result }, { status: 201 })
  } catch (error: any) {
    return NextResponse.json(
      { message: error.message || 'Error interno' },
      { status: error.message?.startsWith('No autorizado') ? 401 : 500 },
    )
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const user = await verifyAuth(req)
    const tenantId = requireTenantId(user)
    const body = await req.json()
    const { ruc, tipo, periodo, estado, observaciones, fechaDeclarado } = body

    if (!ruc || !tipo || !periodo) {
      return NextResponse.json({ message: 'ruc, tipo y periodo requeridos' }, { status: 400 })
    }

    const updateData: Record<string, any> = { updated_at: new Date() }
    if (estado) updateData.estado = estado
    if (observaciones) updateData.observaciones = observaciones
    if (fechaDeclarado) updateData.fecha_declarado = new Date(fechaDeclarado)

    const result = await db.update(
      'obligaciones_externas',
      updateData,
      'tenant_id = $1 AND ruc = $2 AND tipo = $3 AND periodo = $4',
      [tenantId, ruc, tipo, periodo],
    )

    return NextResponse.json({ data: result })
  } catch (error: any) {
    return NextResponse.json(
      { message: error.message || 'Error interno' },
      { status: error.message?.startsWith('No autorizado') ? 401 : 500 },
    )
  }
}
