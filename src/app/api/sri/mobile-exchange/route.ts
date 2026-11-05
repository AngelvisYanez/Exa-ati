import { NextResponse } from 'next/server';
import jwt from 'jsonwebtoken';
import { config } from '@/services/sri-api/config';
import { consumeMobileCode } from '@/services/sri-api/mobile-code-store';

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));
    const code = typeof body.code === 'string' ? body.code.trim() : '';

    if (!code) {
      return NextResponse.json({ message: 'El código es obligatorio' }, { status: 400 });
    }

    const entry = consumeMobileCode(code);
    if (!entry) {
      return NextResponse.json(
        { message: 'Código inválido o expirado. Genera un nuevo QR desde el escritorio.' },
        { status: 410 }
      );
    }

    const accessToken = jwt.sign(
      {
        sub: entry.userId,
        email: entry.email,
        rol: entry.rol,
        tenantId: entry.tenantId,
      },
      config.jwt.secret,
      { expiresIn: '30d' }
    );

    return NextResponse.json({
      success: true,
      accessToken,
      token: accessToken,
      message: 'Sesión móvil vinculada correctamente',
    });
  } catch (error: any) {
    console.error('[Mobile Exchange Error]', error);
    return NextResponse.json(
      { message: error.message || 'Error al canjear el código móvil' },
      { status: 500 }
    );
  }
}
