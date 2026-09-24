import { NextResponse } from 'next/server';
import { checkPendingAutorizaciones } from '@/services/sri-api/sri-polling-service';

export const maxDuration = 300;
export const dynamic = 'force-dynamic';

const CRON_SECRET = process.env.CRON_SECRET || '';

export async function GET(req: Request) {
  try {
    if (!CRON_SECRET) {
      console.error('[CRON] CRON_SECRET no configurado — rechazando');
      return NextResponse.json(
        { error: 'CRON_SECRET no configurado en el servidor' },
        { status: 503 }
      );
    }

    const authHeader = req.headers.get('authorization') || '';
    const secret = authHeader.replace('Bearer ', '').trim();

    if (secret !== CRON_SECRET) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    const result = await checkPendingAutorizaciones();

    return NextResponse.json({
      success: true,
      ...result,
      resultados: result.resultados.map((r) => ({
        claveAcceso: r.claveAcceso,
        estadoAnterior: r.estadoAnterior,
        estadoFinal: r.estadoFinal,
        actualizado: r.actualizado,
      })),
    });
  } catch (error: any) {
    console.error('[CRON Error]', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Error interno en CRON SRI check' },
      { status: 500 }
    );
  }
}
