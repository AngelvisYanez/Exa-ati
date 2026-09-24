import { NextResponse } from 'next/server';
import { verifyAuth } from '@/services/sri-api/auth-helper';
import { db } from '@/services/sri-api/db';
import { getUserRuc } from '@/services/sri-api/user-resolver';

function resolveConnectUrl(): string | null {
  if (process.env.WHATSAPP_CONNECT_URL) {
    return process.env.WHATSAPP_CONNECT_URL;
  }
  const base = process.env.WHATSAPP_API_URL;
  if (!base) return null;
  try {
    const url = new URL(base);
    url.pathname = url.pathname.replace(/\/sendText\/?$/i, '/connect').replace(/\/$/, '') || '/connect';
    if (!url.pathname.endsWith('/connect')) {
      url.pathname = `${url.pathname.replace(/\/$/, '')}/connect`;
    }
    return url.toString();
  } catch {
    return base.replace(/\/sendText\/?$/i, '/connect');
  }
}

export async function POST(req: Request) {
  try {
    const user = await verifyAuth(req);
    const userRuc = await getUserRuc(user);

    let { numero } = await req.json().catch(() => ({}));
    if (!numero) {
      const emisor = await db.queryOne<any>(
        `SELECT whatsapp_numero FROM emisores WHERE ruc = $1 AND activo = true`,
        [userRuc]
      );
      numero = emisor?.whatsapp_numero;
    }

    if (!numero) {
      return NextResponse.json({ message: 'Primero genera un código QR con tu número' }, { status: 400 });
    }

    const connectUrl = resolveConnectUrl();
    if (!connectUrl) {
      return NextResponse.json(
        {
          message:
            'Servicio WhatsApp no configurado. Define WHATSAPP_API_URL o WHATSAPP_CONNECT_URL en el servidor.',
        },
        { status: 503 }
      );
    }

    const bridgeRes = await fetch(connectUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(process.env.WHATSAPP_API_TOKEN
          ? { Authorization: `Bearer ${process.env.WHATSAPP_API_TOKEN}` }
          : {}),
      },
      body: JSON.stringify({ numero, ruc: userRuc }),
    });

    const bridgeData = await bridgeRes.json().catch(() => ({}));

    if (!bridgeRes.ok) {
      const msg =
        bridgeData.message ||
        bridgeData.error ||
        `El bridge WhatsApp respondió con error (${bridgeRes.status})`;
      return NextResponse.json({ message: msg }, { status: bridgeRes.status >= 500 ? 502 : 400 });
    }

    const estadoBridge = String(bridgeData.estado || bridgeData.status || '').toUpperCase();
    let nuevoEstado: string;

    if (estadoBridge === 'CONECTADO' || estadoBridge === 'CONNECTED' || bridgeData.ok === true) {
      nuevoEstado = 'CONECTADO';
    } else if (
      estadoBridge === 'PENDIENTE' ||
      estadoBridge === 'PENDING' ||
      bridgeData.qr ||
      bridgeData.requiresQr
    ) {
      nuevoEstado = 'PENDIENTE';
    } else {
      return NextResponse.json(
        {
          message:
            bridgeData.message ||
            'El bridge no confirmó la conexión. Revisa el servicio WhatsApp.',
          bridge: bridgeData,
        },
        { status: 502 }
      );
    }

    await db.query(
      `UPDATE emisores
       SET whatsapp_numero = $1, whatsapp_estado = $2, updated_at = NOW()
       WHERE ruc = $3 AND activo = true`,
      [numero, nuevoEstado, userRuc]
    );

    return NextResponse.json({
      success: true,
      message:
        nuevoEstado === 'CONECTADO'
          ? 'WhatsApp vinculado exitosamente'
          : 'Esperando escaneo de QR en el bridge WhatsApp',
      numero,
      estado: nuevoEstado,
      qr: bridgeData.qr || null,
    });
  } catch (error: any) {
    console.error('[WhatsApp Connect Error]', error);
    return NextResponse.json(
      { message: error.message || 'Error al conectar WhatsApp' },
      { status: error.message?.startsWith('No autorizado') ? 401 : 500 }
    );
  }
}
