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

    const impuesto = await db.queryOne<any>(
      `SELECT i.id, i.codigo, i.codigo_porcentaje, i.nombre, i.porcentaje, i.tarifa,
              i.tipo_impuesto, i.codigo_ats, i.codigo_formulario_103, i.codigo_formulario_104,
              i.activo, i.created_at, i.updated_at
       FROM impuestos i
       WHERE i.id = $1 AND i.tenant_id = $2`,
      [numId, tenantId]
    );

    if (!impuesto) {
      return NextResponse.json(
        { message: `Impuesto con ID ${id} no encontrado` },
        { status: 404 }
      );
    }

    return NextResponse.json({
      data: {
        id: impuesto.id,
        codigo: impuesto.codigo,
        codigoPorcentaje: impuesto.codigo_porcentaje,
        nombre: impuesto.nombre,
        porcentaje: parseFloat(impuesto.porcentaje),
        tarifa: parseFloat(impuesto.tarifa),
        tipoImpuesto: impuesto.tipo_impuesto,
        codigoAts: impuesto.codigo_ats,
        codigoFormulario103: impuesto.codigo_formulario_103,
        codigoFormulario104: impuesto.codigo_formulario_104,
        activo: Boolean(impuesto.activo),
        createdAt: impuesto.created_at,
        updatedAt: impuesto.updated_at,
      },
    });
  } catch (error: any) {
    console.error('[Get Impuesto Error]', error);
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

    const impuesto = await db.queryOne(
      'SELECT * FROM impuestos WHERE id = $1 AND tenant_id = $2',
      [numId, tenantId]
    );
    if (!impuesto) {
      return NextResponse.json(
        { message: `Impuesto con ID ${id} no encontrado` },
        { status: 404 }
      );
    }

    const { codigo, codigoPorcentaje, nombre, porcentaje, tarifa, tipoImpuesto, codigoAts, codigoFormulario103, codigoFormulario104, activo } = body;

    if (codigo || codigoPorcentaje) {
      const newCodigo = codigo ?? impuesto.codigo;
      const newCodigoPct = codigoPorcentaje ?? impuesto.codigo_porcentaje;
      if (newCodigo !== impuesto.codigo || newCodigoPct !== impuesto.codigo_porcentaje) {
        const dup = await db.queryOne(
          'SELECT id FROM impuestos WHERE tenant_id = $1 AND codigo = $2 AND codigo_porcentaje = $3 AND id != $4',
          [tenantId, newCodigo, newCodigoPct, numId]
        );
        if (dup) {
          return NextResponse.json(
            { message: `Ya existe un impuesto con código ${newCodigo}-${newCodigoPct}` },
            { status: 409 }
          );
        }
      }
    }

    const updates: Record<string, any> = {};
    if (codigo !== undefined) updates.codigo = codigo;
    if (codigoPorcentaje !== undefined) updates.codigo_porcentaje = codigoPorcentaje;
    if (nombre !== undefined) updates.nombre = nombre;
    if (porcentaje !== undefined) updates.porcentaje = porcentaje;
    if (tarifa !== undefined) updates.tarifa = tarifa;
    if (tipoImpuesto !== undefined) updates.tipo_impuesto = tipoImpuesto;
    if (codigoAts !== undefined) updates.codigo_ats = codigoAts || null;
    if (codigoFormulario103 !== undefined) updates.codigo_formulario_103 = codigoFormulario103 || null;
    if (codigoFormulario104 !== undefined) updates.codigo_formulario_104 = codigoFormulario104 || null;
    if (activo !== undefined) updates.activo = activo;
    updates.updated_at = new Date();

    await db.update('impuestos', updates, 'id = $1', [numId]);

    const updated = await db.queryOne<any>(
      `SELECT i.id, i.codigo, i.codigo_porcentaje, i.nombre, i.porcentaje, i.tarifa,
              i.tipo_impuesto, i.codigo_ats, i.codigo_formulario_103, i.codigo_formulario_104,
              i.activo, i.created_at, i.updated_at
       FROM impuestos i WHERE i.id = $1`,
      [numId]
    );

    return NextResponse.json({
      data: {
        id: updated.id,
        codigo: updated.codigo,
        codigoPorcentaje: updated.codigo_porcentaje,
        nombre: updated.nombre,
        porcentaje: parseFloat(updated.porcentaje),
        tarifa: parseFloat(updated.tarifa),
        tipoImpuesto: updated.tipo_impuesto,
        codigoAts: updated.codigo_ats,
        codigoFormulario103: updated.codigo_formulario_103,
        codigoFormulario104: updated.codigo_formulario_104,
        activo: Boolean(updated.activo),
        createdAt: updated.created_at,
        updatedAt: updated.updated_at,
      },
    });
  } catch (error: any) {
    console.error('[Put Impuesto Error]', error);
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

    const impuesto = await db.queryOne(
      'SELECT id FROM impuestos WHERE id = $1 AND tenant_id = $2',
      [numId, tenantId]
    );
    if (!impuesto) {
      return NextResponse.json(
        { message: `Impuesto con ID ${id} no encontrado` },
        { status: 404 }
      );
    }

    await db.query(
      'UPDATE impuestos SET activo = false, updated_at = NOW() WHERE id = $1',
      [numId]
    );

    return NextResponse.json({ message: 'Impuesto desactivado correctamente' });
  } catch (error: any) {
    console.error('[Delete Impuesto Error]', error);
    return NextResponse.json(
      { message: error.message || 'Error interno del servidor' },
      { status: error.message?.startsWith('No autorizado') ? 401 : 500 }
    );
  }
}
