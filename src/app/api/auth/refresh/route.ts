import { NextResponse } from 'next/server';
import jwt from 'jsonwebtoken';
import { config } from '@/lib/sri-api/config';

export async function POST(req: Request) {
  try {
    const { refreshToken } = await req.json();

    if (!refreshToken) {
      return NextResponse.json(
        { message: 'Refresh token es obligatorio' },
        { status: 400 }
      );
    }

    let payload: any;
    try {
      payload = jwt.verify(refreshToken, config.jwt.secret);
    } catch {
      return NextResponse.json(
        { message: 'Refresh token inválido o expirado' },
        { status: 401 }
      );
    }

    if (payload.type !== 'refresh') {
      return NextResponse.json(
        { message: 'Token no es de tipo refresh' },
        { status: 401 }
      );
    }

    const accessPayload = {
      sub: payload.sub,
      email: payload.email,
      rol: payload.rol,
      tenantId: payload.tenantId,
      ruc: payload.ruc,
      type: 'access',
    };

    const accessToken = jwt.sign(accessPayload, config.jwt.secret, {
      expiresIn: config.jwt.expiration as any,
    });

    const decoded = jwt.decode(accessToken) as any;
    const exp = decoded?.exp || Math.floor(Date.now() / 1000) + 28800;
    const expiresIn = Math.max(0, exp - Math.floor(Date.now() / 1000));
    const expiresAt = new Date(exp * 1000).toISOString();

    const response = NextResponse.json({
      accessToken,
      tokenType: 'Bearer',
      expiresIn,
      expiresAt,
    });

    response.cookies.set('sri_access_token', accessToken, {
      path: '/',
      maxAge: expiresIn > 0 ? expiresIn : 60 * 60 * 24,
      sameSite: 'lax',
      httpOnly: false,
    });

    return response;
  } catch (error: any) {
    console.error('[Refresh Error]', error);
    return NextResponse.json(
      { message: `Error en el servidor: ${error.message}` },
      { status: 500 }
    );
  }
}
