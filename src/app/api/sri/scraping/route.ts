import { NextResponse } from 'next/server';
import { db } from '@/services/sri-api/db';
import { verifyAuth } from '@/services/sri-api/auth-helper';
import { encryption } from '@/services/sri-api/encryption';
import { ejecutarTrabajoScraping } from '@/services/scraping/job-runner';
import { isSriScrapeAction } from '@/services/scraping/sri-scrape-actions';

export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  try {
    const user = await verifyAuth(req);
    const tenantId = user.tenantId;
    if (!tenantId) {
      return NextResponse.json({ message: 'Usuario sin tenant asignado' }, { status: 403 });
    }

    const body = await req.json();
    const { ruc, clave_sri, fecha_desde, fecha_hasta, tipo_comprobante, action_type, options } = body;

    if (!ruc || !fecha_desde || !fecha_hasta) {
      return NextResponse.json(
        { error: 'Faltan parámetros requeridos (RUC, fecha_desde, fecha_hasta)' },
        { status: 400 }
      );
    }

    const finalActionType = action_type || 'DOWNLOAD_RECEIVED';
    if (!isSriScrapeAction(finalActionType)) {
      return NextResponse.json(
        {
          error:
            'action_type inválido. Use DOWNLOAD_RECEIVED|DOWNLOAD_EMITTED|DOWNLOAD_BOTH|SCRAPE_RETENCIONES|SCRAPE_DECLARACIONES|SCRAPE_OBLIGACIONES|SCRAPE_ATS',
        },
        { status: 400 }
      );
    }

    const needsTipo =
      finalActionType === 'DOWNLOAD_RECEIVED' ||
      finalActionType === 'DOWNLOAD_EMITTED' ||
      finalActionType === 'DOWNLOAD_BOTH' ||
      finalActionType === 'SCRAPE_ATS';

    let resolvedTipo = tipo_comprobante;
    if (finalActionType === 'SCRAPE_RETENCIONES') {
      resolvedTipo = '6';
    } else if (
      finalActionType === 'SCRAPE_DECLARACIONES' ||
      finalActionType === 'SCRAPE_OBLIGACIONES'
    ) {
      resolvedTipo = tipo_comprobante || 'todos';
    }

    if (needsTipo && !resolvedTipo) {
      return NextResponse.json(
        { error: 'El tipo de comprobante es obligatorio para descargas' },
        { status: 400 }
      );
    }

    const validTipos = ['1', '2', '3', '4', '6', 'todos'];
    if (resolvedTipo && !validTipos.includes(resolvedTipo)) {
      return NextResponse.json(
        { error: 'Tipo de comprobante inválido' },
        { status: 400 }
      );
    }

    const optionsStr = options && typeof options === 'object' ? JSON.stringify(options) : undefined;

    let finalClaveSri = clave_sri;
    if (!finalClaveSri) {
      const emisor = await db.queryOne<any>(
        'SELECT clave_sri_encrypted FROM emisores WHERE ruc = $1 AND tenant_id = $2 AND activo = true',
        [ruc, tenantId]
      );
      if (emisor?.clave_sri_encrypted) {
        finalClaveSri = await encryption.decrypt(emisor.clave_sri_encrypted);
      }
    }

    const jobData: Record<string, any> = {
      ruc,
      fecha_desde,
      fecha_hasta,
      tipo_comprobante: resolvedTipo || 'todos',
      status: 'PENDING',
      action_type: finalActionType,
      tenant_id: tenantId,
      updated_at: new Date(),
      created_at: new Date(),
    };
    if (finalClaveSri) {
      jobData.clave_sri = finalClaveSri;
    }
    if (optionsStr !== undefined) {
      jobData.options = optionsStr;
    }

    const insertedJob = await db.insert('scraping_jobs', jobData, 'id');
    const jobId = insertedJob ? insertedJob.id : null;

    if (jobId) {
      ejecutarTrabajoScraping(jobId).catch((err) => {
        console.error(`[Scraping] Error en ejecución de job ${jobId}:`, err.message);
      });
    }

    return NextResponse.json({
      success: true,
      message: 'Trabajo de descarga iniciado exitosamente.',
      jobId,
    });

  } catch (error: any) {
    console.error('Error al encolar trabajo:', error);
    const isAuthError = error.message?.includes('No autorizado');
    return NextResponse.json(
      { error: isAuthError ? error.message : 'Error interno del servidor al encolar la descarga.' },
      { status: isAuthError ? 401 : 500 }
    );
  }
}

export async function PATCH(req: Request) {
  try {
    const user = await verifyAuth(req);
    const tenantId = user.tenantId;
    if (!tenantId) {
      return NextResponse.json({ message: 'Usuario sin tenant asignado' }, { status: 403 });
    }

    const body = await req.json();
    const { jobId } = body;

    if (!jobId) {
      return NextResponse.json({ error: 'Falta jobId' }, { status: 400 });
    }

    const job = await db.queryOne("SELECT id, status, tenant_id FROM scraping_jobs WHERE id = $1", [jobId]);
    if (!job) {
      return NextResponse.json({ error: 'Trabajo no encontrado' }, { status: 404 });
    }

    if (job.tenant_id !== tenantId) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 403 });
    }

    if (job.status === 'COMPLETED' || job.status === 'CANCELLED') {
      return NextResponse.json({ error: 'El trabajo ya ha finalizado' }, { status: 400 });
    }

    await db.query(
      `UPDATE scraping_jobs SET status = 'CANCELLED', progress_message = 'Cancelado por el usuario', updated_at = NOW() WHERE id = $1`,
      [jobId]
    );

    return NextResponse.json({ success: true, message: 'Trabajo cancelado' });
  } catch (error: any) {
    console.error('Error al cancelar trabajo:', error);
    const isAuthError = error.message?.includes('No autorizado');
    return NextResponse.json(
      { error: isAuthError ? error.message : 'Error interno del servidor' },
      { status: isAuthError ? 401 : 500 }
    );
  }
}

export async function DELETE(req: Request) {
  try {
    const user = await verifyAuth(req);
    const tenantId = user.tenantId;
    if (!tenantId) {
      return NextResponse.json({ message: 'Usuario sin tenant asignado' }, { status: 403 });
    }

    const body = await req.json();
    const { jobId, deleteAll } = body;

    if (deleteAll) {
      // Delete all logs for this tenant's jobs, then all jobs
      await db.query(
        `DELETE FROM scraping_job_logs WHERE job_id IN (SELECT id FROM scraping_jobs WHERE tenant_id = $1)`,
        [tenantId]
      );
      await db.query(
        `DELETE FROM scraping_jobs WHERE tenant_id = $1`,
        [tenantId]
      );
      return NextResponse.json({ success: true, message: 'Historial eliminado completamente' });
    }

    if (!jobId) {
      return NextResponse.json({ error: 'Falta jobId' }, { status: 400 });
    }

    const job = await db.queryOne(
      "SELECT id, tenant_id FROM scraping_jobs WHERE id = $1",
      [jobId]
    );
    if (!job) {
      return NextResponse.json({ error: 'Trabajo no encontrado' }, { status: 404 });
    }
    if (job.tenant_id !== tenantId) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 403 });
    }

    // Delete logs first, then the job
    await db.query('DELETE FROM scraping_job_logs WHERE job_id = $1', [jobId]);
    await db.query('DELETE FROM scraping_jobs WHERE id = $1', [jobId]);

    return NextResponse.json({ success: true, message: 'Trabajo eliminado' });
  } catch (error: any) {
    console.error('Error al eliminar trabajo:', error);
    const isAuthError = error.message?.includes('No autorizado');
    return NextResponse.json(
      { error: isAuthError ? error.message : 'Error interno del servidor' },
      { status: isAuthError ? 401 : 500 }
    );
  }
}

export async function GET(req: Request) {
  try {
    const user = await verifyAuth(req);
    const tenantId = user.tenantId;
    if (!tenantId) {
      return NextResponse.json({ message: 'Usuario sin tenant asignado' }, { status: 403 });
    }

    const jobs = await db.queryAll(
      `SELECT id, ruc, fecha_desde, fecha_hasta, tipo_comprobante, mes, anio, status, progress_message, action_type, created_at, updated_at FROM scraping_jobs WHERE tenant_id = $1 ORDER BY created_at DESC LIMIT 20`,
      [tenantId]
    );

    return NextResponse.json({ success: true, jobs });
  } catch (error: any) {
    console.error('Error al obtener trabajos:', error);
    const isAuthError = error.message?.includes('No autorizado');
    return NextResponse.json(
      { error: isAuthError ? error.message : 'Error interno del servidor al obtener la lista de trabajos.' },
      { status: isAuthError ? 401 : 500 }
    );
  }
}
