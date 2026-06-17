import { NextResponse } from 'next/server';
import bcrypt from 'bcrypt';
import { db } from '@/lib/sri-api/db';

export async function POST(req: Request) {
  try {
    const { email, password, rol, tenantId, nombre } = await req.json();

    if (!email || !password) {
      return NextResponse.json(
        { message: 'Email y contraseña son obligatorios' },
        { status: 400 }
      );
    }

    const existing = await db.queryOne<{ id: string }>(
      'SELECT id FROM usuarios WHERE email = $1',
      [email]
    );

    if (existing) {
      return NextResponse.json(
        { message: `Ya existe un usuario con el email ${email}` },
        { status: 409 }
      );
    }

    let assignedTenantId = tenantId || null;

    if (assignedTenantId) {
      const tenant = await db.queryOne<{ id: string }>(
        `SELECT id FROM tenants WHERE id = $1 AND activo = true`,
        [assignedTenantId]
      );
      if (!tenant) {
        return NextResponse.json(
          { message: `Tenant con ID ${assignedTenantId} no encontrado o inactivo` },
          { status: 404 }
        );
      }
    } else {
      const tenant = await db.insert<any>('tenants', {
        nombre: nombre || email.split('@')[0],
        activo: true,
      }, 'id');
      assignedTenantId = tenant?.id || null;
    }

    const passwordHash = await bcrypt.hash(password, 12);

    const user = await db.insert<any>('usuarios', {
      email,
      password_hash: passwordHash,
      nombre: nombre || null,
      rol: rol || 'USER',
      tenant_id: assignedTenantId,
      activo: true,
    }, 'id, email, rol, tenant_id');

    return NextResponse.json({
      success: true,
      data: {
        id: user.id,
        email: user.email,
        rol: user.rol,
        tenantId: user.tenant_id,
      },
    }, { status: 201 });
  } catch (error: any) {
    console.error('[Register Error]', error);
    return NextResponse.json(
      { message: `Error en el servidor: ${error.message}` },
      { status: 500 }
    );
  }
}
