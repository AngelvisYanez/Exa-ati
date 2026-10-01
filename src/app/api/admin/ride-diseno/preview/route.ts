import { NextResponse } from 'next/server'
import { verifyAuth } from '@/services/sri-api/auth-helper'
import { rideDisenoSchema } from '@/services/sri-api/ride-diseno'
import { facturaRideDeMuestra, renderRidePdf } from '@/services/sri-api/ride-pdf'

export async function POST(req: Request) {
  try {
    const user = await verifyAuth(req)
    if (user.rol !== 'SUPERADMIN') {
      return NextResponse.json(
        { message: 'Acceso denegado: solo el superadmin puede configurar el diseño del RIDE' },
        { status: 403 }
      )
    }
    const parsed = rideDisenoSchema.safeParse(await req.json())
    if (!parsed.success) {
      return NextResponse.json(
        { message: parsed.error.issues[0]?.message || 'Datos inválidos' },
        { status: 400 }
      )
    }
    const pdf = await renderRidePdf(facturaRideDeMuestra(), {
      ...parsed.data,
      descripcion: parsed.data.descripcion ?? null,
      colorHex: parsed.data.colorHex ?? null,
      esPredeterminado: false,
      esSistema: false,
    })
    return new NextResponse(new Uint8Array(pdf), {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': 'inline; filename="ride-preview.pdf"',
        'Cache-Control': 'no-store',
      },
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Error interno'
    const status = message.startsWith('No autorizado') ? 401 : 500
    return NextResponse.json({ message }, { status })
  }
}
