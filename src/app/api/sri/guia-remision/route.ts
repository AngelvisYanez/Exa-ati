import { NextResponse } from 'next/server';
import { verifyAuth, requireTenantId } from '@/lib/sri-api/auth-helper';
import { db } from '@/lib/sri-api/db';
import { sendGuiaRemision, type GuiaRemisionData } from '@/lib/sri-api/guia-remision';

export async function GET(req: Request) {
  try {
    const user = await verifyAuth(req);
    const tenantId = requireTenantId(user);
    const { searchParams } = new URL(req.url);
    const estado = searchParams.get('estado');
    const fechaDesde = searchParams.get('fechaDesde');
    const fechaHasta = searchParams.get('fechaHasta');

    const conditions: string[] = ['c.tenant_id = $1', "c.tipo = '06'"];
    const params: any[] = [tenantId];

    if (estado) {
      conditions.push('c.estado = $' + (params.length + 1));
      params.push(estado);
    }
    if (fechaDesde) {
      conditions.push('c.fecha_emision >= $' + (params.length + 1));
      params.push(fechaDesde);
    }
    if (fechaHasta) {
      conditions.push('c.fecha_emision <= $' + (params.length + 1));
      params.push(fechaHasta);
    }

    const whereClause = conditions.join(' AND ');

    const guias = await db.queryAll<any>(
      `SELECT c.id, c.clave_acceso, c.serie, c.secuencial, c.ambiente,
              c.fecha_emision, c.estado, c.estado_sri, c.fecha_autorizacion,
              c.numero_autorizacion, c.emisor_ruc, c.emisor_razon_social,
              c.receptor_identificacion, c.receptor_razon_social,
              c.created_at, c.updated_at
       FROM comprobantes c
       WHERE ${whereClause}
       ORDER BY c.fecha_emision DESC`,
      params
    );

    return NextResponse.json({
      data: guias.map((g: any) => ({
        id: g.id,
        claveAcceso: g.clave_acceso,
        serie: g.serie,
        secuencial: g.secuencial,
        ambiente: g.ambiente,
        fechaEmision: g.fecha_emision,
        estado: g.estado,
        estadoSri: g.estado_sri,
        fechaAutorizacion: g.fecha_autorizacion,
        numeroAutorizacion: g.numero_autorizacion,
        emisorRuc: g.emisor_ruc,
        emisorRazonSocial: g.emisor_razon_social,
        receptorIdentificacion: g.receptor_identificacion,
        receptorRazonSocial: g.receptor_razon_social,
        createdAt: g.created_at,
        updatedAt: g.updated_at,
      })),
    });
  } catch (error: any) {
    console.error('[Get Guias Remision Error]', error);
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
    const body = await req.json() as GuiaRemisionData;

    if (!body.emisor || !body.destinatario || !body.transporte) {
      return NextResponse.json(
        { message: 'emisor, destinatario y transporte son obligatorios' },
        { status: 400 }
      );
    }

    body.tenantId = tenantId;

    const result = await sendGuiaRemision(body);

    return NextResponse.json({
      success: result.success,
      claveAcceso: result.claveAcceso,
      numeroAutorizacion: result.numeroAutorizacion,
      error: result.error,
    }, { status: result.success ? 201 : 500 });
  } catch (error: any) {
    console.error('[Post Guia Remision Error]', error);
    return NextResponse.json(
      { message: error.message || 'Error interno del servidor' },
      { status: error.message?.startsWith('No autorizado') ? 401 : 500 }
    );
  }
}
