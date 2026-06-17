import { NextResponse } from 'next/server';
import { verifyAuth } from '@/lib/sri-api/auth-helper';
import { db } from '@/lib/sri-api/db';
import { getUserRuc } from '@/lib/sri-api/user-resolver';

export async function PUT(req: Request) {
  try {
    const user = await verifyAuth(req);
    const userRuc = await getUserRuc(user);
    const { notifDocumentos, notifGeneracion } = await req.json();

    await db.query(
      `UPDATE emisores 
       SET notif_documentos = ?, notif_generacion = ?, updated_at = NOW() 
       WHERE ruc = ? AND activo = 1`,
      [notifDocumentos ? 1 : 0, notifGeneracion ? 1 : 0, userRuc]
    );

    return NextResponse.json({
      success: true,
      message: 'Preferencias de notificaciones de WhatsApp actualizadas correctamente',
      notifDocumentos,
      notifGeneracion
    });
  } catch (error: any) {
    console.error('[WhatsApp Preferences Error]', error);
    return NextResponse.json(
      { message: error.message || 'Error al guardar preferencias de WhatsApp' },
      { status: error.message?.startsWith('No autorizado') ? 401 : 500 }
    );
  }
}
