import { NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { db } from '@/services/sri-api/db';
import { registerApiSchema } from '@/lib/schemas/auth';
import { parseBody } from '@/lib/schemas/parse-body';
import { apiError } from '@/lib/auth-cookies';
import { rateLimit, clientKey } from '@/lib/rate-limit';

export async function POST(req: Request) {
  const limited = rateLimit(clientKey(req, 'register'), { limit: 10, windowMs: 60_000 });
  if (!limited.ok) {
    return apiError('Demasiados intentos. Intenta más tarde.', 429, {
      retryAfter: limited.retryAfterSec,
    });
  }

  try {
    const parsed = await parseBody(req, registerApiSchema);
    if ('error' in parsed) return parsed.error;
    const { email, password, tenantId, nombre } = parsed.data;
    // Registro público siempre USER (nunca ADMIN)
    const rol = 'USER';

    const existing = await db.queryOne<{ id: string }>(
      'SELECT id FROM usuarios WHERE email = $1',
      [email]
    );

    if (existing) {
      return apiError(`Ya existe un usuario con el email ${email}`, 409);
    }

    let assignedTenantId = tenantId || null;

    if (assignedTenantId) {
      const tenant = await db.queryOne<{ id: string }>(
        `SELECT id FROM tenants WHERE id = $1 AND activo = true`,
        [assignedTenantId]
      );
      if (!tenant) {
        return apiError(`Tenant con ID ${assignedTenantId} no encontrado o inactivo`, 404);
      }
    } else {
      const tenant = await db.insert<{ id: string }>('tenants', {
        nombre: nombre || email.split('@')[0],
        activo: true,
      }, 'id');
      assignedTenantId = tenant?.id || null;
    }

    const passwordHash = await bcrypt.hash(password, 12);

    const user = await db.insert<{
      id: string;
      email: string;
      rol: string;
      tenant_id: string | null;
    }>('usuarios', {
      email,
      password_hash: passwordHash,
      nombre: nombre || null,
      rol: rol || 'USER',
      tenant_id: assignedTenantId,
      activo: true,
    }, 'id, email, rol, tenant_id');

    if (!user) {
      return apiError('No se pudo crear el usuario', 500);
    }

    return NextResponse.json({
      success: true,
      data: {
        id: user.id,
        email: user.email,
        rol: user.rol,
        tenantId: user.tenant_id,
      },
    }, { status: 201 });
  } catch (error: unknown) {
    console.error('[Register Error]', error);
    const message = error instanceof Error ? error.message : 'Error desconocido';
    return apiError(`Error en el servidor: ${message}`, 500);
  }
}
