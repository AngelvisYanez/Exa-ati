import { NextResponse } from 'next/server';
import { verifyAuth } from '@/lib/sri-api/auth-helper';
import { db } from '@/lib/sri-api/db';
import { getUserRuc } from '@/lib/sri-api/user-resolver';

export async function POST(req: Request) {
  try {
    const user = await verifyAuth(req);
    const userRuc = await getUserRuc(user);
    const { numero } = await req.json();

    if (!numero) {
      return NextResponse.json({ message: 'El número de teléfono es obligatorio' }, { status: 400 });
    }

    // Actualizar base de datos
    await db.query(
      `UPDATE emisores 
       SET whatsapp_numero = ?, whatsapp_estado = 'CONECTADO', updated_at = NOW() 
       WHERE ruc = ? AND activo = 1`,
      [numero, userRuc]
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
