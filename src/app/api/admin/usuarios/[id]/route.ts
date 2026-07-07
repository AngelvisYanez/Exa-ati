import { NextResponse } from 'next/server';
import { verifyAuth, requireTenantId } from '@/lib/sri-api/auth-helper';
import { db } from '@/lib/sri-api/db';
import bcrypt from 'bcrypt';

function requireAdminOrSuperadmin(user: { rol: string }) {
  if (user.rol !== 'ADMIN' && user.rol !== 'SUPERADMIN') {
    throw new Error('Acceso denegado: se requiere rol ADMIN o SUPERADMIN');
  }
}

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await verifyAuth(req);
    requireAdminOrSuperadmin(user);
    const { id } = await params;

    const usuario = await db.queryOne<any>(
      `SELECT u.*, t.nombre as tenant_nombre
       FROM usuarios u
       LEFT JOIN tenants t ON t.id = u.tenant_id
       WHERE u.id = $1`,
      [id]
    );
    if (!usuario) {
      return NextResponse.json({ message: 'Usuario no encontrado' }, { status: 404 });
    }

    if (user.rol === 'ADMIN') {
      const tenantId = requireTenantId(user);
      if (usuario.tenant_id !== tenantId) {
        return NextResponse.json({ message: 'Acceso denegado' }, { status: 403 });
      }
    }

    return NextResponse.json({
      data: {
        id: usuario.id,
        email: usuario.email,
        nombre: usuario.nombre,
        rol: usuario.rol,
        tenantId: usuario.tenant_id,
        tenantNombre: usuario.tenant_nombre,
        ruc: usuario.ruc,
        activo: Boolean(usuario.activo),
        createdAt: usuario.created_at,
        updatedAt: usuario.updated_at,
      },
    });
  } catch (error: any) {
    return NextResponse.json(
      { message: error.message || 'Error interno' },
      { status: error.message?.startsWith('No autorizado') ? 401 : error.message?.includes('Acceso denegado') ? 403 : 500 }
    );
  }
}

export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await verifyAuth(req);
    requireAdminOrSuperadmin(user);
    const { id } = await params;
    const body = await req.json();
    const { email, nombre, password, rol, tenantId, ruc, activo } = body;

    const existing = await db.queryOne<any>(
      'SELECT * FROM usuarios WHERE id = $1',
      [id]
    );
    if (!existing) {
      return NextResponse.json({ message: 'Usuario no encontrado' }, { status: 404 });
    }

    if (user.rol === 'ADMIN') {
      const myTenantId = requireTenantId(user);
      if (existing.tenant_id !== myTenantId) {
        return NextResponse.json({ message: 'Acceso denegado' }, { status: 403 });
      }
      if (existing.rol === 'SUPERADMIN' || rol === 'SUPERADMIN') {
        return NextResponse.json({ message: 'No puedes modificar usuarios SUPERADMIN' }, { status: 403 });
      }
    }

    if (email && email !== existing.email) {
      const dup = await db.queryOne('SELECT id FROM usuarios WHERE email = $1 AND id != $2', [email, id]);
      if (dup) {
        return NextResponse.json({ message: 'Ya existe otro usuario con ese email' }, { status: 409 });
      }
    }

    const fields: string[] = [];
    const values: any[] = [];

    if (email !== undefined) { fields.push('email = $' + (fields.length + 1)); values.push(email); }
    if (nombre !== undefined) { fields.push('nombre = $' + (fields.length + 1)); values.push(nombre); }
    if (rol !== undefined) { fields.push('rol = $' + (fields.length + 1)); values.push(rol); }
    if (tenantId !== undefined) { fields.push('tenant_id = $' + (fields.length + 1)); values.push(tenantId || null); }
    if (ruc !== undefined) { fields.push('ruc = $' + (fields.length + 1)); values.push(ruc || null); }
    if (activo !== undefined) { fields.push('activo = $' + (fields.length + 1)); values.push(activo); }

    if (password) {
      const passwordHash = await bcrypt.hash(password, 12);
      fields.push('password_hash = $' + (fields.length + 1));
      values.push(passwordHash);
    }

    if (fields.length === 0) {
      return NextResponse.json({ message: 'No hay campos para actualizar' }, { status: 400 });
    }

    fields.push('updated_at = NOW()');

    const result = await db.queryOne<any>(
      `UPDATE usuarios SET ${fields.join(', ')} WHERE id = $${fields.length + 1} RETURNING *`,
      [...values, id]
    );

    return NextResponse.json({
      data: {
        id: result.id,
        email: result.email,
        nombre: result.nombre,
        rol: result.rol,
        tenantId: result.tenant_id,
        ruc: result.ruc,
        activo: Boolean(result.activo),
        updatedAt: result.updated_at,
      },
    });
  } catch (error: any) {
    return NextResponse.json(
      { message: error.message || 'Error interno' },
      { status: error.message?.startsWith('No autorizado') ? 401 : error.message?.includes('Acceso denegado') ? 403 : 500 }
    );
  }
}

export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await verifyAuth(req);
    requireAdminOrSuperadmin(user);
    const { id } = await params;

    const existing = await db.queryOne<any>('SELECT * FROM usuarios WHERE id = $1', [id]);
    if (!existing) {
      return NextResponse.json({ message: 'Usuario no encontrado' }, { status: 404 });
    }

    if (existing.id === user.sub) {
      return NextResponse.json({ message: 'No puedes eliminarte a ti mismo' }, { status: 400 });
    }

    if (user.rol === 'ADMIN') {
      const myTenantId = requireTenantId(user);
      if (existing.tenant_id !== myTenantId) {
        return NextResponse.json({ message: 'Acceso denegado' }, { status: 403 });
      }
      if (existing.rol === 'SUPERADMIN' || existing.rol === 'ADMIN') {
        return NextResponse.json({ message: 'No puedes eliminar otros administradores' }, { status: 403 });
      }
    }

    await db.query('DELETE FROM usuarios WHERE id = $1', [id]);

    return NextResponse.json({ message: 'Usuario eliminado correctamente' });
  } catch (error: any) {
    return NextResponse.json(
      { message: error.message || 'Error interno' },
      { status: error.message?.startsWith('No autorizado') ? 401 : error.message?.includes('Acceso denegado') ? 403 : 500 }
    );
  }
}
