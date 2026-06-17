import { NextResponse } from 'next/server';
import { verifyAuth, requireTenantId } from '@/lib/sri-api/auth-helper';
import { db } from '@/lib/sri-api/db';
import { getUserRuc } from '@/lib/sri-api/user-resolver';

export async function GET(req: Request) {
  try {
    const user = await verifyAuth(req);
    const tenantId = requireTenantId(user);

    const settings = await db.queryOne<any>(
      `SELECT last_sync_at, last_sync_result FROM tenant_settings WHERE tenant_id = ?`,
      [tenantId]
    );

    const userRuc = await getUserRuc(user);

    const counts = await db.queryOne<any>(
      `SELECT
         COUNT(*) AS total,
         SUM(CASE WHEN emisor_ruc = ? THEN 1 ELSE 0 END) AS emitidos,
         SUM(CASE WHEN receptor_identificacion = ? AND emisor_ruc != ? THEN 1 ELSE 0 END) AS recibidos,
         SUM(CASE WHEN estado IN ('PENDIENTE','FIRMADO','ENVIADO') THEN 1 ELSE 0 END) AS pendientes
       FROM comprobantes
       WHERE tenant_id = ? OR emisor_ruc = ? OR receptor_identificacion = ?`,
      [userRuc, userRuc, userRuc, tenantId, userRuc, userRuc]
    );

    let lastSync = null;
    if (settings?.last_sync_result) {
      try {
        lastSync =
          typeof settings.last_sync_result === 'string'
            ? JSON.parse(settings.last_sync_result)
            : settings.last_sync_result;
      } catch {
        lastSync = null;
      }
    }

    return NextResponse.json({
      success: true,
      ruc: userRuc,
      lastSyncAt: settings?.last_sync_at || null,
      lastSync,
      counts: {
        total: Number(counts?.total || 0),
        emitidos: Number(counts?.emitidos || 0),
        recibidos: Number(counts?.recibidos || 0),
        pendientes: Number(counts?.pendientes || 0),
      },
    });
  } catch (error: any) {
    return NextResponse.json(
      { message: error.message || 'Error al obtener estado de sync' },
      { status: error.message?.startsWith('No autorizado') ? 401 : 500 }
    );
  }
}
