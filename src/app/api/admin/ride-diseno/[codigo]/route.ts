import { NextResponse } from 'next/server'
import { verifyAuth } from '@/services/sri-api/auth-helper'
import { deleteRideDiseno, getRideDiseno } from '@/services/sri-api/ride-diseno'

function assertSuperadmin(rol: string) {
  if (rol !== 'SUPERADMIN') {
    throw new Error('Acceso denegado: solo el superadmin puede configurar el diseño del RIDE')
  }
}

export async function GET(req: Request, ctx: { params: Promise<{ codigo: string }> }) {
  try {
    const user = await verifyAuth(req)
    assertSuperadmin(user.rol)
    const { codigo } = await ctx.params
    const data = await getRideDiseno(decodeURIComponent(codigo))
    if (!data) return NextResponse.json({ message: 'Diseño no encontrado' }, { status: 404 })
    return NextResponse.json({ success: true, data })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Error interno'
    const status = message.startsWith('No autorizado') ? 401 : message.includes('Acceso denegado') ? 403 : 500
    return NextResponse.json({ message }, { status })
  }
}

export async function DELETE(req: Request, ctx: { params: Promise<{ codigo: string }> }) {
  try {
    const user = await verifyAuth(req)
    assertSuperadmin(user.rol)
    const { codigo } = await ctx.params
    await deleteRideDiseno(decodeURIComponent(codigo))
    return NextResponse.json({ success: true })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Error interno'
    const status = message.startsWith('No autorizado')
      ? 401
      : message.includes('Acceso denegado')
        ? 403
        : message.includes('no encontrado')
          ? 404
          : message.includes('no se eliminan')
            ? 400
            : 500
    return NextResponse.json({ message }, { status })
  }
}
