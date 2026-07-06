import { NextResponse } from 'next/server';
import { db } from '@/lib/sri-api/db';

export async function GET() {
  try {
    const motivos = await db.queryAll<any>(
      `SELECT id, codigo, descripcion, activo
       FROM motivos_traslado
       WHERE activo = true
       ORDER BY codigo ASC`
    );

    return NextResponse.json({
      data: motivos.map((m: any) => ({
        id: m.id,
        codigo: m.codigo,
        descripcion: m.descripcion,
        activo: Boolean(m.activo),
      })),
    });
  } catch (error: any) {
    console.error('[Get Motivos Traslado Error]', error);
    return NextResponse.json(
      { message: error.message || 'Error interno del servidor' },
      { status: 500 }
    );
  }
}
