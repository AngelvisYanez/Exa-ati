import { NextResponse } from 'next/server';
import jwt from 'jsonwebtoken';
import { config } from '@/services/sri-api/config';
import { setAuthCookies, apiError, REFRESH_COOKIE } from '@/lib/auth-cookies';

export async function POST(req: Request) {
  try {
    let refreshToken: string | undefined;
    try {
      const body = await req.json();
      refreshToken = body.refreshToken;
    } catch {
      refreshToken = undefined;
    }

    if (!refreshToken) {
      const cookieHeader = req.headers.get('cookie') || '';
      const match = cookieHeader
        .split(';')
        .map((c) => c.trim())
        .find((c) => c.startsWith(`${REFRESH_COOKIE}=`));
      if (match) {
        refreshToken = decodeURIComponent(match.slice(REFRESH_COOKIE.length + 1));
      }
    }

    if (!refreshToken) {
      return apiError('Refresh token es obligatorio', 400);
    }

    let payload: {
      sub: string;
      email: string;
      rol: string;
      tenantId: string | null;
      ruc?: string;
      type?: string;
    };
    try {
      payload = jwt.verify(refreshToken, config.jwt.secret) as typeof payload;
    } catch {
      return apiError('Refresh token inválido o expirado', 401);
    }

    if (payload.type !== 'refresh') {
      return apiError('Token no es de tipo refresh', 401);
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
      expiresIn: config.jwt.expiration as jwt.SignOptions['expiresIn'],
    });

    const decoded = jwt.decode(accessToken) as { exp?: number } | null;
    const exp = decoded?.exp || Math.floor(Date.now() / 1000) + 28800;
    const expiresIn = Math.max(0, exp - Math.floor(Date.now() / 1000));
    const expiresAt = new Date(exp * 1000).toISOString();

    const response = NextResponse.json({
      accessToken,
      tokenType: 'Bearer',
      expiresIn,
      expiresAt,
    });

    setAuthCookies(response, {
      accessToken,
      refreshToken,
      maxAgeSec: expiresIn > 0 ? expiresIn : 60 * 60 * 24,
    });

    return response;
  } catch (error: unknown) {
    console.error('[Refresh Error]', error);
    const message = error instanceof Error ? error.message : 'Error desconocido';
    return apiError(`Error en el servidor: ${message}`, 500);
  }
}
