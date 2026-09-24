import { db } from './db';

export type NotificationType = 'documentos' | 'generacion';

export async function sendWhatsAppAlert(
  tenantId: string,
  userRuc: string,
  message: string,
  type: NotificationType
): Promise<boolean> {
  try {
    const emisor = await db.queryOne<any>(
      `SELECT whatsapp_numero, whatsapp_estado,
              whatsapp_notif_documentos, whatsapp_notif_generacion,
              notif_documentos, notif_generacion
       FROM emisores WHERE ruc = $1 AND tenant_id = $2 AND activo = true`,
      [userRuc, tenantId]
    );

    if (!emisor || emisor.whatsapp_estado !== 'CONECTADO' || !emisor.whatsapp_numero) {
      return false;
    }

    const allowDocumentos =
      emisor.whatsapp_notif_documentos ?? emisor.notif_documentos;
    const allowGeneracion =
      emisor.whatsapp_notif_generacion ?? emisor.notif_generacion;

    if (type === 'documentos' && !allowDocumentos) return false;
    if (type === 'generacion' && !allowGeneracion) return false;

    const whatsappApiUrl = process.env.WHATSAPP_API_URL || 'http://localhost:8000/sendText';
    
    const apiResponse = await fetch(whatsappApiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(process.env.WHATSAPP_API_TOKEN
          ? { Authorization: `Bearer ${process.env.WHATSAPP_API_TOKEN}` }
          : {}),
      },
      body: JSON.stringify({
        to: emisor.whatsapp_numero,
        message,
        ruc: userRuc,
      }),
    });

    if (!apiResponse.ok) {
      const errText = await apiResponse.text().catch(() => 'Unknown error');
      console.error('[WhatsApp Service] Error sending message:', errText);
      return false;
    }

    await db.query(
      `INSERT INTO auditoria (usuario_email, tenant_id, accion, recurso, descripcion, datos_nuevos, exitoso)
       VALUES ($1, $2, 'WHATSAPP_NOTIFICACION', 'whatsapp', $3, $4, 1)`,
      [
        userRuc,
        tenantId,
        `Notificación automática enviada a ${emisor.whatsapp_numero}`,
        JSON.stringify({ recipient: emisor.whatsapp_numero, type }),
      ]
    );

    return true;
  } catch (error) {
    console.error('[WhatsApp Service] Exception:', error);
    return false;
  }
}
