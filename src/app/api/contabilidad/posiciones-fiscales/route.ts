import { NextResponse } from 'next/server';
import { verifyAuth, requireTenantId } from '@/lib/sri-api/auth-helper';
import { db } from '@/lib/sri-api/db';

export async function GET(req: Request) {
  try {
    const user = await verifyAuth(req);
    const tenantId = requireTenantId(user);

    const posiciones = await db.queryAll<any>(
      `SELECT pf.id, pf.nombre, pf.tipo_contribuyente, pf.activo, pf.created_at, pf.updated_at
       FROM posiciones_fiscales pf
       WHERE pf.tenant_id = $1 AND pf.activo = true
       ORDER BY pf.nombre ASC`,
      [tenantId]
    );

    return NextResponse.json({
      data: posiciones.map((p: any) => ({
        id: p.id,
        nombre: p.nombre,
        tipoContribuyente: p.tipo_contribuyente,
        activo: Boolean(p.activo),
        createdAt: p.created_at,
        updatedAt: p.updated_at,
      })),
    });
  } catch (error: any) {
    console.error('[Get Posiciones Fiscales Error]', error);
    return NextResponse.json(
      { message: error.message || 'Error interno del servidor' },
      { status: error.message?.startsWith('No autorizado') ? 401 : 500 }
    );
  }
}

export async function POST(req: Request) {
  try {
    const user = await verifyAuth(req);
    const tenantId = requireTenantId(user);
    const body = await req.json();
    const { nombre, tipoContribuyente } = body;

    if (!nombre) {
      return NextResponse.json(
        { message: 'nombre es obligatorio' },
        { status: 400 }
      );
    }

    const result = await db.queryOne<any>(
      `INSERT INTO posiciones_fiscales (tenant_id, nombre, tipo_contribuyente, created_at, updated_at)
       VALUES ($1, $2, $3, NOW(), NOW())
       RETURNING *`,
      [tenantId, nombre, tipoContribuyente || null]
    );

    return NextResponse.json({
      data: {
        id: result.id,
        nombre: result.nombre,
        tipoContribuyente: result.tipo_contribuyente,
        activo: Boolean(result.activo),
        createdAt: result.created_at,
        updatedAt: result.updated_at,
      },
    }, { status: 201 });
  } catch (error: any) {
    console.error('[Post Posicion Fiscal Error]', error);
    return NextResponse.json(
      { message: error.message || 'Error interno del servidor' },
      { status: error.message?.startsWith('No autorizado') ? 401 : 500 }
    );
  }
}
