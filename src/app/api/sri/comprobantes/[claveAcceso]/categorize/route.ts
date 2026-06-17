import { NextResponse } from 'next/server';
import { verifyAuth } from '@/lib/sri-api/auth-helper';
import { db } from '@/lib/sri-api/db';

export async function PUT(
  req: Request,
  { params }: { params: Promise<{ claveAcceso: string }> }
) {
  try {
    const user = await verifyAuth(req);
    const { claveAcceso } = await params;
    const { categoria } = await req.json();

    if (!categoria) {
      return NextResponse.json(
        { message: 'La propiedad "categoria" es obligatoria' },
        { status: 400 }
      );
    }

    // Buscar comprobante y verificar pertenencia al tenant
    const doc = await db.queryOne(
      'SELECT id, tenant_id FROM comprobantes WHERE clave_acceso = ?',
      [claveAcceso]
    );

    if (!doc) {
      return NextResponse.json(
        { message: 'Comprobante no encontrado' },
        { status: 404 }
      );
    }

    if (doc.tenant_id !== user.tenantId) {
      return NextResponse.json(
        { message: 'No tienes permisos para modificar este comprobante' },
        { status: 403 }
      );
    }

    // Actualizar categoría
    await db.query(
      'UPDATE comprobantes SET categoria = ?, updated_at = NOW() WHERE clave_acceso = ?',
      [categoria, claveAcceso]
    );

    return NextResponse.json({
      success: true,
      message: 'Categoría actualizada correctamente',
      claveAcceso,
      categoria
    });
  } catch (error: any) {
    console.error('[Categorize Comprobante Error]', error);
    return NextResponse.json(
      { message: error.message || 'Error interno del servidor al categorizar' },
      { status: error.message?.startsWith('No autorizado') ? 401 : 500 }
    );
  }
}
