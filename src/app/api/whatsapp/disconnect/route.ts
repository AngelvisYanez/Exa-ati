import { NextResponse } from 'next/server';
import { verifyAuth } from '@/lib/sri-api/auth-helper';
import { db } from '@/lib/sri-api/db';
import { getUserRuc } from '@/lib/sri-api/user-resolver';

export async function POST(req: Request) {
  try {
    const user = await verifyAuth(req);
    const userRuc = await getUserRuc(user);

    // Actualizar base de datos
    await db.query(
      `UPDATE emisores 
       SET whatsapp_numero = NULL, whatsapp_estado = 'DESCONECTADO', updated_at = NOW() 
       WHERE ruc = ? AND activo = 1`,
      [userRuc]
    );

    return NextResponse.json({
      success: true,
      message: 'WhatsApp desvinculado exitosamente',
      estado: 'DESCONECTADO'
    });
  } catch (error: any) {
    console.error('[WhatsApp Disconnect Error]', error);
    return NextResponse.json(
      { message: error.message || 'Error al desconectar WhatsApp' },
      { status: error.message?.startsWith('No autorizado') ? 401 : 500 }
    );
  }
}
