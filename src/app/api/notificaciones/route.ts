import { NextResponse } from 'next/server';
import { verifyAuth, requireTenantId } from '@/lib/sri-api/auth-helper';
import { db } from '@/lib/sri-api/db';
import { buildNotifications } from '@/lib/sri-api/notifications-engine';
import { getUserRuc } from '@/lib/sri-api/user-resolver';

export async function GET(req: Request) {
  try {
    const user = await verifyAuth(req);
    const userRuc = await getUserRuc(user);

    const { searchParams } = new URL(req.url);
    const fechaDesde = searchParams.get('fechaDesde') || undefined;
    const fechaHasta = searchParams.get('fechaHasta') || undefined;

    const emisor = await db.queryOne<any>(
      `SELECT cert_valido_hasta, certificado_valido_hasta, whatsapp_estado
       FROM emisores WHERE ruc = ? AND activo = true`,
      [userRuc]
    );

    const notifications = await buildNotifications(
      userRuc,
      requireTenantId(user),
      emisor,
      { fechaDesde, fechaHasta }
    );

    return NextResponse.json({
      success: true,
      notifications,
      unreadCount: notifications.filter((n) => n.unread).length,
    });
  } catch (error: any) {
    console.error('[Notificaciones GET Error]', error);
    return NextResponse.json(
      { message: error.message || 'Error al obtener notificaciones' },
      { status: error.message?.startsWith('No autorizado') ? 401 : 500 }
    );
  }
}
