import { NextResponse } from 'next/server';
import { verifyAuth } from '@/lib/sri-api/auth-helper';
import { db } from '@/lib/sri-api/db';

function requireSuperadmin(user: { rol: string }) {
  if (user.rol !== 'SUPERADMIN') {
    throw new Error('Acceso denegado: se requiere rol SUPERADMIN');
  }
}

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await verifyAuth(req);
    requireSuperadmin(user);
    const { id } = await params;

    const tenant = await db.queryOne<any>(
      `SELECT t.*,
              (SELECT COUNT(*) FROM usuarios WHERE tenant_id = t.id) as usuarios_count,
              (SELECT COUNT(*) FROM emisores WHERE tenant_id = t.id) as emisores_count,
              (SELECT COUNT(*) FROM comprobantes WHERE tenant_id = t.id) as comprobantes_count
       FROM tenants t WHERE t.id = $1`,
      [id]
    );
    if (!tenant) {
      return NextResponse.json({ message: 'Tenant no encontrado' }, { status: 404 });
    }

    return NextResponse.json({
      data: {
        id: tenant.id,
        nombre: tenant.nombre,
        ruc: tenant.ruc,
        activo: Boolean(tenant.activo),
        usuariosCount: parseInt(tenant.usuarios_count || '0'),
        emisoresCount: parseInt(tenant.emisores_count || '0'),
        comprobantesCount: parseInt(tenant.comprobantes_count || '0'),
        createdAt: tenant.created_at,
        updatedAt: tenant.updated_at,
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
    requireSuperadmin(user);
    const { id } = await params;
    const body = await req.json();
    const { nombre, ruc, activo } = body;

    const existing = await db.queryOne('SELECT id FROM tenants WHERE id = $1', [id]);
    if (!existing) {
      return NextResponse.json({ message: 'Tenant no encontrado' }, { status: 404 });
    }

    if (ruc) {
      const dup = await db.queryOne('SELECT id FROM tenants WHERE ruc = $1 AND id != $2', [ruc, id]);
      if (dup) {
        return NextResponse.json({ message: 'Ya existe otro tenant con ese RUC' }, { status: 409 });
      }
    }

    const fields: string[] = [];
    const values: any[] = [];

    if (nombre !== undefined) { fields.push('nombre = $' + (fields.length + 1)); values.push(nombre); }
    if (ruc !== undefined) { fields.push('ruc = $' + (fields.length + 1)); values.push(ruc || null); }
    if (activo !== undefined) { fields.push('activo = $' + (fields.length + 1)); values.push(activo); }

    if (fields.length === 0) {
      return NextResponse.json({ message: 'No hay campos para actualizar' }, { status: 400 });
    }

    fields.push('updated_at = NOW()');

    const result = await db.queryOne<any>(
      `UPDATE tenants SET ${fields.join(', ')} WHERE id = $${fields.length + 1} RETURNING *`,
      [...values, id]
    );

    return NextResponse.json({
      data: {
        id: result.id,
        nombre: result.nombre,
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
    requireSuperadmin(user);
    const { id } = await params;

    const existing = await db.queryOne('SELECT id, nombre FROM tenants WHERE id = $1', [id]);
    if (!existing) {
      return NextResponse.json({ message: 'Tenant no encontrado' }, { status: 404 });
    }

    const userCount = await db.queryOne<{ count: string }>(
      'SELECT COUNT(*) as count FROM usuarios WHERE tenant_id = $1',
      [id]
    );
    if (parseInt(userCount?.count || '0') > 0) {
      return NextResponse.json(
        { message: `No se puede eliminar "${existing.nombre}": tiene ${userCount?.count} usuarios asociados. Desactívalo en su lugar.` },
        { status: 409 }
      );
    }

    await db.query('DELETE FROM tenants WHERE id = $1', [id]);

    return NextResponse.json({ message: 'Tenant eliminado correctamente' });
  } catch (error: any) {
    return NextResponse.json(
      { message: error.message || 'Error interno' },
      { status: error.message?.startsWith('No autorizado') ? 401 : error.message?.includes('Acceso denegado') ? 403 : 500 }
    );
  }
}
