import { NextResponse } from 'next/server';
import { verifyAuth } from '@/lib/sri-api/auth-helper';
import { db } from '@/lib/sri-api/db';

function requireSuperadmin(user: { rol: string }) {
  if (user.rol !== 'SUPERADMIN') {
    throw new Error('Acceso denegado: se requiere rol SUPERADMIN');
  }
}

export async function GET(req: Request) {
  try {
    const user = await verifyAuth(req);
    requireSuperadmin(user);

    const { searchParams } = new URL(req.url);
    const search = searchParams.get('q') || '';
    const page = Math.max(1, parseInt(searchParams.get('page') || '1'));
    const pageSize = Math.min(100, Math.max(1, parseInt(searchParams.get('pageSize') || '20')));

    const conditions: string[] = [];
    const params: any[] = [];

    if (search) {
      conditions.push('(t.nombre ILIKE $' + (params.length + 1) + ' OR COALESCE(t.ruc, \'\') ILIKE $' + (params.length + 1) + ')');
      params.push(`%${search}%`);
    }

    const whereClause = conditions.length > 0 ? 'WHERE ' + conditions.join(' AND ') : '';
    const offset = (page - 1) * pageSize;

    const countResult = await db.queryOne<{ count: string }>(
      `SELECT COUNT(*) as count FROM tenants t ${whereClause}`,
      params
    );
    const total = parseInt(countResult?.count || '0');

    const tenants = await db.queryAll<any>(
      `SELECT t.id, t.nombre, t.ruc, t.activo, t.created_at, t.updated_at,
              (SELECT COUNT(*) FROM usuarios WHERE tenant_id = t.id) as usuarios_count,
              (SELECT COUNT(*) FROM emisores WHERE tenant_id = t.id) as emisores_count
       FROM tenants t
       ${whereClause}
       ORDER BY t.created_at DESC
       LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
      [...params, pageSize, offset]
    );

    return NextResponse.json({
      data: tenants.map((t: any) => ({
        id: t.id,
        nombre: t.nombre,
        ruc: t.ruc,
        activo: Boolean(t.activo),
        usuariosCount: parseInt(t.usuarios_count || '0'),
        emisoresCount: parseInt(t.emisores_count || '0'),
        createdAt: t.created_at,
        updatedAt: t.updated_at,
      })),
      total,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize),
    });
  } catch (error: any) {
    console.error('[Admin Tenants GET]', error);
    return NextResponse.json(
      { message: error.message || 'Error interno' },
      { status: error.message?.startsWith('No autorizado') ? 401 : error.message?.includes('Acceso denegado') ? 403 : 500 }
    );
  }
}

export async function POST(req: Request) {
  try {
    const user = await verifyAuth(req);
    requireSuperadmin(user);

    const body = await req.json();
    const { nombre, ruc } = body;

    if (!nombre) {
      return NextResponse.json({ message: 'El nombre es obligatorio' }, { status: 400 });
    }

    if (ruc) {
      const dup = await db.queryOne('SELECT id FROM tenants WHERE ruc = $1', [ruc]);
      if (dup) {
        return NextResponse.json({ message: 'Ya existe un tenant con ese RUC' }, { status: 409 });
      }
    }

    const result = await db.queryOne<any>(
      `INSERT INTO tenants (nombre, ruc, activo, created_at, updated_at)
       VALUES ($1, $2, true, NOW(), NOW())
       RETURNING *`,
      [nombre, ruc || null]
    );

    return NextResponse.json({
      data: {
        id: result.id,
        nombre: result.nombre,
        ruc: result.ruc,
        activo: Boolean(result.activo),
        createdAt: result.created_at,
      },
    }, { status: 201 });
  } catch (error: any) {
    console.error('[Admin Tenants POST]', error);
    return NextResponse.json(
      { message: error.message || 'Error interno' },
      { status: error.message?.startsWith('No autorizado') ? 401 : error.message?.includes('Acceso denegado') ? 403 : 500 }
    );
  }
}
