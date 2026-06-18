import { NextResponse } from 'next/server';
import bcrypt from 'bcrypt';
import { verifyAuth, requireTenantId } from '@/lib/sri-api/auth-helper';
import { db } from '@/lib/sri-api/db';

export async function PUT(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await verifyAuth(req);
    if (user.rol !== 'ADMIN' && user.rol !== 'SUPERADMIN') {
      return NextResponse.json({ message: 'No autorizado' }, { status: 403 });
    }

    const tenantId = requireTenantId(user);
    const { id } = await params;
    const { email, password, nombre, ruc, activo, rol } = await req.json();

    // Validar que el cliente exista y pertenezca al mismo tenant
    const cliente = await db.queryOne<{ id: string; tenant_id: string }>(
      'SELECT id, tenant_id FROM usuarios WHERE id = $1 AND rol != \'SUPERADMIN\'',
      [id]
    );

    if (!cliente) {
      return NextResponse.json({ message: 'Cliente no encontrado' }, { status: 404 });
    }

    if (cliente.tenant_id !== tenantId && user.rol !== 'SUPERADMIN') {
      return NextResponse.json({ message: 'No tienes permisos sobre este cliente' }, { status: 403 });
    }

    const updates: Record<string, any> = {};
    const paramsList: any[] = [];
    let paramIndex = 1;

    if (email !== undefined) {
      // Verificar si el email ya existe para otro usuario
      const existing = await db.queryOne<{ id: string }>(
        'SELECT id FROM usuarios WHERE email = $1 AND id != $2',
        [email, id]
      );
      if (existing) {
        return NextResponse.json({ message: 'Este correo ya está en uso' }, { status: 409 });
      }
      updates.email = email;
    }

    if (nombre !== undefined) updates.nombre = nombre;
    if (ruc !== undefined) updates.ruc = ruc || null;
    if (activo !== undefined) updates.activo = Boolean(activo);
    if (rol !== undefined && (rol === 'USER' || rol === 'ADMIN')) updates.rol = rol;

    if (password) {
      updates.password_hash = await bcrypt.hash(password, 12);
    }

    if (Object.keys(updates).length > 0) {
      updates.updated_at = new Date();
      await db.update('usuarios', updates, 'id = $1', [id]);
    }

    return NextResponse.json({
      success: true,
      message: 'Cliente actualizado correctamente',
    });
  } catch (error: any) {
    console.error('[Put Cliente Error]', error);
    return NextResponse.json(
      { message: error.message || 'Error al actualizar cliente' },
      { status: 500 }
    );
  }
}

export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await verifyAuth(req);
    if (user.rol !== 'ADMIN' && user.rol !== 'SUPERADMIN') {
      return NextResponse.json({ message: 'No autorizado' }, { status: 403 });
    }

    const tenantId = requireTenantId(user);
    const { id } = await params;

    // Validar que el cliente exista y pertenezca al mismo tenant
    const cliente = await db.queryOne<{ id: string; tenant_id: string }>(
      'SELECT id, tenant_id FROM usuarios WHERE id = $1 AND rol != \'SUPERADMIN\'',
      [id]
    );

    if (!cliente) {
      return NextResponse.json({ message: 'Cliente no encontrado' }, { status: 404 });
    }

    if (cliente.tenant_id !== tenantId && user.rol !== 'SUPERADMIN') {
      return NextResponse.json({ message: 'No tienes permisos sobre este cliente' }, { status: 403 });
    }

    // Eliminar físicamente el usuario
    await db.query('DELETE FROM usuarios WHERE id = $1', [id]);

    return NextResponse.json({
      success: true,
      message: 'Cliente eliminado correctamente',
    });
  } catch (error: any) {
    console.error('[Delete Cliente Error]', error);
    return NextResponse.json(
      { message: error.message || 'Error al eliminar cliente' },
      { status: 500 }
    );
  }
}
