import { NextResponse } from 'next/server';
import { verifyAuth, requireTenantId } from '@/lib/sri-api/auth-helper';
import { db } from '@/lib/sri-api/db';
import { sincronizarConSri } from '@/lib/sri-api/sync-service';
import { getUserRuc } from '@/lib/sri-api/user-resolver';
import { persistSyncResult, type SyncModo } from '@/lib/sri-api/sync-utils';

export const maxDuration = 300;

const VALID_MODOS: SyncModo[] = ['completo', 'pendientes', 'emitidos', 'recibidos'];

function resolveModo(body: Record<string, unknown>): SyncModo {
  if (typeof body.modo === 'string' && VALID_MODOS.includes(body.modo as SyncModo)) {
    return body.modo as SyncModo;
  }
  return 'completo';
}

export async function POST(req: Request) {
  try {
    const user = await verifyAuth(req);
    const body = await req.json().catch(() => ({}));
    const tenantId = requireTenantId(user);
    const userRuc = await getUserRuc(user);
    const modo = resolveModo(body);

    const result = await sincronizarConSri(tenantId, userRuc, {
      modo,
      estados: body.estados,
      limite: body.limite,
      reintentar: body.reintentar,
      fechaDesde: body.fechaDesde,
      fechaHasta: body.fechaHasta,
      clavesAcceso: body.clavesAcceso,
    });

    await persistSyncResult(tenantId, result);

    await db.query(
      `INSERT INTO auditoria (usuario_email, tenant_id, accion, recurso, descripcion, datos_nuevos, exitoso)
       VALUES (?, ?, 'SINCRONIZAR_SRI', 'comprobantes', ?, ?, ?)`,
      [
        user.email,
        tenantId,
        result.message || `Sync ${modo}`,
        JSON.stringify({ ...result, detalle: result.detalle.slice(0, 50) }),
        result.errores === 0 ? 1 : 0,
      ]
    );

    return NextResponse.json({
      success: true,
      ...result,
      warning: result.warning,
      message: result.message,
    });
  } catch (error: any) {
    console.error('[Sync SRI Error]', error);
    return NextResponse.json(
      { message: error.message || 'Error interno del servidor al sincronizar con SRI' },
      { status: error.message?.startsWith('No autorizado') ? 401 : 500 }
    );
  }
}
