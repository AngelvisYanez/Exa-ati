import { NextResponse } from 'next/server';
import { checkPendingAutorizaciones } from '@/lib/sri-api/sri-polling-service';

export const maxDuration = 300;
export const dynamic = 'force-dynamic';

const CRON_SECRET = process.env.CRON_SECRET || '';

export async function GET(req: Request) {
  try {
    const authHeader = req.headers.get('authorization') || '';
    const secret = authHeader.replace('Bearer ', '').trim();

    if (CRON_SECRET && secret !== CRON_SECRET) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    console.log('[CRON] Iniciando verificación de autorizaciones pendientes (PPR)...');

    const result = await checkPendingAutorizaciones();

    console.log(
      `[CRON] Procesados: ${result.procesados} | ` +
      `Autorizados: ${result.autorizados} | ` +
      `Rechazados: ${result.rechazados} | ` +
      `En Proceso: ${result.enProceso} | ` +
      `Timeouts: ${result.timeouts} | ` +
      `Errores: ${result.errores}`
    );

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
