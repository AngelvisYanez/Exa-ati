import { NextRequest, NextResponse } from 'next/server'
import { verifyAuth, requireTenantId } from '@/services/sri-api/auth-helper'
import { db } from '@/services/sri-api/db'
import { upsertTramoIR, getTramosIR } from '@/services/control-tributario/services/resumen-ir.service'

export async function GET(req: NextRequest) {
  try {
    const user = await verifyAuth(req)
    const tenantId = requireTenantId(user)
    const { searchParams } = new URL(req.url)
    const tipo = searchParams.get('tipo')

    if (tipo === 'tramos-ir') {
      const anio = parseInt(searchParams.get('anio') || new Date().getFullYear().toString())
      const tramos = await getTramosIR(tenantId, anio)
      return NextResponse.json({ data: tramos })
    }

    const params = await db.queryAll(
      'SELECT * FROM parametros_tributarios WHERE tenant_id = $1 AND activo = true ORDER BY codigo',
      [tenantId],
    )

    return NextResponse.json({ data: params })
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
    const { tipo } = body

    if (tipo === 'tramo-ir') {
      const { anio, fraccionBasica, excesoHasta, impuestoFraccionBasica, porcentajeExcedente } = body
      const result = await upsertTramoIR(tenantId, anio, fraccionBasica, excesoHasta || null, impuestoFraccionBasica, porcentajeExcedente)
      return NextResponse.json({ data: result }, { status: 201 })
    }

    const { codigo, nombre, valor } = body
    if (!codigo || !nombre || valor === undefined) {
      return NextResponse.json({ message: 'codigo, nombre y valor requeridos' }, { status: 400 })
    }

    const existing = await db.queryOne(
      'SELECT id FROM parametros_tributarios WHERE tenant_id = $1 AND codigo = $2',
      [tenantId, codigo],
    )

    let result
    if (existing) {
      result = await db.update('parametros_tributarios', {
        nombre, valor, updated_at: new Date(),
      }, 'id = $1', [existing.id])
    } else {
      result = await db.insert('parametros_tributarios', {
        tenant_id: tenantId, codigo, nombre, valor,
        created_at: new Date(), updated_at: new Date(),
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
