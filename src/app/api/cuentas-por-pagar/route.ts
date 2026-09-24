import { NextRequest, NextResponse } from 'next/server';
import { verifyAuth, requireTenantId } from '@/services/sri-api/auth-helper';
import {
  crearCuentaPorPagar,
  listarCuentasPorPagar,
  obtenerResumenCuentas,
  marcarVencidas,
} from '@/services/sri-api/cuentas';
import { embeddings } from '@/services/sri-api/embeddings';
import { db } from '@/services/sri-api/db';

export async function GET(req: NextRequest) {
  try {
    const user = await verifyAuth(req);
    const tenantId = requireTenantId(user);
    const { searchParams } = new URL(req.url);

    const resumen = searchParams.get('resumen') === 'true';
    if (resumen) {
      const data = await obtenerResumenCuentas(tenantId);
      return NextResponse.json({ success: true, ...data });
    }

    await marcarVencidas(tenantId).catch(() => {});

    const { rows, total } = await listarCuentasPorPagar(tenantId, {
      estado: searchParams.get('estado') || undefined,
      identificacion: searchParams.get('identificacion') || undefined,
      desde: searchParams.get('desde') || undefined,
      hasta: searchParams.get('hasta') || undefined,
      limite: Math.min(parseInt(searchParams.get('limite') || '100', 10), 500),
      offset: parseInt(searchParams.get('offset') || '0', 10),
    });

    return NextResponse.json({ success: true, data: rows, total });
  } catch (error: any) {
    console.error('[CxP List Error]', error);
    return NextResponse.json(
      { message: error.message || 'Error interno' },
      { status: error.message?.startsWith('No autorizado') ? 401 : 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const user = await verifyAuth(req);
    const tenantId = requireTenantId(user);
    const body = await req.json();

    if (!body.fechaEmision || !body.monto || body.monto <= 0) {
      return NextResponse.json(
        { message: 'Faltan campos requeridos: fechaEmision, monto (mayor a 0)' },
        { status: 400 }
      );
    }

    if (!body.identificacion || !body.nombre) {
      return NextResponse.json(
        { message: 'Faltan datos del proveedor: identificacion, nombre' },
        { status: 400 }
      );
    }

    const cuenta = await crearCuentaPorPagar(tenantId, {
      contactoId: body.contactoId || null,
      comprobanteId: body.comprobanteId || null,
      tipoIdentificacion: body.tipoIdentificacion || '04',
      identificacion: body.identificacion,
      nombre: body.nombre,
      email: body.email || null,
      tipoDocumento: body.tipoDocumento || '01',
      numeroDocumento: body.numeroDocumento || null,
      fechaEmision: body.fechaEmision,
      fechaVencimiento: body.fechaVencimiento || null,
      monto: body.monto,
      notas: body.notas || null,
    });

    if (cuenta?.id) {
      const row = await db.queryOne<any>('SELECT * FROM cuentas_por_pagar WHERE id = $1', [cuenta.id]);
      if (row) embeddings.maybeIndex(tenantId, 'cuenta_pagar', cuenta.id, row);
    }

    return NextResponse.json({ success: true, id: cuenta?.id }, { status: 201 });
  } catch (error: any) {
    console.error('[CxP Create Error]', error);
    return NextResponse.json(
      { message: error.message || 'Error interno' },
      { status: error.message?.startsWith('No autorizado') ? 401 : 500 }
    );
  }
}
