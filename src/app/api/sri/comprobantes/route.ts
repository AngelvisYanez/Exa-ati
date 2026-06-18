import { NextResponse } from 'next/server';
import { verifyAuth } from '@/lib/sri-api/auth-helper';
import { db } from '@/lib/sri-api/db';
import { getUserRuc } from '@/lib/sri-api/user-resolver';

const TIPO_COMPROBANTE_DESCRIPCIONES: Record<string, string> = {
  '01': 'FACTURA',
  '03': 'LIQUIDACIÓN DE COMPRA',
  '04': 'NOTA DE CRÉDITO',
  '05': 'NOTA DE DÉBITO',
  '06': 'GUÍA DE REMISIÓN',
  '07': 'COMPROBANTE DE RETENCIÓN',
};

export async function GET(req: Request) {
  try {
    const user = await verifyAuth(req);
    let userRuc: string | null = null;
    try {
      userRuc = await getUserRuc(user, req);
    } catch {
      userRuc = null;
    }

    const { searchParams } = new URL(req.url);
    const fechaDesde = searchParams.get('fechaDesde') || undefined;
    const fechaHasta = searchParams.get('fechaHasta') || undefined;
    const hasDateFilter = Boolean(fechaDesde || fechaHasta);
    const maxLimit = hasDateFilter
      ? parseInt(process.env.SRI_LIST_PERIOD_MAX || '2000', 10)
      : 200;
    const limit = Math.min(
      parseInt(searchParams.get('limit') || (hasDateFilter ? String(maxLimit) : '20'), 10),
      maxLimit
    );
    const page = parseInt(searchParams.get('page') || '1', 10);
    const offset = (page - 1) * limit;

    const rucEmisor = searchParams.get('rucEmisor') || undefined;
    const tipo = searchParams.get('tipo') || undefined;
    const estado = searchParams.get('estado') || undefined;

    const conditions: string[] = [];
    const params: any[] = [];

    // Control de acceso para no-SUPERADMIN
    if (user.rol !== 'SUPERADMIN') {
      if (rucEmisor) {
        // Validar acceso al RUC del emisor
        const emisor = await db.queryOne(
          'SELECT id, tenant_id FROM emisores WHERE ruc = ? AND activo = true',
          [rucEmisor]
        );
        if (!emisor || emisor.tenant_id !== user.tenantId) {
          return NextResponse.json(
            { message: 'Acceso denegado a este emisor' },
            { status: 403 }
          );
        }
        conditions.push('(e.ruc = ? OR c.emisor_ruc = ? OR c.receptor_identificacion = ?)');
        params.push(rucEmisor, rucEmisor, rucEmisor);
      } else if (user.tenantId) {
        // Restringir a comprobantes del tenant del usuario, o emitidos por/para él
        const emisores = await db.queryAll(
          'SELECT id FROM emisores WHERE tenant_id = ? AND activo = true',
          [user.tenantId]
        );
        const emisorIds = emisores.map((e: any) => e.id);

        if (emisorIds.length > 0) {
          const placeholders = emisorIds.map(() => '?').join(', ');
          conditions.push(`(c.tenant_id = ? OR c.receptor_identificacion = ? OR c.emisor_ruc = ? OR c.emisor_id IN (${placeholders}))`);
          params.push(user.tenantId, userRuc, userRuc, ...emisorIds);
        } else {
          conditions.push('(c.tenant_id = ? OR c.receptor_identificacion = ? OR c.emisor_ruc = ?)');
          params.push(user.tenantId, userRuc, userRuc);
        }
      } else {
        return NextResponse.json(
          { message: 'Acceso denegado: El usuario no tiene tenant asignado' },
          { status: 403 }
        );
      }
    } else {
      // SUPERADMIN: aplicar filtro si se provee
      if (rucEmisor) {
        conditions.push('(e.ruc = ? OR c.emisor_ruc = ?)');
        params.push(rucEmisor, rucEmisor);
      }
    }

    if (tipo) {
      conditions.push('c.tipo = ?');
      params.push(tipo);
    }

    if (estado) {
      conditions.push('c.estado = ?');
      params.push(estado);
    }

    if (fechaDesde) {
      conditions.push('c.fecha_emision >= ?');
      params.push(fechaDesde);
    }

    if (fechaHasta) {
      conditions.push('c.fecha_emision <= ?');
      params.push(fechaHasta);
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    // Count query (separate from data query for MariaDB compatibility)
    const countQuery = `
      SELECT COUNT(*) as total
      FROM comprobantes c
      LEFT JOIN emisores e ON c.emisor_id = e.id
      ${whereClause}
    `;
    const countResult = await db.queryOne<any>(countQuery, [...params]);
    const total = parseInt(countResult?.total || '0', 10);
    const totalPages = Math.ceil(total / limit);

    const queryStr = `
      SELECT 
        c.id,
        c.emisor_id,
        c.clave_acceso,
        c.tipo,
        c.serie,
        c.secuencial,
        c.ambiente,
        c.fecha_emision,
        c.estado,
        c.fecha_autorizacion,
        c.numero_autorizacion,
        c.subtotal_sin_impuesto,
        c.importe_total,
        c.receptor_identificacion,
        c.receptor_razon_social,
        c.receptor_email,
        COALESCE(e.ruc, c.emisor_ruc) AS ruc_emisor,
        COALESCE(e.razon_social, c.emisor_razon_social) AS razon_social_emisor,
        COALESCE(e.nombre_comercial, c.emisor_razon_social) AS nombre_comercial_emisor,
        c.categoria,
        c.total_iva,
        c.documentos_relacionados,
        c.created_at,
        c.updated_at
      FROM comprobantes c
      LEFT JOIN emisores e ON c.emisor_id = e.id
      ${whereClause}
      ORDER BY c.fecha_emision DESC, c.secuencial DESC
      LIMIT ? OFFSET ?
    `;

    const result = await db.query(queryStr, [...params, limit, offset]);

    const data = result.rows.map((row: any) => ({
      id: row.id,
      emisorId: row.emisor_id,
      claveAcceso: row.clave_acceso,
      tipoComprobante: row.tipo,
      tipoComprobanteDescripcion: TIPO_COMPROBANTE_DESCRIPCIONES[row.tipo] || row.tipo,
      serie: row.serie,
      secuencial: row.secuencial,
      ambiente: row.ambiente,
      fechaEmision: row.fecha_emision,
      importeTotal: parseFloat(row.importe_total) || 0,
      subtotal: parseFloat(row.subtotal_sin_impuesto) || 0,
      receptorRazonSocial: row.receptor_razon_social,
      receptorIdentificacion: row.receptor_identificacion,
      receptorEmail: row.receptor_email,
      estado: row.estado,
      fechaAutorizacion: row.fecha_autorizacion,
      numeroAutorizacion: row.numero_autorizacion,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      categoria: row.categoria,
      totalIva: parseFloat(row.total_iva) || 0,
      documentosRelacionados: row.documentos_relacionados || undefined,
      emisor: {
        ruc: row.ruc_emisor,
        razonSocial: row.razon_social_emisor,
        nombreComercial: row.nombre_comercial_emisor || row.razon_social_emisor,
      }
    }));

    return NextResponse.json({
      data,
      meta: {
        total,
        page,
        limit,
        totalPages,
      }
    });
  } catch (error: any) {
    console.error('[Get Comprobantes Error]', error);
    return NextResponse.json(
      { message: error.message || 'Error interno del servidor' },
      { status: error.message?.startsWith('No autorizado') ? 401 : 500 }
    );
  }
}
