import { NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { db } from '@/services/sri-api/db';
import { config } from '@/services/sri-api/config';
import { loginSchema } from '@/lib/schemas/auth';
import { parseBody } from '@/lib/schemas/parse-body';
import { setAuthCookies, apiError } from '@/lib/auth-cookies';
import { rateLimit, clientKey } from '@/lib/rate-limit';
import { getModulosForRol } from '@/services/sri-api/rbac';

export async function POST(req: Request) {
  const limited = rateLimit(clientKey(req, 'login'), { limit: 15, windowMs: 60_000 });
  if (!limited.ok) {
    return apiError('Demasiados intentos. Intenta más tarde.', 429, {
      retryAfter: limited.retryAfterSec,
    });
  }

  try {
    const parsed = await parseBody(req, loginSchema);
    if ('error' in parsed) return parsed.error;
    const { email, password } = parsed.data;

    const users = await db.queryAll<{
      id: string;
      email: string;
      password_hash: string;
      rol: string;
      tenant_id: string | null;
      activo: boolean;
      ruc: string | null;
    }>(
      `SELECT u.id, u.email, u.password_hash, u.rol, u.tenant_id, u.activo, u.ruc
       FROM usuarios u
       WHERE u.email = $1 OR u.ruc = $2 OR (u.rol = 'ADMIN' AND EXISTS (
         SELECT 1 FROM emisores e 
         WHERE e.tenant_id = u.tenant_id AND e.ruc = $2 AND e.activo = true
       ))
       ORDER BY CASE WHEN u.email = $3 THEN 1 ELSE 0 END DESC, u.rol ASC`,
      [email, email, email]
    );

    if (!users || users.length === 0) {
      return apiError('Credenciales inválidas', 401);
    }

    let user: (typeof users)[number] | null = null;
    for (const u of users) {
      if (u.activo) {
        const passwordValid = await bcrypt.compare(password, u.password_hash);
        if (passwordValid) {
          user = u;
          break;
        }
      }
    }

    if (!user) {
      return apiError('Credenciales inválidas', 401);
    }

    await db.query(
      `UPDATE usuarios SET updated_at = NOW() WHERE id = $1`,
      [user.id]
    );

    const payload = {
      sub: user.id,
      email: user.email,
      rol: user.rol,
      tenantId: user.tenant_id,
      ruc: user.ruc,
      type: 'access',
    };

    const accessToken = jwt.sign(payload, config.jwt.secret, {
      expiresIn: config.jwt.expiration as jwt.SignOptions['expiresIn'],
    });

    const decoded = jwt.decode(accessToken) as { exp?: number } | null;
    const exp = decoded?.exp || Math.floor(Date.now() / 1000) + 28800;
    const expiresIn = Math.max(0, exp - Math.floor(Date.now() / 1000));
    const expiresAt = new Date(exp * 1000).toISOString();

    const refreshToken = jwt.sign(
      { ...payload, type: 'refresh' },
      config.jwt.secret,
      { expiresIn: '7d' }
    );

    const modulos = await getModulosForRol(user.rol);

    const response = NextResponse.json({
      accessToken,
      refreshToken,
      tokenType: 'Bearer',
      expiresIn,
      expiresAt,
      user: {
        id: user.id,
        email: user.email,
        rol: user.rol,
        tenantId: user.tenant_id,
        ruc: user.ruc,
        modulos,
      },
    });

    setAuthCookies(response, {
      accessToken,
      refreshToken,
      maxAgeSec: expiresIn > 0 ? expiresIn : 60 * 60 * 24,
    });

    return response;
  } catch (error: unknown) {
    console.error('[Login Error]', error);
    const message = error instanceof Error ? error.message : 'Error desconocido';
    return apiError(`Error en el servidor: ${message}`, 500);
  }
}
