import { NextResponse } from 'next/server';
import { verifyAuth, requireTenantId } from '@/lib/sri-api/auth-helper';
import { db } from '@/lib/sri-api/db';

export async function GET(req: Request) {
  try {
    const user = await verifyAuth(req);
    const tenantId = requireTenantId(user);
    const { searchParams } = new URL(req.url);
    const periodo = searchParams.get('periodo');

    const conditions: string[] = ['r.tenant_id = $1', "r.tipo = 'ATS'"];
    const params: any[] = [tenantId];

    if (periodo) {
      conditions.push('r.periodo = $' + (params.length + 1));
      params.push(parseInt(periodo, 10));
    }

    const whereClause = conditions.join(' AND ');

    const reportes = await db.queryAll<any>(
      `SELECT r.id, r.tipo, r.periodo, r.estado, r.fecha_generacion,
              r.created_at, r.updated_at
       FROM reportes_fiscales r
       WHERE ${whereClause}
       ORDER BY r.periodo DESC, r.created_at DESC`,
      params
    );

    return NextResponse.json({
      data: reportes.map((r: any) => ({
        id: r.id,
        tipo: r.tipo,
        periodo: r.periodo,
        estado: r.estado,
        fechaGeneracion: r.fecha_generacion,
        createdAt: r.created_at,
        updatedAt: r.updated_at,
      })),
    });
  } catch (error: any) {
    console.error('[Get ATS Reports Error]', error);
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
    const { periodo } = body;

    if (!periodo) {
      return NextResponse.json(
        { message: 'periodo es obligatorio (formato YYYYMM)' },
        { status: 400 }
      );
    }

    const periodoStr = String(periodo);
    const year = parseInt(periodoStr.substring(0, 4), 10);
    const month = parseInt(periodoStr.substring(4, 6), 10);
    if (periodoStr.length !== 6 || year < 2000 || month < 1 || month > 12) {
      return NextResponse.json(
        { message: 'Período inválido. Debe estar en formato YYYYMM.' },
        { status: 400 }
      );
    }

    const emisor = await db.queryOne(
      'SELECT id, ruc, razon_social FROM emisores WHERE tenant_id = $1 AND activo = true LIMIT 1',
      [tenantId]
    );
    if (!emisor) {
      return NextResponse.json(
        { message: 'No hay un emisor configurado para este contribuyente.' },
        { status: 400 }
      );
    }

    const fechaDesde = `${year}-${String(month).padStart(2, '0')}-01`;
    const fechaHasta = month === 12
      ? `${year + 1}-01-01`
      : `${year}-${String(month + 1).padStart(2, '0')}-01`;

    const comprobantes = await db.queryAll<any>(
      `SELECT c.tipo, c.emisor_ruc, c.subtotal_sin_impuesto, c.importe_total,
              c.total_iva, c.categoria, c.estado,
              c.receptor_identificacion, c.receptor_razon_social, c.receptor_tipo_id,
              c.serie, c.secuencial
       FROM comprobantes c
       WHERE c.tenant_id = $1 AND c.fecha_emision >= $2 AND c.fecha_emision < $3
         AND c.estado = 'AUTORIZADO'`,
      [tenantId, fechaDesde, fechaHasta]
    );

    const facturasEmitidas = comprobantes.filter(
      (c: any) => c.tipo === '01' && c.emisor_ruc === emisor.ruc
    );
    const facturasRecibidas = comprobantes.filter(
      (c: any) => c.tipo === '01' && c.emisor_ruc !== emisor.ruc
    );
    const retencionesArr = comprobantes.filter((c: any) => c.tipo === '07');

    const toNum = (v: any): number => Number(v) || 0;

    const ventaMap = new Map<string, any>();
    for (const f of facturasEmitidas) {
      const key = `${f.receptor_tipo_id || '05'}-${f.receptor_identificacion || ''}`;
      const baseIva = toNum(f.subtotal_sin_impuesto);
      const montoIva = toNum(f.total_iva);
      const baseNoGra = montoIva === 0 ? baseIva : 0;
      if (ventaMap.has(key)) {
        const v = ventaMap.get(key);
        v.numeroComprobantes++;
        v.baseImponible += baseIva;
        v.baseNoGraIva += baseNoGra;
        v.montoIva += montoIva;
      } else {
        ventaMap.set(key, {
          tpIdCliente: f.receptor_tipo_id || '05',
          idCliente: f.receptor_identificacion || '',
          razonSocial: f.receptor_razon_social || '',
          tipoComprobante: 'FACTURA',
          numeroComprobantes: 1,
          baseImponible: baseIva,
          baseNoGraIva: baseNoGra,
          montoIva,
          valorRetenidoIva: 0,
          valorRetenidoRenta: 0,
        });
      }
    }

    const resultado = {
      periodo,
      razonSocial: emisor.razon_social || '',
      ruc: emisor.ruc,
      ventas: Array.from(ventaMap.values()),
      compras: facturasRecibidas.map((f: any) => ({
        tpIdProveedor: '04',
        idProveedor: f.emisor_ruc || '',
        razonSocial: f.receptor_razon_social || '',
        tipoComprobante: 'FACTURA',
        numeroComprobantes: 1,
        baseImponible: toNum(f.subtotal_sin_impuesto),
        baseNoGraIva: toNum(f.total_iva) === 0 ? toNum(f.subtotal_sin_impuesto) : 0,
        montoIva: toNum(f.total_iva),
        valorRetenidoIva: 0,
        valorRetenidoRenta: 0,
      })),
      retenciones: retencionesArr.map((r: any) => ({
        tipoComprobante: 'COMPROBANTE_RETENCION',
        numeroComprobantes: 1,
        baseImponible: toNum(r.subtotal_sin_impuesto),
        valorRetenidoIva: toNum(r.total_iva),
        valorRetenidoRenta: 0,
      })),
      totalVentas: facturasEmitidas.reduce((s: number, f: any) => s + toNum(f.subtotal_sin_impuesto), 0),
      totalCompras: facturasRecibidas.reduce((s: number, f: any) => s + toNum(f.subtotal_sin_impuesto), 0),
      totalRetenciones: retencionesArr.reduce((s: number, r: any) => s + toNum(r.total_iva), 0),
    };

    const result = await db.queryOne<any>(
      `INSERT INTO reportes_fiscales (tenant_id, tipo, periodo, data, estado, fecha_generacion, created_at, updated_at)
       VALUES ($1, 'ATS', $2, $3, 'GENERADO', NOW(), NOW(), NOW())
       RETURNING *`,
      [tenantId, periodo, JSON.stringify(resultado)]
    );

    return NextResponse.json({
      data: {
        id: result.id,
        tipo: result.tipo,
        periodo: result.periodo,
        estado: result.estado,
        data: resultado,
        fechaGeneracion: result.fecha_generacion,
        createdAt: result.created_at,
        updatedAt: result.updated_at,
      },
    }, { status: 201 });
  } catch (error: any) {
    console.error('[Post ATS Error]', error);
    return NextResponse.json(
      { message: error.message || 'Error interno del servidor' },
      { status: error.message?.startsWith('No autorizado') ? 401 : 500 }
    );
  }
}
