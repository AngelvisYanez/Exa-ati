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
       SET whatsapp_notif_documentos = $1, whatsapp_notif_generacion = $2, updated_at = NOW() 
       WHERE ruc = $3 AND activo = true`,
      [Boolean(notifDocumentos), Boolean(notifGeneracion), userRuc]
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
