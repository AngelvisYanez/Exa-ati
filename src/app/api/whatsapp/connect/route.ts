import { NextResponse } from 'next/server';
import { verifyAuth } from '@/lib/sri-api/auth-helper';
import { db } from '@/lib/sri-api/db';
import { getUserRuc } from '@/lib/sri-api/user-resolver';

export async function POST(req: Request) {
  try {
    const user = await verifyAuth(req);
    const userRuc = await getUserRuc(user);

    // Read number from body if provided, otherwise use already-saved number
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

    await db.query(
      `UPDATE emisores 
       SET whatsapp_estado = 'CONECTADO', updated_at = NOW() 
       WHERE ruc = $1 AND activo = true`,
      [userRuc]
    );

    return NextResponse.json({
      success: true,
      message: 'WhatsApp vinculado exitosamente',
      numero,
      estado: 'CONECTADO'
    });
  } catch (error: any) {
    console.error('[WhatsApp Connect Error]', error);
    return NextResponse.json(
      { message: error.message || 'Error al conectar WhatsApp' },
      { status: error.message?.startsWith('No autorizado') ? 401 : 500 }
    );
  }
}
