import { NextRequest, NextResponse } from 'next/server';
import { verifyAuth, requireTenantId } from '@/services/sri-api/auth-helper';
import { db } from '@/services/sri-api/db';
import {
  obtenerCuentaPorCobrar,
  anularCuentaPorCobrar,
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

    return NextResponse.json({ success: true, data: cuenta });
  } catch (error: any) {
    console.error('[CxC Detail Error]', error);
    return NextResponse.json(
      { message: error.message || 'Error interno' },
      { status: error.message?.startsWith('No autorizado') ? 401 : 500 }
    );
  }
}

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await verifyAuth(req);
    const tenantId = requireTenantId(user);
    const { id } = await params;
    const body = await req.json();

    const cuenta = await obtenerCuentaPorCobrar(tenantId, id);
    if (!cuenta) {
      return NextResponse.json({ message: 'Cuenta no encontrada' }, { status: 404 });
    }
    if (cuenta.estado === 'ANULADO') {
      return NextResponse.json({ message: 'No se puede editar una cuenta anulada' }, { status: 400 });
    }

    const payload: Record<string, any> = {
      updated_at: new Date(),
    };
    if (body.fechaVencimiento !== undefined) payload.fecha_vencimiento = body.fechaVencimiento;
    if (body.notas !== undefined) payload.notas = body.notas;
    if (body.tipoDocumento !== undefined) payload.tipo_documento = body.tipoDocumento;
    if (body.numeroDocumento !== undefined) payload.numero_documento = body.numeroDocumento;
    if (body.estado !== undefined && ['PENDIENTE', 'ANULADO'].includes(body.estado)) {
      payload.estado = body.estado;
    }

    await db.update('cuentas_por_cobrar', payload, 'tenant_id = $1 AND id = $2', [tenantId, id]);

    const updated = await db.queryOne<any>('SELECT * FROM cuentas_por_cobrar WHERE id = $1', [id]);
    if (updated) embeddings.maybeIndex(tenantId, 'cuenta_cobrar', id, updated);

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('[CxC Update Error]', error);
    return NextResponse.json(
      { message: error.message || 'Error interno' },
      { status: error.message?.startsWith('No autorizado') ? 401 : 500 }
    );
  }
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await verifyAuth(req);
    const tenantId = requireTenantId(user);
    const { id } = await params;

    const cuenta = await obtenerCuentaPorCobrar(tenantId, id);
    if (!cuenta) {
      return NextResponse.json({ message: 'Cuenta no encontrada' }, { status: 404 });
    }

    // Si tiene pagos registrados se anula; si no, se elimina
    const pago = await db.queryOne<any>(
      'SELECT id FROM pagos_cuentas WHERE tipo_cuenta = $1 AND cuenta_cobrar_id = $2 LIMIT 1',
      ['COBRAR', id]
    );

    if (pago) {
      await anularCuentaPorCobrar(tenantId, id);
      const updated = await db.queryOne<any>('SELECT * FROM cuentas_por_cobrar WHERE id = $1', [id]);
      if (updated) embeddings.maybeIndex(tenantId, 'cuenta_cobrar', id, updated);
      return NextResponse.json({ success: true, anulada: true });
    }

    await db.query(
      'DELETE FROM cuentas_por_cobrar WHERE tenant_id = $1 AND id = $2',
      [tenantId, id]
    );
    embeddings.maybeUnindex(tenantId, 'cuenta_cobrar', id);

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('[CxC Delete Error]', error);
    return NextResponse.json(
      { message: error.message || 'Error interno' },
      { status: error.message?.startsWith('No autorizado') ? 401 : 500 }
    );
  }
}
