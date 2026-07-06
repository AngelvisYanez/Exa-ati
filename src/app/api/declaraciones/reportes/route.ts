import { NextResponse } from 'next/server';
import { verifyAuth, requireTenantId } from '@/lib/sri-api/auth-helper';
import { db } from '@/lib/sri-api/db';

export async function GET(req: Request) {
  try {
    const user = await verifyAuth(req);
    const tenantId = requireTenantId(user);
    const { searchParams } = new URL(req.url);
    const tipo = searchParams.get('tipo');
    const periodo = searchParams.get('periodo');
    const estado = searchParams.get('estado');

    const conditions: string[] = ['r.tenant_id = $1'];
    const params: any[] = [tenantId];

    if (tipo) {
      conditions.push('r.tipo = $' + (params.length + 1));
      params.push(tipo);
    }
    if (periodo) {
      conditions.push('r.periodo = $' + (params.length + 1));
      params.push(parseInt(periodo, 10));
    }
    if (estado) {
      conditions.push('r.estado = $' + (params.length + 1));
      params.push(estado);
    }

    const whereClause = conditions.join(' AND ');

    const reportes = await db.queryAll<any>(
      `SELECT r.id, r.tipo, r.periodo, r.estado, r.fecha_generacion,
              r.fecha_presentacion, r.created_at, r.updated_at
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
        fechaPresentacion: r.fecha_presentacion,
        createdAt: r.created_at,
        updatedAt: r.updated_at,
      })),
    });
  } catch (error: any) {
    console.error('[Get Reportes Error]', error);
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
    const { tipo, periodo } = body;

    if (!tipo || !periodo) {
      return NextResponse.json(
        { message: 'tipo (103|104) y periodo son obligatorios' },
        { status: 400 }
      );
    }

    if (tipo !== '103' && tipo !== '104') {
      return NextResponse.json(
        { message: 'tipo debe ser 103 o 104' },
        { status: 400 }
      );
    }

    const emisor = await db.queryOne(
      'SELECT id, ruc FROM emisores WHERE tenant_id = $1 AND activo = true LIMIT 1',
      [tenantId]
    );
    if (!emisor) {
      return NextResponse.json(
        { message: 'No hay un emisor configurado para este contribuyente.' },
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

    const fechaDesde = `${year}-${String(month).padStart(2, '0')}-01`;
    const fechaHasta = month === 12
      ? `${year + 1}-01-01`
      : `${year}-${String(month + 1).padStart(2, '0')}-01`;

    const comprobantes = await db.queryAll<any>(
      `SELECT c.tipo, c.emisor_ruc, c.subtotal_sin_impuesto, c.importe_total,
              c.total_iva, c.categoria
       FROM comprobantes c
       WHERE c.tenant_id = $1 AND c.fecha_emision >= $2 AND c.fecha_emision < $3`,
      [tenantId, fechaDesde, fechaHasta]
    );

    const facturasEmitidas = comprobantes.filter(
      (c: any) => c.tipo === '01' && c.emisor_ruc === emisor.ruc
    );
    const facturasRecibidas = comprobantes.filter(
      (c: any) => c.tipo === '01' && c.emisor_ruc !== emisor.ruc
    );
    const retenciones = comprobantes.filter((c: any) => c.tipo === '07');

    const toNum = (v: any): number => Number(v) || 0;

    let data: any = {};

    if (tipo === '103') {
      const ivaVentas12 = facturasEmitidas
        .filter((c: any) => toNum(c.total_iva) > 0)
        .reduce((s: number, c: any) => s + toNum(c.subtotal_sin_impuesto) * 0.12, 0);
      const ivaVentas0 = facturasEmitidas
        .filter((c: any) => toNum(c.total_iva) === 0 && toNum(c.subtotal_sin_impuesto) > 0)
        .reduce((s: number, c: any) => s + toNum(c.subtotal_sin_impuesto), 0);
      const ivaCompras12 = facturasRecibidas
        .filter((c: any) => toNum(c.total_iva) > 0)
        .reduce((s: number, c: any) => s + toNum(c.subtotal_sin_impuesto) * 0.12, 0);
      const ivaCompras0 = facturasRecibidas
        .filter((c: any) => toNum(c.total_iva) === 0 && toNum(c.subtotal_sin_impuesto) > 0)
        .reduce((s: number, c: any) => s + toNum(c.subtotal_sin_impuesto), 0);

      const retencionIva = retenciones
        .filter((r: any) => toNum(r.total_iva) > 0)
        .reduce((s: number, r: any) => s + toNum(r.total_iva), 0);

      data = {
        periodo,
        ivaVentas12: Math.round(ivaVentas12 * 100) / 100,
        ivaVentas0: Math.round(ivaVentas0 * 100) / 100,
        totalVentas: Math.round(facturasEmitidas.reduce((s: number, c: any) => s + toNum(c.importe_total), 0) * 100) / 100,
        ivaCompras12: Math.round(ivaCompras12 * 100) / 100,
        ivaCompras0: Math.round(ivaCompras0 * 100) / 100,
        totalCompras: Math.round(facturasRecibidas.reduce((s: number, c: any) => s + toNum(c.importe_total), 0) * 100) / 100,
        retencionIva: Math.round(retencionIva * 100) / 100,
        saldoFavor: Math.round(Math.max(0, ivaCompras12 + retencionIva - ivaVentas12) * 100) / 100,
      };
    } else {
      const ingresos = facturasEmitidas.reduce((s: number, c: any) => s + toNum(c.importe_total), 0);
      const costos = facturasRecibidas.reduce((s: number, c: any) => s + toNum(c.importe_total), 0);
      const ivaCobrado = facturasEmitidas.reduce((s: number, c: any) => s + toNum(c.total_iva), 0);
      const ivaPagado = facturasRecibidas.reduce((s: number, c: any) => s + toNum(c.total_iva), 0);
      const retencionesTotal = retenciones.reduce((s: number, r: any) => s + toNum(r.total_iva), 0);
      const utilidad = ingresos - costos;

      data = {
        periodo,
        ingresos: Math.round(ingresos * 100) / 100,
        costos: Math.round(costos * 100) / 100,
        utilidad: Math.round(utilidad * 100) / 100,
        ivaCobrado: Math.round(ivaCobrado * 100) / 100,
        ivaPagado: Math.round(ivaPagado * 100) / 100,
        retenciones: Math.round(retencionesTotal * 100) / 100,
        impuestoRenta: Math.round(Math.max(0, utilidad * 0.25) * 100) / 100,
      };
    }

    const result = await db.queryOne<any>(
      `INSERT INTO reportes_fiscales (tenant_id, tipo, periodo, data, estado, fecha_generacion, created_at, updated_at)
       VALUES ($1, $2, $3, $4, 'GENERADO', NOW(), NOW(), NOW())
       RETURNING *`,
      [tenantId, tipo, periodo, JSON.stringify(data)]
    );

    return NextResponse.json({
      data: {
        id: result.id,
        tipo: result.tipo,
        periodo: result.periodo,
        estado: result.estado,
        data: data,
        fechaGeneracion: result.fecha_generacion,
        createdAt: result.created_at,
        updatedAt: result.updated_at,
      },
    }, { status: 201 });
  } catch (error: any) {
    console.error('[Post Reporte Error]', error);
    return NextResponse.json(
      { message: error.message || 'Error interno del servidor' },
      { status: error.message?.startsWith('No autorizado') ? 401 : 500 }
    );
  }
}
