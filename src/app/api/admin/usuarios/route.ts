import { NextResponse } from 'next/server';
import { verifyAuth, requireTenantId } from '@/lib/sri-api/auth-helper';
import { db } from '@/lib/sri-api/db';
import bcrypt from 'bcrypt';

export async function GET(req: Request) {
  try {
    const user = await verifyAuth(req);
    const { searchParams } = new URL(req.url);
    const search = searchParams.get('q') || '';
    const rol = searchParams.get('rol') || '';
    const activo = searchParams.get('activo');
    const page = Math.max(1, parseInt(searchParams.get('page') || '1'));
    const pageSize = Math.min(100, Math.max(1, parseInt(searchParams.get('pageSize') || '20')));

    const conditions: string[] = [];
    const params: any[] = [];

    if (user.rol === 'ADMIN') {
      const tenantId = requireTenantId(user);
      conditions.push('u.tenant_id = $' + (params.length + 1));
      params.push(tenantId);
    }

    if (search) {
      const idx = params.length + 1;
      conditions.push(`(u.email ILIKE $${idx} OR COALESCE(u.nombre, '') ILIKE $${idx})`);
      params.push(`%${search}%`);
    }

    if (rol) {
      conditions.push('u.rol = $' + (params.length + 1));
      params.push(rol);
    }

    if (activo === 'true' || activo === 'false') {
      conditions.push('u.activo = $' + (params.length + 1));
      params.push(activo === 'true');
    }

    const whereClause = conditions.length > 0 ? 'WHERE ' + conditions.join(' AND ') : '';
    const offset = (page - 1) * pageSize;

    const countResult = await db.queryOne<{ count: string }>(
      `SELECT COUNT(*) as count FROM usuarios u ${whereClause}`,
      params
    );
    const total = parseInt(countResult?.count || '0');

    const usuarios = await db.queryAll<any>(
      `SELECT u.id, u.email, u.nombre, u.rol, u.tenant_id, u.ruc, u.activo, u.created_at, u.updated_at,
              t.nombre as tenant_nombre
       FROM usuarios u
       LEFT JOIN tenants t ON t.id = u.tenant_id
       ${whereClause}
       ORDER BY u.created_at DESC
       LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
      [...params, pageSize, offset]
    );

    return NextResponse.json({
      data: usuarios.map((u: any) => ({
        id: u.id,
        email: u.email,
        nombre: u.nombre,
        rol: u.rol,
        tenantId: u.tenant_id,
        tenantNombre: u.tenant_nombre,
        ruc: u.ruc,
        activo: Boolean(u.activo),
        createdAt: u.created_at,
        updatedAt: u.updated_at,
      })),
      total,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize),
    });
  } catch (error: any) {
    console.error('[Admin Usuarios GET]', error);
    return NextResponse.json(
      { message: error.message || 'Error interno' },
      { status: error.message?.startsWith('No autorizado') ? 401 : 500 }
    );
  }
}

export async function POST(req: Request) {
  try {
    const user = await verifyAuth(req);
    const body = await req.json();
    const { email, nombre, password, rol, tenantId, ruc, activo } = body;

    if (!email || !password || !nombre) {
      return NextResponse.json(
        { message: 'Email, nombre y password son obligatorios' },
        { status: 400 }
      );
    }

    if (user.rol === 'ADMIN') {
      const myTenantId = requireTenantId(user);
      if (rol === 'SUPERADMIN') {
        return NextResponse.json(
          { message: 'No puedes crear usuarios SUPERADMIN' },
          { status: 403 }
        );
      }
      if (tenantId && tenantId !== myTenantId) {
        return NextResponse.json(
          { message: 'No puedes asignar usuarios a otro tenant' },
          { status: 403 }
        );
      }
    }

    const existente = await db.queryOne(
      'SELECT id FROM usuarios WHERE email = $1',
      [email]
    );
    if (existente) {
      return NextResponse.json(
        { message: 'Ya existe un usuario con ese email' },
        { status: 409 }
      );
    }

    const passwordHash = await bcrypt.hash(password, 12);

    const allowedRoles = ['USER', 'ADMIN', 'SUPERADMIN'];
    const finalRol = allowedRoles.includes(rol) ? rol : 'USER';

    const result = await db.queryOne<any>(
      `INSERT INTO usuarios (email, password_hash, nombre, rol, tenant_id, ruc, activo, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, NOW(), NOW())
       RETURNING *`,
      [email, passwordHash, nombre, finalRol, tenantId || null, ruc || null, activo ?? true]
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
        createdAt: result.created_at,
      },
    }, { status: 201 });
  } catch (error: any) {
    console.error('[Admin Usuarios POST]', error);
    return NextResponse.json(
      { message: error.message || 'Error interno' },
      { status: error.message?.startsWith('No autorizado') ? 401 : 500 }
    );
  }
}
