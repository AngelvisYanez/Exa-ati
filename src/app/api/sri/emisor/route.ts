import { NextResponse } from 'next/server';
import { verifyAuth } from '@/lib/sri-api/auth-helper';
import { db } from '@/lib/sri-api/db';
import { getUserRuc } from '@/lib/sri-api/user-resolver';

export async function GET(req: Request) {
  try {
    const user = await verifyAuth(req);
    const userRuc = await getUserRuc(user, req);

    const emisor = await db.queryOne<any>(
      `SELECT id, ruc, razon_social, nombre_comercial, ambiente, tipo_contribuyente,
              cert_valido_hasta, certificado_valido_hasta 
       FROM emisores WHERE ruc = ? AND activo = true`,
      [userRuc]
    );

    if (!emisor) {
      return NextResponse.json(
        { message: 'Emisor no encontrado para este RUC' },
        { status: 404 }
      );
    }

    // Usar la columna correcta que tenga la fecha de expiración
    const expiryDate = emisor.certificado_valido_hasta || emisor.cert_valido_hasta || null;

    return NextResponse.json({
      success: true,
      emisor: {
        id: emisor.id,
        ruc: emisor.ruc,
        razonSocial: emisor.razon_social,
        nombreComercial: emisor.nombre_comercial,
        tipoContribuyente: emisor.tipo_contribuyente || null,
        ambiente: emisor.ambiente,
        certificadoExpiracion: expiryDate
      }
    });
  } catch (error: any) {
    console.error('[Get Emisor Error]', error);
    return NextResponse.json(
      { message: error.message || 'Error interno del servidor' },
      { status: error.message?.startsWith('No autorizado') ? 401 : 500 }
    );
  }
}
