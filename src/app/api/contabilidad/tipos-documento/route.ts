import { NextResponse } from 'next/server';
import { db } from '@/lib/sri-api/db';

export async function GET() {
  try {
    const tipos = await db.queryAll<any>(
      `SELECT id, codigo, descripcion, activo
       FROM tipos_documento_sri
       WHERE activo = true
       ORDER BY codigo ASC`
    );

    return NextResponse.json({
      data: tipos.map((t: any) => ({
        id: t.id,
        codigo: t.codigo,
        descripcion: t.descripcion,
        activo: Boolean(t.activo),
      })),
    });
  } catch (error: any) {
    console.error('[Get Tipos Documento Error]', error);
    return NextResponse.json(
      { message: error.message || 'Error interno del servidor' },
      { status: 500 }
    );
  }
}
