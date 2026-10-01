import { NextResponse } from 'next/server'
import { verifyAuth, type JwtPayload } from '@/services/sri-api/auth-helper'
import {
  activarRideDiseno,
  createRideDiseno,
  listRideDisenos,
  rideDisenoSchema,
  updateRideDiseno,
} from '@/services/sri-api/ride-diseno'

function assertSuperadmin(user: JwtPayload) {
  if (user.rol !== 'SUPERADMIN') {
    throw new Error('Acceso denegado: solo el superadmin puede configurar el diseño del RIDE')
  }
}

function errorResponse(error: unknown) {
  const message = error instanceof Error ? error.message : 'Error interno'
  const status = message.startsWith('No autorizado')
    ? 401
    : message.includes('Acceso denegado')
      ? 403
      : message.includes('no encontrado')
        ? 404
        : message.includes('Ya existe') ||
            message.includes('no se') ||
            message.includes('Elige') ||
            message.includes('código') ||
            message.includes('plantilla') ||
            message.includes('hexadecimal') ||
            message.includes('inválid')
          ? 400
          : 500
  return NextResponse.json({ message }, { status })
}

export async function GET(req: Request) {
  try {
    const user = await verifyAuth(req)
    assertSuperadmin(user)
    const data = await listRideDisenos()
    return NextResponse.json({ success: true, data })
  } catch (error) {
    return errorResponse(error)
  }
}

export async function POST(req: Request) {
  try {
    const user = await verifyAuth(req)
    assertSuperadmin(user)
    const parsed = rideDisenoSchema.safeParse(await req.json())
    if (!parsed.success) {
      return NextResponse.json(
        { message: parsed.error.issues[0]?.message || 'Datos inválidos' },
        { status: 400 }
      )
    }
    const data = await createRideDiseno(parsed.data)
    return NextResponse.json({ success: true, data })
  } catch (error) {
    return errorResponse(error)
  }
}

export async function PUT(req: Request) {
  try {
    const user = await verifyAuth(req)
    assertSuperadmin(user)
    const body = await req.json()
    const codigo = String(body.codigo || '')
    const parsed = rideDisenoSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        { message: parsed.error.issues[0]?.message || 'Datos inválidos' },
        { status: 400 }
      )
    }
    const data = await updateRideDiseno(codigo, parsed.data)
    return NextResponse.json({ success: true, data })
  } catch (error) {
    return errorResponse(error)
  }
}

export async function PATCH(req: Request) {
  try {
    const user = await verifyAuth(req)
    assertSuperadmin(user)
    const body = await req.json()
    if (body.accion !== 'activar' || !body.codigo) {
      return NextResponse.json({ message: 'Acción inválida' }, { status: 400 })
    }
    const data = await activarRideDiseno(String(body.codigo))
    return NextResponse.json({ success: true, data })
  } catch (error) {
    return errorResponse(error)
  }
}
