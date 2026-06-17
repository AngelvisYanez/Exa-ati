import { NextResponse } from 'next/server';
import { verifyAuth } from '@/lib/sri-api/auth-helper';
import { db } from '@/lib/sri-api/db';
import { getUserRuc } from '@/lib/sri-api/user-resolver';
import { sriSoapClient } from '@/lib/sri-api/sri-soap-client';

export async function POST(req: Request) {
  try {
    const user = await verifyAuth(req);
    const userRuc = await getUserRuc(user);

    const emisor = await db.queryOne<any>(
      `SELECT ambiente FROM emisores WHERE ruc = ? AND activo = true`,
      [userRuc]
    );

    if (!emisor) {
      return NextResponse.json(
        { message: 'Emisor no encontrado para este RUC' },
        { status: 404 }
      );
    }

    const ambiente = emisor.ambiente || '1'; // '1' = Pruebas, '2' = Producción
    const testResult = await sriSoapClient.testConnection(ambiente);

    return NextResponse.json({
      success: testResult.success,
      recepcion: testResult.recepcion,
      autorizacion: testResult.autorizacion,
      ambiente: ambiente === '2' ? 'Producción' : 'Pruebas',
      error: testResult.error,
    });
  } catch (error: any) {
    console.error('[Test SRI Connection Error]', error);
    return NextResponse.json(
      { message: error.message || 'Error interno al validar conexión con el SRI' },
      { status: error.message?.startsWith('No autorizado') ? 401 : 500 }
    );
  }
}
