import { NextResponse } from 'next/server';
import { verifyAuth, requireTenantId } from '@/lib/sri-api/auth-helper';
import { db } from '@/lib/sri-api/db';
import { fetchTenantComprobantes } from '@/lib/sri-api/audit-engine';
import { calculateTaxSummary } from '@/lib/sri-api/tax-calculator';
import { getUserRuc } from '@/lib/sri-api/user-resolver';

export async function POST(req: Request) {
  try {
    const user = await verifyAuth(req);
    const userRuc = await getUserRuc(user);

    const emisor = await db.queryOne<any>(
      `SELECT razon_social, whatsapp_numero, whatsapp_estado, notif_documentos, notif_generacion 
       FROM emisores WHERE ruc = ? AND activo = 1`,
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
*OFSERCONT IA - NOTIFICACION SRI*
Fecha: ${nowStr}

Hola *${emisor.razon_social}*, te enviamos el resumen de tu declaración de IVA:

*IVA Ventas*: $${summary.totalVentasIva.toFixed(2)}
*Credito IVA Compras*: $${summary.totalComprasIva.toFixed(2)}
*Retenciones Recibidas*: $${summary.totalRetencionesImporte.toFixed(2)}
-------------------------------
*Total Neto IVA a Pagar*: *$${summary.ivaAPagarNeto.toFixed(2)}*

_Recuerda que tu declaración vence en los próximos días. Si deseas autorizar la presentación automática del formulario 104A del SRI responde "Sí, presenta" en este chat._
    `.trim();

    const whatsappApiUrl = process.env.WHATSAPP_API_URL;
    if (!whatsappApiUrl) {
      return NextResponse.json(
        {
          message:
            'WHATSAPP_API_URL no está configurada. Define la URL del gateway de WhatsApp en .env.local.',
        },
        { status: 503 }
      );
    }

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
        message: formattedMessage,
        ruc: userRuc,
      }),
    });

    if (!apiResponse.ok) {
      const errText = await apiResponse.text().catch(() => 'Error desconocido');
      return NextResponse.json(
        { message: `Error del gateway WhatsApp: ${errText}` },
        { status: 502 }
      );
    }

    await db.query(
      `INSERT INTO auditoria (usuario_email, tenant_id, accion, recurso, descripcion, datos_nuevos, exitoso)
       VALUES (?, ?, 'WHATSAPP_NOTIFICACION', 'whatsapp', ?, ?, 1)`,
      [
        userRuc,
        tenantId,
        `Notificación enviada a ${emisor.whatsapp_numero}`,
        JSON.stringify({ recipient: emisor.whatsapp_numero, ivaAPagar: summary.ivaAPagarNeto }),
      ]
    );

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
