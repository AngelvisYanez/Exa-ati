import { NextResponse } from 'next/server';
import { verifyAuth } from '@/lib/sri-api/auth-helper';
import { config } from '@/lib/sri-api/config';
import jwt from 'jsonwebtoken';
import qrcode from 'qrcode';
import os from 'os';

export async function GET(req: Request) {
  try {
    const user = await verifyAuth(req);

    // 1. Detectar IP Local del servidor en la red LAN
    let localIp = 'localhost';
    const interfaces = os.networkInterfaces();
    for (const name of Object.keys(interfaces)) {
      const net = interfaces[name];
      if (net) {
        for (const item of net) {
          // Filtrar IPv4 y que no sea loopback
          if (item.family === 'IPv4' && !item.internal) {
            localIp = item.address;
            break;
          }
        }
      }
      if (localIp !== 'localhost') break;
    }

    // 2. Generar token JWT persistente para inicio de sesión en móvil
    const mobileToken = jwt.sign(
      {
        sub: user.sub,
        email: user.email,
        rol: user.rol,
        tenantId: user.tenantId
      },
      config.jwt.secret,
      { expiresIn: '30d' } // Validez de 30 días para vinculación
    );

    // 3. Generar enlace de auto-login móvil
    const targetUrl = `http://${localIp}:3000/configuracion?token=${mobileToken}&tab=integraciones`;

    // 4. Generar Código QR en base64 usando la librería 'qrcode'
    const qrDataBase64 = await qrcode.toDataURL(targetUrl, {
      margin: 2,
      width: 300,
      color: {
        dark: '#0f172a', // Navy oscuro de la marca
        light: '#ffffff'
      }
    });

    return NextResponse.json({
      success: true,
      url: targetUrl,
      qr: qrDataBase64,
      localIp
    });
  } catch (error: any) {
    console.error('[Mobile QR Generation Error]', error);
    return NextResponse.json(
      { message: error.message || 'Error interno del servidor al generar el QR móvil' },
      { status: error.message?.startsWith('No autorizado') ? 401 : 500 }
    );
  }
}
