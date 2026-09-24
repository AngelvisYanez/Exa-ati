import { NextRequest, NextResponse } from 'next/server';
import { verifyAuth, requireTenantId } from '@/services/sri-api/auth-helper';
import { db } from '@/services/sri-api/db';
import {
  listarPagosCuenta,
  registrarPagoCobrar,
  obtenerCuentaPorCobrar,
} from '@/services/sri-api/cuentas';
import { embeddings } from '@/services/sri-api/embeddings';

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await verifyAuth(req);
    const tenantId = requireTenantId(user);
    const { id } = await params;

    const cuenta = await obtenerCuentaPorCobrar(tenantId, id);
    if (!cuenta) {
      return NextResponse.json({ message: 'Cuenta no encontrada' }, { status: 404 });
    }

    const pagos = await listarPagosCuenta('COBRAR', id);
    return NextResponse.json({ success: true, data: pagos, cuenta });
  } catch (error: any) {
    console.error('[CxC Pagos List Error]', error);
    return NextResponse.json(
      { message: error.message || 'Error interno' },
      { status: error.message?.startsWith('No autorizado') ? 401 : 500 }
    );
  }
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await verifyAuth(req);
    const tenantId = requireTenantId(user);
    const { id } = await params;
    const body = await req.json();

    if (!body.monto || body.monto <= 0) {
      return NextResponse.json(
        { message: 'El monto del pago debe ser mayor a cero' },
        { status: 400 }
      );
    }

    const result = await registrarPagoCobrar(tenantId, id, {
      fecha: body.fecha || new Date().toISOString().split('T')[0],
      monto: body.monto,
      metodoPago: body.metodoPago || null,
      referencia: body.referencia || null,
      notas: body.notas || null,
    });

    const updated = await db.queryOne<any>('SELECT * FROM cuentas_por_cobrar WHERE id = $1', [id]);
    if (updated) embeddings.maybeIndex(tenantId, 'cuenta_cobrar', id, updated);

    return NextResponse.json({ success: true, ...result });
  } catch (error: any) {
    console.error('[CxC Pago Error]', error);
    return NextResponse.json(
      { message: error.message || 'Error interno' },
      { status: error.message?.startsWith('No autorizado') ? 401 : 500 }
    );
  }
}
