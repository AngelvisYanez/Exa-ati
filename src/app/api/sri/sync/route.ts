import { NextResponse } from 'next/server';
import { db } from '@/lib/sri-api/db';
import { getBrowser, getCachedMode, releasePage } from '@/lib/scraping/browser';
import { parseJobOptions } from '@/lib/scraping/bridge';
import { ensureSession, solveRecaptchaAntiCaptcha, trySolveRecaptcha } from '@/lib/scraping/sri-auth';
import { downloadReceivedComprobantes } from '@/lib/scraping/sri-downloader';
import { runHttpScraping } from '@/lib/scraping/http-scraper';
import { sincronizarConSri } from '@/lib/sri-api/sync-service';

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

async function updateProgress(jobId: string, message: string, status?: string) {
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

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { jobId } = body;
    
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

    // Marcar como en proceso (esto es rápido, no interfiere con el tiempo de scraping)
    const isLocal = process.env.NODE_ENV === 'development' || !process.env.VERCEL;
    await updateProgress(jobId, isLocal ? 'Iniciando sincronización local...' : 'Iniciando sincronización Vercel Serverless...', 'PROCESSING');

    // ─── Ejecutar Scraping ──────────────────────────────────────────────────────────
    let browser = null;
    let page = null;
    try {
      const jobOpts = parseJobOptions(job.options);
      const connectionMode = jobOpts.connection_mode || (getCachedMode() ?? undefined);

      if (connectionMode === 'http') {
        await updateProgress(jobId, 'Usando scraper HTTP directo (sin navegador)...');
        await runHttpScraping(
          job,
          updateProgress,
          job.tenant_id || null,
          {
            useListadoTxt: jobOpts.use_listado_txt,
            parallelDays: jobOpts.parallel_days,
          }
        );
      } else {
        browser = await getBrowser(connectionMode);
        page = await browser.newPage();
        page.setDefaultTimeout(120000);
        page.setDefaultNavigationTimeout(120000);

        page.on('console', (msg: any) => console.log(`[Browser Console] ${msg.text()}`));

        const loggedIn = await ensureSession(page, job.ruc, job.clave_sri, async (msg: string) => {
          await updateProgress(jobId, msg);
        });

        if (!loggedIn) {
          throw new Error('No se pudo iniciar sesión. Verifica credenciales o saldo AntiCaptcha.');
        }

        const action = job.action_type || 'DOWNLOAD_RECEIVED';

        if (action === 'DOWNLOAD_RECEIVED') {
          await downloadReceivedComprobantes(
            page,
            job,
            updateProgress,
            solveRecaptchaAntiCaptcha,
            trySolveRecaptcha
          );
        } else {
          throw new Error(`Acción no soportada: ${action}`);
        }
      }

      const tenantId = job.tenant_id || null;
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

    } catch (scrapeError: any) {
      console.error(`[Sync Job ${jobId}] Error en scraping:`, scrapeError);
      await updateProgress(jobId, `Error crítico: ${scrapeError.message}`, 'ERROR');
      return NextResponse.json({ success: false, error: scrapeError.message }, { status: 500 });
    } finally {
      if (page) {
        await releasePage(page).catch(() => {});
      }
      const mode = getCachedMode();
      if (browser && mode !== 'cdp') {
        await browser.close().catch(() => {});
      }
    }
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
