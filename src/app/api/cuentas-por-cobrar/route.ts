import { NextRequest, NextResponse } from 'next/server';
import { verifyAuth, requireTenantId } from '@/services/sri-api/auth-helper';
import {
  crearCuentaPorCobrar,
  listarCuentasPorCobrar,
  obtenerResumenCuentas,
  marcarVencidas,
} from '@/services/sri-api/cuentas';
import { embeddings } from '@/services/sri-api/embeddings';
import { db } from '@/services/sri-api/db';
import { requireModule } from '@/services/sri-api/rbac';

export async function GET(req: NextRequest) {
  try {
    const user = await verifyAuth(req);
    await requireModule(user, 'cuentas-por-cobrar');
    const tenantId = requireTenantId(user);
    const { searchParams } = new URL(req.url);

    const resumen = searchParams.get('resumen') === 'true';
    if (resumen) {
      const data = await obtenerResumenCuentas(tenantId);
      return NextResponse.json({ success: true, ...data });
    }

    await marcarVencidas(tenantId).catch(() => {});

    const { rows, total } = await listarCuentasPorCobrar(tenantId, {
      estado: searchParams.get('estado') || undefined,
      identificacion: searchParams.get('identificacion') || undefined,
      desde: searchParams.get('desde') || undefined,
      hasta: searchParams.get('hasta') || undefined,
      limite: Math.min(parseInt(searchParams.get('limite') || '100', 10), 500),
      offset: parseInt(searchParams.get('offset') || '0', 10),
    });

    return NextResponse.json({ success: true, data: rows, total });
  } catch (error: any) {
    console.error('[CxC List Error]', error);
    return NextResponse.json(
      { message: error.message || 'Error interno' },
      { status: error.message?.startsWith('No autorizado') ? 401 : 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const user = await verifyAuth(req);
    await requireModule(user, 'cuentas-por-cobrar');
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
        { message: 'Faltan datos del cliente: identificacion, nombre' },
        { status: 400 }
      );
    }

    const cuenta = await crearCuentaPorCobrar(tenantId, {
      contactoId: body.contactoId || null,
      comprobanteId: body.comprobanteId || null,
      tipoIdentificacion: body.tipoIdentificacion || '05',
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
      const row = await db.queryOne<any>('SELECT * FROM cuentas_por_cobrar WHERE id = $1', [cuenta.id]);
      if (row) embeddings.maybeIndex(tenantId, 'cuenta_cobrar', cuenta.id, row);
    }

    return NextResponse.json({ success: true, id: cuenta?.id }, { status: 201 });
  } catch (error: any) {
    console.error('[CxC Create Error]', error);
    return NextResponse.json(
      { message: error.message || 'Error interno' },
      { status: error.message?.startsWith('No autorizado') ? 401 : 500 }
    );
  }
}
