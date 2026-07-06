import { NextResponse } from 'next/server';
import { verifyAuth, requireTenantId } from '@/lib/sri-api/auth-helper';
import { db } from '@/lib/sri-api/db';

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await verifyAuth(req);
    const tenantId = requireTenantId(user);
    const { id } = await params;

    const transportista = await db.queryOne<any>(
      `SELECT t.id, t.ruc, t.razon_social, t.tipo_identificacion, t.placa,
              t.direccion, t.telefono, t.email, t.activo, t.created_at, t.updated_at
       FROM transportistas t
       WHERE t.id = $1 AND t.tenant_id = $2`,
      [id, tenantId]
    );

    if (!transportista) {
      return NextResponse.json(
        { message: `Transportista con ID ${id} no encontrado` },
        { status: 404 }
      );
    }

    return NextResponse.json({
      data: {
        id: transportista.id,
        ruc: transportista.ruc,
        razonSocial: transportista.razon_social,
        tipoIdentificacion: transportista.tipo_identificacion,
        placa: transportista.placa,
        direccion: transportista.direccion,
        telefono: transportista.telefono,
        email: transportista.email,
        activo: Boolean(transportista.activo),
        createdAt: transportista.created_at,
        updatedAt: transportista.updated_at,
      },
    });
  } catch (error: any) {
    console.error('[Get Transportista Error]', error);
    return NextResponse.json(
      { message: error.message || 'Error interno del servidor' },
      { status: error.message?.startsWith('No autorizado') ? 401 : 500 }
    );
  }
}

export async function PUT(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await verifyAuth(req);
    const tenantId = requireTenantId(user);
    const { id } = await params;
    const body = await req.json();

    const transportista = await db.queryOne(
      'SELECT id FROM transportistas WHERE id = $1 AND tenant_id = $2',
      [id, tenantId]
    );
    if (!transportista) {
      return NextResponse.json(
        { message: `Transportista con ID ${id} no encontrado` },
        { status: 404 }
      );
    }

    const { razonSocial, placa, direccion, telefono, email, activo } = body;

    const updates: Record<string, any> = {};
    if (razonSocial !== undefined) updates.razon_social = razonSocial;
    if (placa !== undefined) updates.placa = placa.toUpperCase();
    if (direccion !== undefined) updates.direccion = direccion;
    if (telefono !== undefined) updates.telefono = telefono;
    if (email !== undefined) updates.email = email;
    if (activo !== undefined) updates.activo = activo;
    updates.updated_at = new Date();

    if (Object.keys(updates).length > 1) {
      await db.update('transportistas', updates, 'id = $1', [id]);
    }

    const updated = await db.queryOne<any>(
      'SELECT * FROM transportistas WHERE id = $1',
      [id]
    );

    return NextResponse.json({
      data: {
        id: updated.id,
        ruc: updated.ruc,
        razonSocial: updated.razon_social,
        tipoIdentificacion: updated.tipo_identificacion,
        placa: updated.placa,
        direccion: updated.direccion,
        telefono: updated.telefono,
        email: updated.email,
        activo: Boolean(updated.activo),
        createdAt: updated.created_at,
        updatedAt: updated.updated_at,
      },
    });
  } catch (error: any) {
    console.error('[Put Transportista Error]', error);
    return NextResponse.json(
      { message: error.message || 'Error interno del servidor' },
      { status: error.message?.startsWith('No autorizado') ? 401 : 500 }
    );
  }
}

export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await verifyAuth(req);
    const tenantId = requireTenantId(user);
    const { id } = await params;

    const transportista = await db.queryOne(
      'SELECT id FROM transportistas WHERE id = $1 AND tenant_id = $2',
      [id, tenantId]
    );
    if (!transportista) {
      return NextResponse.json(
        { message: `Transportista con ID ${id} no encontrado` },
        { status: 404 }
      );
    }

    await db.query(
      'UPDATE transportistas SET activo = false, updated_at = NOW() WHERE id = $1',
      [id]
    );

    return NextResponse.json({ message: 'Transportista desactivado correctamente' });
  } catch (error: any) {
    console.error('[Delete Transportista Error]', error);
    return NextResponse.json(
      { message: error.message || 'Error interno del servidor' },
      { status: error.message?.startsWith('No autorizado') ? 401 : 500 }
    );
  }
}
