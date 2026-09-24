import { NextResponse } from 'next/server';
import { verifyAuth, requireTenantId } from '@/services/sri-api/auth-helper';
import { db } from '@/services/sri-api/db';
import {
  markNotificationsRead,
  syncAndListNotifications,
} from '@/services/sri-api/notifications-engine';
import { getUserRuc } from '@/services/sri-api/user-resolver';

export async function GET(req: Request) {
  try {
    const user = await verifyAuth(req);
    const userRuc = await getUserRuc(user, req);
    const tenantId = requireTenantId(user);

    const { searchParams } = new URL(req.url);
    const fechaDesde = searchParams.get('fechaDesde') || undefined;
    const fechaHasta = searchParams.get('fechaHasta') || undefined;

    const emisor = await db.queryOne<any>(
      `SELECT cert_valido_hasta, certificado_valido_hasta, whatsapp_estado,
              notif_documentos, notif_generacion, notif_email
       FROM emisores WHERE ruc = ? AND activo = true`,
      [userRuc]
    );

    const { notifications, channelsActive } = await syncAndListNotifications(
      userRuc,
      tenantId,
      emisor,
      { fechaDesde, fechaHasta }
    );

    return NextResponse.json({
      success: true,
      notifications,
      unreadCount: notifications.filter((n) => n.unread).length,
      channelsActive,
    });
  } catch (error: any) {
    console.error('[Notificaciones GET Error]', error);
    return NextResponse.json(
      { message: error.message || 'Error al obtener notificaciones' },
      { status: error.message?.startsWith('No autorizado') ? 401 : 500 }
    );
  }
}

export async function PATCH(req: Request) {
  try {
    const user = await verifyAuth(req);
    const tenantId = requireTenantId(user);
    const body = await req.json();

    const updated = await markNotificationsRead(tenantId, {
      ids: Array.isArray(body.ids) ? body.ids.map(String) : undefined,
      all: Boolean(body.all),
    });

    return NextResponse.json({ success: true, updated });
  } catch (error: any) {
    console.error('[Notificaciones PATCH Error]', error);
    return NextResponse.json(
      { message: error.message || 'Error al actualizar notificaciones' },
      { status: error.message?.startsWith('No autorizado') ? 401 : 500 }
    );
  }
}
