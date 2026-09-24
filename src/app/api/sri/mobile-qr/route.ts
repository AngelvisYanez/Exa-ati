import { NextResponse } from 'next/server';
import { verifyAuth } from '@/services/sri-api/auth-helper';
import { createMobileCode } from '@/services/sri-api/mobile-code-store';
import qrcode from 'qrcode';
import os from 'os';

export async function GET(req: Request) {
  try {
    const user = await verifyAuth(req);

    let localIp = 'localhost';
    const interfaces = os.networkInterfaces();
    for (const name of Object.keys(interfaces)) {
      const net = interfaces[name];
      if (net) {
        for (const item of net) {
          if (item.family === 'IPv4' && !item.internal) {
            localIp = item.address;
            break;
          }
        }
      }
      if (localIp !== 'localhost') break;
    }

    const code = createMobileCode({
      userId: user.sub,
      email: user.email,
      rol: user.rol,
      tenantId: user.tenantId ?? undefined,
    });

    const appUrl =
      process.env.NEXT_PUBLIC_APP_URL ||
      process.env.APP_URL ||
      (() => {
        try {
          return new URL(req.url).origin;
        } catch {
          return `http://${localIp}:3000`;
        }
      })();

    const base = String(appUrl).replace(/\/$/, '');
    const targetUrl = `${base}/mobile?code=${code}`;

    const qrDataBase64 = await qrcode.toDataURL(targetUrl, {
      margin: 2,
      width: 300,
      color: {
        dark: '#0f172a',
        light: '#ffffff',
      },
    });

    return NextResponse.json({
      success: true,
      url: targetUrl,
      qr: qrDataBase64,
      localIp,
      expiresInMinutes: 10,
    });
  } catch (error: any) {
    console.error('[Mobile QR Generation Error]', error);
    return NextResponse.json(
      { message: error.message || 'Error interno del servidor al generar el QR móvil' },
      { status: error.message?.startsWith('No autorizado') ? 401 : 500 }
    );
  }
}
