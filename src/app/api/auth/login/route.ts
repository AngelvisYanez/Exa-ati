import { NextResponse } from 'next/server';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { db } from '@/lib/sri-api/db';
import { config } from '@/lib/sri-api/config';

export async function POST(req: Request) {
  try {
    const { email, password } = await req.json();

    if (!email || !password) {
      return NextResponse.json(
        { message: 'Email y contraseña son obligatorios' },
        { status: 400 }
      );
    }

    // Buscar el usuario por email o por el RUC de su emisor vinculado
    const users = await db.queryAll<any>(
      `SELECT u.id, u.email, u.password_hash, u.rol, u.tenant_id, u.activo
       FROM usuarios u
       LEFT JOIN emisores e ON u.tenant_id = e.tenant_id AND e.activo = 1
       WHERE u.email = $1 OR e.ruc = $2
       ORDER BY (u.email = $3) DESC, u.rol ASC`,
      [email, email, email]
    );

    if (!users || users.length === 0) {
      return NextResponse.json(
        { message: 'Credenciales inválidas' },
        { status: 401 }
      );
    }

    let user = null;
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
      return NextResponse.json(
        { message: 'Credenciales inválidas' },
        { status: 401 }
      );
    }

    // Actualizar la última fecha de conexión
    await db.query(
      `UPDATE usuarios SET last_login = NOW() WHERE id = $1`,
      [user.id]
    );

    // Generar tokens
    const payload = {
      sub: user.id,
      email: user.email,
      rol: user.rol,
      tenantId: user.tenant_id,
      type: 'access',
    };

    const accessToken = jwt.sign(payload, config.jwt.secret, {
      expiresIn: config.jwt.expiration as any,
    });

    const decoded = jwt.decode(accessToken) as any;
    const exp = decoded?.exp || Math.floor(Date.now() / 1000) + 28800;
    const expiresIn = Math.max(0, exp - Math.floor(Date.now() / 1000));
    const expiresAt = new Date(exp * 1000).toISOString();

    const refreshPayload = {
      ...payload,
      type: 'refresh',
    };
    const refreshToken = jwt.sign(refreshPayload, config.jwt.secret, {
      expiresIn: '7d',
    });

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
      },
    });

    response.cookies.set('sri_access_token', accessToken, {
      path: '/',
      maxAge: expiresIn > 0 ? expiresIn : 60 * 60 * 24,
      sameSite: 'lax',
      httpOnly: false,
    });

    return response;
  } catch (error: any) {
    console.error('[Login Error]', error);
    return NextResponse.json(
      { message: `Error en el servidor: ${error.message}` },
      { status: 500 }
    );
  }
}
