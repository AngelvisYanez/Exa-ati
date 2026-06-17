import { NextResponse } from 'next/server';
import { verifyAuth } from '@/lib/sri-api/auth-helper';
import { db } from '@/lib/sri-api/db';
import { getUserRuc } from '@/lib/sri-api/user-resolver';
import qrcode from 'qrcode';

export async function GET(req: Request) {
  try {
    const user = await verifyAuth(req);
    const userRuc = await getUserRuc(user);
    const { searchParams } = new URL(req.url);
    const numeroParam = searchParams.get('numero');

    let emisor = await db.queryOne<any>(
      `SELECT whatsapp_numero FROM emisores WHERE ruc = ? AND activo = 1`,
      [userRuc]
    );

    const numero = numeroParam?.trim() || emisor?.whatsapp_numero;
    if (!numero) {
      return NextResponse.json(
        { message: 'Registra un número de WhatsApp antes de generar el código QR.' },
        { status: 400 }
      );
    }

    if (numeroParam) {
      await db.query(
        `UPDATE emisores SET whatsapp_numero = ?, whatsapp_estado = 'VINCULANDO', updated_at = NOW()
         WHERE ruc = ? AND activo = 1`,
        [numeroParam.trim(), userRuc]
      );
      emisor = { whatsapp_numero: numeroParam.trim() };
    } else {
      await db.query(
        "UPDATE emisores SET whatsapp_estado = 'VINCULANDO', updated_at = NOW() WHERE ruc = ? AND activo = 1",
        [userRuc]
      );
    }

    const bridgeUrl =
      process.env.WHATSAPP_BRIDGE_URL ||
      `https://wa.me/${emisor.whatsapp_numero.replace(/\D/g, '')}?text=${encodeURIComponent(
        `Vincular OFSERCONT IA - RUC ${userRuc}`
      )}`;

    const qrBase64 = await qrcode.toDataURL(bridgeUrl, {
      margin: 1,
      width: 250,
      color: { dark: '#075e54', light: '#ffffff' },
    });

    return NextResponse.json({
      success: true,
      qr: qrBase64,
      sessionCode: bridgeUrl,
    });
  } catch (error: any) {
    console.error('[WhatsApp QR Error]', error);
    return NextResponse.json(
      { message: error.message || 'Error al generar QR de WhatsApp' },
      { status: error.message?.startsWith('No autorizado') ? 401 : 500 }
    );
  }
}
