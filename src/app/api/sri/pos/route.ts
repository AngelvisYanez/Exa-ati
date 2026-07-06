import { NextResponse } from 'next/server';
import { verifyAuth } from '@/lib/sri-api/auth-helper';
import { db } from '@/lib/sri-api/db';
import { createPosInvoice } from '@/lib/sri-api/pos';

export async function POST(req: Request) {
  try {
    const user = await verifyAuth(req);
    const body = await req.json();

    if (!body.emisorId || !body.items || body.items.length === 0) {
      return NextResponse.json(
        { message: 'Faltan campos requeridos: emisorId, items' },
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

    const result = await createPosInvoice({
      emisorId: body.emisorId,
      items: body.items,
      formaPago: body.formaPago || '01',
      cliente: body.cliente,
      propina: body.propina,
      descuentoGlobal: body.descuentoGlobal,
      observaciones: body.observaciones,
    });

    return NextResponse.json({
      success: true,
      claveAcceso: result.claveAcceso,
      id: result.id,
    });
  } catch (error: any) {
    console.error('[POS Error]', error);
    return NextResponse.json(
      { success: false, message: error.message || 'Error interno al crear factura POS' },
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
    const search = searchParams.get('search');

    const conditions: string[] = ["c.tipo = '01'", "c.origen = 'POS'"];
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
    if (search) {
      conditions.push('(c.receptor_razon_social LIKE ? OR c.receptor_identificacion LIKE ? OR c.secuencial LIKE ?)');
      const like = `%${search}%`;
      params.push(like, like, like);
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
              c.receptor_identificacion, c.numero_autorizacion, c.created_at
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
    console.error('[POS List Error]', error);
    return NextResponse.json(
      { message: error.message || 'Error interno' },
      { status: error.message?.startsWith('No autorizado') ? 401 : 500 }
    );
  }
}
