import { NextResponse } from 'next/server';
import { db } from '@/lib/sri-api/db';
import { parseJobOptions } from '@/lib/scraping/bridge';
import { SriPlaywrightScraper } from '@/lib/scraping/sri-playwright-scraper';
import { sincronizarConSri } from '@/lib/sri-api/sync-service';
import { encryption } from '@/lib/sri-api/encryption';

// Vercel Pro allows up to 300 seconds for background tasks.
// Free Hobby tier is limited to 10-60s depending on config.
export const maxDuration = 300; 
export const dynamic = 'force-dynamic';

async function insertJobLog(jobId: string | number, level: string, message: string) {
  try {
    await db.query(
      `INSERT INTO scraping_job_logs (job_id, level, message) VALUES ($1, $2, $3)`,
      [jobId, level, message]
    );
  } catch (err: any) {
    console.error(`[LogDB] Error inserting log for job ${jobId}:`, err.message);
  }
}

async function updateProgress(jobId: string | number, message: string, status?: string) {
  console.log(`[Sync Job ${jobId}] ${message}`);
  let query = "UPDATE scraping_jobs SET progress_message = $1, updated_at = NOW() WHERE id = $2";
  let params: any[] = [message, jobId];
  if (status) {
    query = "UPDATE scraping_jobs SET progress_message = $1, status = $2, updated_at = NOW() WHERE id = $3";
    params = [message, status, jobId];
  }
  await db.query(query, params);
  const level = status === 'ERROR' ? 'error' : status === 'COMPLETED' ? 'success' : 'info';
  await insertJobLog(jobId, level, message);
}

function isTimeoutError(err: any): boolean {
  const msg = err?.message || '';
  const name = err?.name || '';
  return (
    name === 'TimeoutError' ||
    msg.includes('timeout') ||
    msg.includes('Timed out') ||
    msg.includes('ERR_TIMED_OUT') ||
    msg.includes('Navigation timeout') ||
    msg.includes('net::ERR_TIMED_OUT') ||
    msg.includes('net::ERR_CONNECTION_TIMED_OUT')
  );
}

async function resolveClaveSri(job: any): Promise<string> {
  if (job.clave_sri) {
    return job.clave_sri;
  }
  if (!job.ruc) {
    throw new Error('RUC no disponible en el trabajo de scraping');
  }
  const emisor = await db.queryOne<any>(
    'SELECT clave_sri_encrypted FROM emisores WHERE ruc = $1 AND activo = true',
    [job.ruc]
  );
  if (emisor?.clave_sri_encrypted) {
    try {
      return await encryption.decrypt(emisor.clave_sri_encrypted);
    } catch (e) {
      throw new Error('Error al descifrar credenciales SRI almacenadas. Vuelva a vincular el RUC.');
    }
  }
  throw new Error('Credenciales SRI no disponibles. Vincule el RUC primero o incluya la contraseña en la solicitud.');
}

export async function POST(req: Request) {
  let jobId: number | null = null;
  let scraper: SriPlaywrightScraper | null = null;
  try {
    const body = await req.json();
    jobId = Number(body.jobId);
    
    if (!jobId) {
      return NextResponse.json({ error: 'Falta jobId' }, { status: 400 });
    }

    const job = await db.queryOne("SELECT * FROM scraping_jobs WHERE id = $1", [jobId]);
    if (!job) {
      return NextResponse.json({ error: 'Job no encontrado' }, { status: 404 });
    }

    if (job.status !== 'PENDING' && job.status !== 'ERROR') {
      return NextResponse.json({ error: 'El job ya está en proceso o finalizado' }, { status: 400 });
    }

    const claveSri = await resolveClaveSri(job);
    job.clave_sri = claveSri;

    await updateProgress(jobId, 'Iniciando sincronización con Playwright...', 'PROCESSING');

    const action = job.action_type || 'DOWNLOAD_RECEIVED';

    scraper = new SriPlaywrightScraper();
    await scraper.init();
    const loggedIn = await scraper.login(job.ruc, job.clave_sri, async (msg: string) => {
      await updateProgress(jobId!, msg);
    });
    if (!loggedIn) {
      throw new Error('No se pudo iniciar sesion con Playwright.');
    }

    // ─── Ejecutar según action_type ─────────────────────────────────────
    if (action === 'DOWNLOAD_RECEIVED' || action === 'DOWNLOAD_BOTH') {
      await updateProgress(jobId, 'Sincronizando comprobantes recibidos...');
      await scraper.runMassDownload(job, updateProgress, 'recibidos');
    }

    if (action === 'DOWNLOAD_EMITTED' || action === 'DOWNLOAD_BOTH') {
      await updateProgress(jobId, 'Sincronizando comprobantes emitidos...');
      await scraper.runMassDownload(job, updateProgress, 'emitidos');
    }

    await updateProgress(jobId, 'Descarga completada exitosamente.', 'COMPLETED');

    // ─── Post-scrape SOAP sync ──────────────────────────────────────────
    const tenantId = job.tenant_id || null;
    const jobOpts = parseJobOptions(job.options);
    const soapLimit = jobOpts.soap_sync_limit ?? 30;
    if (soapLimit > 0 && tenantId && job.ruc && job.fecha_desde && job.fecha_hasta) {
      try {
        await updateProgress(jobId, 'Sincronizando comprobantes pendientes con SOAP del SRI...');
        const syncResult = await sincronizarConSri(tenantId, job.ruc, {
          fechaDesde: job.fecha_desde,
          fechaHasta: job.fecha_hasta,
          modo: 'completo',
          limite: soapLimit,
        });
        console.log(`[Sync Job ${jobId}] Post-scrape SOAP sync: ${syncResult.message}`);
      } catch (syncErr: any) {
        console.error(`[Sync Job ${jobId}] Post-scrape SOAP sync error:`, syncErr.message);
      }
    }

    return NextResponse.json({ success: true, message: 'Sincronización completada' });

  } catch (error: any) {
    if (jobId) {
      await updateProgress(jobId, `Error: ${error.message}`, 'ERROR');
    }
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  } finally {
    if (scraper) {
      await scraper.close().catch(() => {});
    }
  }
}
