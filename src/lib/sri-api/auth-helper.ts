import { NextRequest } from 'next/server';
import jwt from 'jsonwebtoken';
import { config } from './config';
import { db } from './db';

export interface JwtPayload {
  sub: string;
  email: string;
  rol: string;
  tenantId: string | null;
  type?: string;
}

export function requireTenantId(user: JwtPayload): string {
  if (!user.tenantId) {
    throw new Error('Acceso denegado: El usuario no tiene tenant asignado');
  }
  return user.tenantId;
}

export async function verifyAuth(req: Request | NextRequest): Promise<JwtPayload> {
  const authHeader = req.headers.get('authorization');
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    throw new Error('No autorizado: Token ausente o mal formado');
  }

  const token = authHeader.substring(7);

  try {
    const payload = jwt.verify(token, config.jwt.secret) as JwtPayload;

    if (payload.type === 'refresh') {
      throw new Error('No autorizado: Token de refresco no permitido para acceder a recursos');
    }

    const user = await db.queryOne<{ id: string; activo: boolean }>(
      'SELECT id, activo FROM usuarios WHERE id = $1',
      [payload.sub]
    );

    if (!user) {
      throw new Error('No autorizado: Usuario no encontrado');
    }

    if (!user.activo) {
      throw new Error('No autorizado: Usuario inactivo');
    }

    return payload;
  } catch (error: any) {
    throw new Error(`No autorizado: ${error.message}`);
  }
}
