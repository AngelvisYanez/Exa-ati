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
    const numId = parseInt(id, 10);

    const reporte = await db.queryOne<any>(
      `SELECT r.id, r.tipo, r.periodo, r.estado, r.data, r.fecha_generacion,
              r.fecha_presentacion, r.created_at, r.updated_at
       FROM reportes_fiscales r
       WHERE r.id = $1 AND r.tenant_id = $2`,
      [numId, tenantId]
    );

    if (!reporte) {
      return NextResponse.json(
        { message: `Reporte fiscal con ID ${id} no encontrado` },
        { status: 404 }
      );
    }

    return NextResponse.json({
      data: {
        id: reporte.id,
        tipo: reporte.tipo,
        periodo: reporte.periodo,
        estado: reporte.estado,
        data: typeof reporte.data === 'string' ? JSON.parse(reporte.data) : reporte.data,
        fechaGeneracion: reporte.fecha_generacion,
        fechaPresentacion: reporte.fecha_presentacion,
        createdAt: reporte.created_at,
        updatedAt: reporte.updated_at,
      },
    });
  } catch (error: any) {
    console.error('[Get Reporte Error]', error);
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
    const numId = parseInt(id, 10);
    const body = await req.json();
    const { estado } = body;

    const reporte = await db.queryOne(
      'SELECT id, estado FROM reportes_fiscales WHERE id = $1 AND tenant_id = $2',
      [numId, tenantId]
    );
    if (!reporte) {
      return NextResponse.json(
        { message: `Reporte fiscal con ID ${id} no encontrado` },
        { status: 404 }
      );
    }

    if (!['BORRADOR', 'GENERADO', 'PRESENTADO'].includes(estado)) {
      return NextResponse.json(
        { message: 'Estado inválido. Debe ser BORRADOR, GENERADO o PRESENTADO' },
        { status: 400 }
      );
    }

    const updates: Record<string, any> = { estado, updated_at: new Date() };
    if (estado === 'PRESENTADO') {
      updates.fecha_presentacion = new Date();
    }

    await db.update('reportes_fiscales', updates, 'id = $1', [numId]);

    const updated = await db.queryOne<any>(
      'SELECT * FROM reportes_fiscales WHERE id = $1',
      [numId]
    );

    return NextResponse.json({
      data: {
        id: updated.id,
        tipo: updated.tipo,
        periodo: updated.periodo,
        estado: updated.estado,
        fechaGeneracion: updated.fecha_generacion,
        fechaPresentacion: updated.fecha_presentacion,
        createdAt: updated.created_at,
        updatedAt: updated.updated_at,
      },
    });
  } catch (error: any) {
    console.error('[Put Reporte Error]', error);
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
    const numId = parseInt(id, 10);

    const reporte = await db.queryOne(
      'SELECT id FROM reportes_fiscales WHERE id = $1 AND tenant_id = $2',
      [numId, tenantId]
    );
    if (!reporte) {
      return NextResponse.json(
        { message: `Reporte fiscal con ID ${id} no encontrado` },
        { status: 404 }
      );
    }

    await db.query(
      'DELETE FROM reportes_fiscales WHERE id = $1',
      [numId]
    );

    return NextResponse.json({ message: 'Reporte eliminado correctamente' });
  } catch (error: any) {
    console.error('[Delete Reporte Error]', error);
    return NextResponse.json(
      { message: error.message || 'Error interno del servidor' },
      { status: error.message?.startsWith('No autorizado') ? 401 : 500 }
    );
  }
}
