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

    const posicion = await db.queryOne<any>(
      `SELECT pf.id, pf.nombre, pf.tipo_contribuyente, pf.activo, pf.created_at, pf.updated_at
       FROM posiciones_fiscales pf
       WHERE pf.id = $1 AND pf.tenant_id = $2`,
      [numId, tenantId]
    );

    if (!posicion) {
      return NextResponse.json(
        { message: `Posición fiscal con ID ${id} no encontrada` },
        { status: 404 }
      );
    }

    const lineas = await db.queryAll<any>(
      `SELECT pfl.id, pfl.impuesto_id, pfl.tipo_operacion, pfl.aplica_retencion,
              i.codigo, i.codigo_porcentaje, i.nombre AS impuesto_nombre, i.porcentaje, i.tipo_impuesto
       FROM posiciones_fiscales_lineas pfl
       LEFT JOIN impuestos i ON pfl.impuesto_id = i.id
       WHERE pfl.posicion_fiscal_id = $1
       ORDER BY pfl.id ASC`,
      [numId]
    );

    return NextResponse.json({
      data: {
        id: posicion.id,
        nombre: posicion.nombre,
        tipoContribuyente: posicion.tipo_contribuyente,
        activo: Boolean(posicion.activo),
        createdAt: posicion.created_at,
        updatedAt: posicion.updated_at,
        lineas: lineas.map((l: any) => ({
          id: l.id,
          impuestoId: l.impuesto_id,
          tipoOperacion: l.tipo_operacion,
          aplicaRetencion: Boolean(l.aplica_retencion),
          impuesto: l.impuesto_id ? {
            id: l.impuesto_id,
            codigo: l.codigo,
            codigoPorcentaje: l.codigo_porcentaje,
            nombre: l.impuesto_nombre,
            porcentaje: parseFloat(l.porcentaje),
            tipoImpuesto: l.tipo_impuesto,
          } : null,
        })),
      },
    });
  } catch (error: any) {
    console.error('[Get Posicion Fiscal Error]', error);
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

    const posicion = await db.queryOne(
      'SELECT id FROM posiciones_fiscales WHERE id = $1 AND tenant_id = $2',
      [numId, tenantId]
    );
    if (!posicion) {
      return NextResponse.json(
        { message: `Posición fiscal con ID ${id} no encontrada` },
        { status: 404 }
      );
    }

    const { nombre, tipoContribuyente, activo } = body;

    const updates: Record<string, any> = {};
    if (nombre !== undefined) updates.nombre = nombre;
    if (tipoContribuyente !== undefined) updates.tipo_contribuyente = tipoContribuyente || null;
    if (activo !== undefined) updates.activo = activo;
    updates.updated_at = new Date();

    await db.update('posiciones_fiscales', updates, 'id = $1', [numId]);

    const updated = await db.queryOne<any>(
      'SELECT * FROM posiciones_fiscales WHERE id = $1',
      [numId]
    );

    return NextResponse.json({
      data: {
        id: updated.id,
        nombre: updated.nombre,
        tipoContribuyente: updated.tipo_contribuyente,
        activo: Boolean(updated.activo),
        createdAt: updated.created_at,
        updatedAt: updated.updated_at,
      },
    });
  } catch (error: any) {
    console.error('[Put Posicion Fiscal Error]', error);
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

    const posicion = await db.queryOne(
      'SELECT id FROM posiciones_fiscales WHERE id = $1 AND tenant_id = $2',
      [numId, tenantId]
    );
    if (!posicion) {
      return NextResponse.json(
        { message: `Posición fiscal con ID ${id} no encontrada` },
        { status: 404 }
      );
    }

    await db.query(
      'UPDATE posiciones_fiscales SET activo = false, updated_at = NOW() WHERE id = $1',
      [numId]
    );

    return NextResponse.json({ message: 'Posición fiscal desactivada correctamente' });
  } catch (error: any) {
    console.error('[Delete Posicion Fiscal Error]', error);
    return NextResponse.json(
      { message: error.message || 'Error interno del servidor' },
      { status: error.message?.startsWith('No autorizado') ? 401 : 500 }
    );
  }
}
