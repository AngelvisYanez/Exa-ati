import { NextResponse } from 'next/server';
import { verifyAuth, requireTenantId } from '@/services/sri-api/auth-helper';
import { sendWhatsAppAlert } from '@/services/sri-api/whatsapp-service';
import { db } from '@/services/sri-api/db';
import { fetchTenantComprobantes } from '@/services/sri-api/audit-engine';
import { calculateTaxSummary } from '@/services/sri-api/tax-calculator';
import { getUserRuc } from '@/services/sri-api/user-resolver';

export async function POST(req: Request) {
  try {
    const user = await verifyAuth(req);
    const userRuc = await getUserRuc(user);

    const emisor = await db.queryOne<any>(
      `SELECT razon_social, whatsapp_numero, whatsapp_estado, notif_documentos, notif_generacion 
       FROM emisores WHERE ruc = ? AND activo = true`,
      [userRuc]
    );

    if (!emisor || emisor.whatsapp_estado !== 'CONECTADO') {
      return NextResponse.json(
        { message: 'WhatsApp no está vinculado. Por favor escanea el código QR primero.' },
        { status: 400 }
      );
    }

    const tenantId = requireTenantId(user);
    const comprobantes = await fetchTenantComprobantes(tenantId, userRuc);
    const summary = calculateTaxSummary(comprobantes, userRuc);

    const nowStr = new Date().toLocaleDateString('es-EC', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    });

    const formattedMessage = `
🤖 *OFSERCONT IA | Notificación Tributaria* 
🗓️ *Fecha:* ${nowStr}

Hola *${emisor.razon_social}* 👋,
Te enviamos el resumen actualizado para tu próxima declaración de IVA:

📊 *RESUMEN DE IMPUESTOS*
📈 *Ventas (IVA cobrado):* $${summary.totalVentasIva.toFixed(2)}
📉 *Compras (Crédito Tributario):* $${summary.totalComprasIva.toFixed(2)}
✂️ *Retenciones Recibidas:* $${summary.totalRetencionesImporte.toFixed(2)}
━━━━━━━━━━━━━━━━━━━━
💰 *Total Estimado a Pagar al SRI:* *$${summary.ivaAPagarNeto.toFixed(2)}*

⚠️ _Recuerda que tu declaración vence en los próximos días._

🤖 *¿Deseas que me encargue de esto?*
Responde *"Sí, presenta"* en este chat y yo me encargaré de subir automáticamente tu formulario 104 al SRI. ¡Fácil y rápido! 🚀
    `.trim();

    const success = await sendWhatsAppAlert(tenantId, userRuc, formattedMessage, 'generacion');

    if (!success) {
      return NextResponse.json(
        { message: 'El servicio gateway de WhatsApp no se encuentra activo en el puerto 8000. Ejecute "npm run worker:whatsapp" en su servidor local o configure WHATSAPP_API_URL en el archivo .env.' },
        { status: 502 }
      );
    }

    return NextResponse.json({
      success: true,
      message: 'Notificación enviada exitosamente a WhatsApp',
      recipient: emisor.whatsapp_numero,
      content: formattedMessage,
    });
  } catch (error: any) {
    console.error('[WhatsApp Send Test Error]', error);
    return NextResponse.json(
      { message: error.message || 'Error al enviar notificación de WhatsApp' },
      { status: error.message?.startsWith('No autorizado') ? 401 : 500 }
    );
  }
}
