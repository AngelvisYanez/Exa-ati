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

    const guia = await db.queryOne<any>(
      `SELECT c.id, c.clave_acceso, c.serie, c.secuencial, c.ambiente,
              c.fecha_emision, c.estado, c.estado_sri, c.fecha_autorizacion,
              c.numero_autorizacion, c.emisor_ruc, c.emisor_razon_social,
              c.receptor_identificacion, c.receptor_razon_social,
              c.subtotal_sin_impuesto, c.importe_total, c.total_iva,
              c.created_at, c.updated_at
       FROM comprobantes c
       WHERE c.id = $1 AND c.tenant_id = $2 AND c.tipo = '06'`,
      [id, tenantId]
    );

    if (!guia) {
      return NextResponse.json(
        { message: `Guía de remisión con ID ${id} no encontrada` },
        { status: 404 }
      );
    }

    return NextResponse.json({
      data: {
        id: guia.id,
        claveAcceso: guia.clave_acceso,
        serie: guia.serie,
        secuencial: guia.secuencial,
        ambiente: guia.ambiente,
        fechaEmision: guia.fecha_emision,
        estado: guia.estado,
        estadoSri: guia.estado_sri,
        fechaAutorizacion: guia.fecha_autorizacion,
        numeroAutorizacion: guia.numero_autorizacion,
        emisorRuc: guia.emisor_ruc,
        emisorRazonSocial: guia.emisor_razon_social,
        receptorIdentificacion: guia.receptor_identificacion,
        receptorRazonSocial: guia.receptor_razon_social,
        subtotal: parseFloat(guia.subtotal_sin_impuesto) || 0,
        importeTotal: parseFloat(guia.importe_total) || 0,
        totalIva: parseFloat(guia.total_iva) || 0,
        createdAt: guia.created_at,
        updatedAt: guia.updated_at,
      },
    });
  } catch (error: any) {
    console.error('[Get Guia Remision Error]', error);
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

    const guia = await db.queryOne(
      "SELECT id, estado FROM comprobantes WHERE id = $1 AND tenant_id = $2 AND tipo = '06'",
      [id, tenantId]
    );
    if (!guia) {
      return NextResponse.json(
        { message: `Guía de remisión con ID ${id} no encontrada` },
        { status: 404 }
      );
    }

    if (guia.estado === 'AUTORIZADO') {
      return NextResponse.json(
        { message: 'No se puede eliminar una guía de remisión autorizada' },
        { status: 400 }
      );
    }

    await db.query(
      'UPDATE comprobantes SET activo = false, updated_at = NOW() WHERE id = $1',
      [id]
    );

    return NextResponse.json({ message: 'Guía de remisión eliminada correctamente' });
  } catch (error: any) {
    console.error('[Delete Guia Remision Error]', error);
    return NextResponse.json(
      { message: error.message || 'Error interno del servidor' },
      { status: error.message?.startsWith('No autorizado') ? 401 : 500 }
    );
  }
}
