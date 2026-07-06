import { NextResponse } from 'next/server';
import { verifyAuth } from '@/lib/sri-api/auth-helper';
import { db } from '@/lib/sri-api/db';
import { createEcommerceInvoice } from '@/lib/sri-api/ecommerce';

export async function POST(req: Request) {
  try {
    const user = await verifyAuth(req);
    const body = await req.json();

    if (!body.emisorId || !body.items || body.items.length === 0 || !body.cliente) {
      return NextResponse.json(
        { message: 'Faltan campos requeridos: emisorId, items, cliente' },
        { status: 400 }
      );
    }

    if (!body.cliente.email) {
      return NextResponse.json(
        { message: 'El email del cliente es obligatorio para facturación eCommerce' },
        { status: 400 }
      );
    }

    const emisor = await db.queryOne(
      'SELECT id, tenant_id FROM emisores WHERE id = ? AND activo = true',
      [body.emisorId]
    );

    if (!emisor) {
      return NextResponse.json(
        { message: 'Emisor no encontrado o inactivo' },
        { status: 404 }
      );
    }

    if (user.rol !== 'SUPERADMIN' && emisor.tenant_id !== user.tenantId) {
      return NextResponse.json(
        { message: 'Acceso denegado a este emisor' },
        { status: 403 }
      );
    }

    const result = await createEcommerceInvoice({
      emisorId: body.emisorId,
      items: body.items,
      cliente: body.cliente,
      formaPago: body.formaPago || '01',
      guiaRemision: body.guiaRemision,
      pedidoId: body.pedidoId,
      moneda: body.moneda,
      plazo: body.plazo,
      descuentoGlobal: body.descuentoGlobal,
      importeTotal: body.importeTotal,
    });

    return NextResponse.json({
      success: true,
      claveAcceso: result.claveAcceso,
      id: result.id,
    });
  } catch (error: any) {
    console.error('[Ecommerce Invoice Error]', error);
    return NextResponse.json(
      { success: false, message: error.message || 'Error interno al crear factura eCommerce' },
      { status: error.message?.startsWith('No autorizado') ? 401 : 500 }
    );
  }
}

export async function GET(req: Request) {
  try {
    const user = await verifyAuth(req);
    const { searchParams } = new URL(req.url);
    const limit = Math.min(parseInt(searchParams.get('limit') || '50', 10), 200);
    const page = parseInt(searchParams.get('page') || '1', 10);
    const offset = (page - 1) * limit;
    const fechaDesde = searchParams.get('fechaDesde');
    const fechaHasta = searchParams.get('fechaHasta');
    const estado = searchParams.get('estado');

    const conditions: string[] = ["c.tipo = '01'", "c.origen = 'ECOMMERCE'"];
    const params: any[] = [];

    if (user.rol !== 'SUPERADMIN') {
      if (user.tenantId) {
        conditions.push('c.tenant_id = ?');
        params.push(user.tenantId);
      } else {
        return NextResponse.json(
          { message: 'Acceso denegado: El usuario no tiene tenant asignado' },
          { status: 403 }
        );
      }
    }

    if (fechaDesde) {
      conditions.push('c.fecha_emision >= ?');
      params.push(fechaDesde);
    }
    if (fechaHasta) {
      conditions.push('c.fecha_emision <= ?');
      params.push(fechaHasta);
    }
    if (estado) {
      conditions.push('c.estado = ?');
      params.push(estado);
    }

    const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    const countResult = await db.queryOne<any>(
      `SELECT COUNT(*) as total FROM comprobantes c ${where}`,
      params
    );
    const total = parseInt(countResult?.total || '0', 10);

    const result = await db.query(
      `SELECT c.id, c.clave_acceso, c.serie, c.secuencial, c.fecha_emision,
              c.estado, c.importe_total, c.receptor_razon_social,
              c.receptor_identificacion, c.receptor_email, c.numero_autorizacion,
              c.documentos_relacionados, c.created_at
       FROM comprobantes c ${where}
       ORDER BY c.created_at DESC
       LIMIT ? OFFSET ?`,
      [...params, limit, offset]
    );

    return NextResponse.json({
      data: result.rows,
      meta: { total, page, limit, totalPages: Math.ceil(total / limit) },
    });
  } catch (error: any) {
    console.error('[Ecommerce List Error]', error);
    return NextResponse.json(
      { message: error.message || 'Error interno' },
      { status: error.message?.startsWith('No autorizado') ? 401 : 500 }
    );
  }
}
