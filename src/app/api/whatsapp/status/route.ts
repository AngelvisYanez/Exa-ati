import { NextResponse } from 'next/server';
import { verifyAuth } from '@/lib/sri-api/auth-helper';
import { db } from '@/lib/sri-api/db';
import { getUserRuc } from '@/lib/sri-api/user-resolver';

export async function GET(req: Request) {
  try {
    const user = await verifyAuth(req);
    const userRuc = await getUserRuc(user);

    const emisor = await db.queryOne<any>(
      `SELECT whatsapp_numero, whatsapp_estado, whatsapp_notif_documentos, whatsapp_notif_generacion 
       FROM emisores WHERE ruc = $1 AND activo = true`,
      [userRuc]
    );

    if (!emisor) {
      return NextResponse.json({ message: 'Emisor no encontrado' }, { status: 404 });
    }

    return NextResponse.json({
      success: true,
      whatsappNumero: emisor.whatsapp_numero,
      whatsappEstado: emisor.whatsapp_estado || 'DESCONECTADO',
      notifDocumentos: !!emisor.whatsapp_notif_documentos,
      notifGeneracion: !!emisor.whatsapp_notif_generacion
    });
  } catch (error: any) {
    console.error('[WhatsApp Status Error]', error);
    return NextResponse.json(
      { message: error.message || 'Error al obtener estado de WhatsApp' },
      { status: error.message?.startsWith('No autorizado') ? 401 : 500 }
    );
  }
}
