import { NextResponse } from 'next/server';
import { verifyAuth } from '@/services/sri-api/auth-helper';
import { db } from '@/services/sri-api/db';
import { ejecutarTrabajoScraping } from '@/services/scraping/job-runner';

// Vercel Pro allows up to 300 seconds for background tasks.
export const maxDuration = 300;
export const dynamic = 'force-dynamic';

/**
 * Compat endpoint: ejecuta el mismo orquestador que /api/sri/scraping.
 * Preferir crear el job vía POST /api/sri/scraping (dispara el runner solo).
 */
export async function POST(req: Request) {
  try {
    const user = await verifyAuth(req);
    const tenantId = user.tenantId;
    if (!tenantId) {
      return NextResponse.json({ message: 'Usuario sin tenant asignado' }, { status: 403 });
    }

    const body = await req.json();
    const jobId = Number(body.jobId);

    if (!jobId) {
      return NextResponse.json({ error: 'Falta jobId' }, { status: 400 });
    }

    const job = await db.queryOne<{ id: number; status: string; tenant_id: string | null }>(
      'SELECT id, status, tenant_id FROM scraping_jobs WHERE id = $1',
      [jobId]
    );
    if (!job) {
      return NextResponse.json({ error: 'Job no encontrado' }, { status: 404 });
    }
    if (job.tenant_id !== tenantId) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 403 });
    }

    if (job.status !== 'PENDING' && job.status !== 'ERROR') {
      return NextResponse.json(
        { error: `El job ya está en proceso o finalizado (${job.status})` },
        { status: 400 }
      );
    }

    const result = await ejecutarTrabajoScraping(jobId);
    if (!result.success) {
      const status = result.message.includes('ya está en estado') ? 400 : 500;
      return NextResponse.json({ success: false, error: result.message }, { status });
    }

    return NextResponse.json({ success: true, message: result.message });
  } catch (error: any) {
    const isAuthError = error.message?.includes('No autorizado');
    return NextResponse.json(
      { success: false, error: isAuthError ? error.message : error.message },
      { status: isAuthError ? 401 : 500 }
    );
  }
}
