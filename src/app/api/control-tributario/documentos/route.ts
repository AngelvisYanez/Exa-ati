import { NextRequest, NextResponse } from 'next/server'
import { verifyAuth, requireTenantId } from '@/services/sri-api/auth-helper'
import { crearDocumento, listDocumentos, getDocumento, eliminarDocumento } from '@/services/control-tributario/services/documentos.service'

export async function GET(req: NextRequest) {
  try {
    const user = await verifyAuth(req)
    const tenantId = requireTenantId(user)
    const { searchParams } = new URL(req.url)
    const id = searchParams.get('id')

    if (id) {
      const doc = await getDocumento(id, tenantId)
      return NextResponse.json({ data: doc })
    }

    const data = await listDocumentos(tenantId, {
      periodo: searchParams.get('periodo') ? parseInt(searchParams.get('periodo')!) : undefined,
      tipo: searchParams.get('tipo') as any,
      modulo: searchParams.get('modulo') ?? undefined,
    })
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
    const { ...data } = body

    if (!data.periodo || !data.nombre || !data.tipo) {
      return NextResponse.json({ message: 'periodo, nombre y tipo requeridos' }, { status: 400 })
    }

    const result = await crearDocumento(tenantId, data)
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
    const id = searchParams.get('id')

    if (!id) {
      return NextResponse.json({ message: 'id requerido' }, { status: 400 })
    }

    await eliminarDocumento(id, tenantId)
    return NextResponse.json({ success: true })
  } catch (error: any) {
    return NextResponse.json(
      { message: error.message || 'Error interno' },
      { status: error.message?.startsWith('No autorizado') ? 401 : 500 },
    )
  }
}
