import { NextResponse } from 'next/server';
import bcrypt from 'bcrypt';
import { verifyAuth, requireTenantId } from '@/lib/sri-api/auth-helper';
import { db } from '@/lib/sri-api/db';

// Listar usuarios clientes
export async function GET(req: Request) {
  try {
    const user = await verifyAuth(req);
    if (user.rol !== 'ADMIN' && user.rol !== 'SUPERADMIN') {
      return NextResponse.json({ message: 'No autorizado' }, { status: 403 });
    }

    const tenantId = requireTenantId(user);

    // Listar usuarios de este tenant (ADMIN y USER)
    const clientes = await db.queryAll<any>(
      `SELECT id, email, nombre, ruc, rol, activo, created_at
       FROM usuarios
       WHERE tenant_id = $1 AND rol != 'SUPERADMIN'
       ORDER BY nombre ASC, email ASC`,
      [tenantId]
    );

    return NextResponse.json({
      success: true,
      clientes: clientes.map((c) => ({
        id: c.id,
        email: c.email,
        nombre: c.nombre,
        rol: c.rol,
        ruc: c.ruc,
        activo: Boolean(c.activo),
        createdAt: c.created_at,
      })),
    });
  } catch (error: any) {
    console.error('[Get Clientes Error]', error);
    return NextResponse.json(
      { message: error.message || 'Error al obtener clientes' },
      { status: 500 }
    );
  }
}

// Registrar un nuevo usuario cliente
export async function POST(req: Request) {
  try {
    const user = await verifyAuth(req);
    if (user.rol !== 'ADMIN' && user.rol !== 'SUPERADMIN') {
      return NextResponse.json({ message: 'No autorizado' }, { status: 403 });
    }

    const tenantId = requireTenantId(user);
    const { email, password, nombre, ruc, rol } = await req.json();

    if (!email || !password || !nombre) {
      return NextResponse.json(
        { message: 'El correo, contraseña y nombre son obligatorios.' },
        { status: 400 }
      );
    }

    const assignedRol = rol === 'ADMIN' ? 'ADMIN' : 'USER';

    // Verificar si el correo ya existe
    const existing = await db.queryOne<{ id: string }>(
      'SELECT id FROM usuarios WHERE email = $1',
      [email]
    );

    if (existing) {
      return NextResponse.json(
        { message: `Ya existe un usuario registrado con el email ${email}` },
        { status: 409 }
      );
    }

    // Verificar si el RUC existe (si se proporciona)
    if (ruc) {
      const emisor = await db.queryOne<{ id: string }>(
        'SELECT id FROM emisores WHERE tenant_id = $1 AND ruc = $2 AND activo = true',
        [tenantId, ruc]
      );
      if (!emisor) {
        return NextResponse.json(
          { message: `El RUC ${ruc} no está registrado o activo en este tenant.` },
          { status: 400 }
        );
      }
    }

    const passwordHash = await bcrypt.hash(password, 12);

    const newClient = await db.insert<any>('usuarios', {
      email,
      password_hash: passwordHash,
      nombre,
      rol: assignedRol,
      tenant_id: tenantId,
      ruc: ruc || null,
      activo: true,
    }, 'id, email, nombre, rol, ruc, activo, created_at');

    return NextResponse.json({
      success: true,
      message: 'Cliente creado correctamente',
      cliente: {
        id: newClient.id,
        email: newClient.email,
        nombre: newClient.nombre,
        rol: newClient.rol,
        ruc: newClient.ruc,
        activo: Boolean(newClient.activo),
        createdAt: newClient.created_at,
      },
    }, { status: 201 });
  } catch (error: any) {
    console.error('[Post Cliente Error]', error);
    return NextResponse.json(
      { message: error.message || 'Error al registrar cliente' },
      { status: 500 }
    );
  }
}
