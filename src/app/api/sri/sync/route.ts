import { NextResponse } from 'next/server';
import { writeFileSync, mkdirSync, existsSync } from 'fs';
import { join } from 'path';
import { db } from '@/lib/sri-api/db';
import { getBrowser, getCachedMode, releasePage } from '@/lib/scraping/browser';
import { parseJobOptions } from '@/lib/scraping/bridge';
import { ensureSession, solveRecaptchaAntiCaptcha, trySolveRecaptcha } from '@/lib/scraping/sri-auth';
import { downloadReceivedComprobantes } from '@/lib/scraping/sri-downloader';
import { runHttpScraping } from '@/lib/scraping/http-scraper';
import { SriPlaywrightScraper } from '@/lib/scraping/sri-playwright-scraper';
import { sincronizarConSri } from '@/lib/sri-api/sync-service';
import { assignProxyToJob, releaseProxy, formatProxyUrl } from '@/lib/scraping/proxy-assigner';
import { xmlStorage } from '@/lib/sri-api/xml-storage';

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

export async function POST(req: Request) {
  let jobId: number | null = null;
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

    const isLocal = process.env.NODE_ENV === 'development' || !process.env.VERCEL;
    await updateProgress(jobId, isLocal ? 'Iniciando sincronización local...' : 'Iniciando sincronización Vercel Serverless...', 'PROCESSING');

    const MAX_RETRIES = 2;
    let assignedProxyUrl: string | null = null;
    let assignedProxyId: number | null = null;
    let lastError: any = null;
    let scrapingSuccess = false;
    let connectionMode = '';

    for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
      let browser = null;
      let page = null;
      let scraper: SriPlaywrightScraper | null = null;

      try {
        const jobOpts = parseJobOptions(job.options);
        connectionMode = jobOpts.connection_mode || (getCachedMode() ?? '');

        // ─── Asignar proxy (solo para modos que lo usan) ─────────────────────
        const needsProxy = connectionMode !== 'cloudflare' && jobOpts.use_proxy !== false;
        if (needsProxy && (attempt === 0 || isTimeoutError(lastError))) {
          try {
            const { proxy, proxyUrl } = await assignProxyToJob(jobId, job.tenant_id);
            if (proxy && proxyUrl) {
              assignedProxyUrl = proxyUrl;
              assignedProxyId = proxy.id;
              await db.query('UPDATE scraping_jobs SET proxy_id = $1 WHERE id = $2', [proxy.id, jobId]);
              await updateProgress(jobId, `Proxy asignado: ${proxy.proxy_host}:${proxy.proxy_port}`);
            } else {
              await updateProgress(jobId, 'Sin proxy disponible, usando IP directa');
            }
          } catch (proxyErr: any) {
            console.error(`[Sync Job ${jobId}] Error asignando proxy:`, proxyErr.message);
          }
        }

        if (connectionMode === 'http') {
          await updateProgress(jobId, 'Usando scraper HTTP directo (sin navegador)...');
          await runHttpScraping(
            job,
            updateProgress,
            job.tenant_id || null,
            {
              useListadoTxt: jobOpts.use_listado_txt,
              parallelDays: jobOpts.parallel_days,
              proxyUrl: assignedProxyUrl || jobOpts.proxy_url || process.env.SRI_PROXY_HOST,
            }
          );
        } else if (connectionMode === 'cloudflare') {
          await updateProgress(jobId, 'Usando Cloudflare Browser Run (scraping remoto)...');
          const cfOpts = jobOpts as any;
          const cfWorkerUrl = cfOpts.cf_worker_url || 'https://scrapper-cloudflare.angelvisyanez7.workers.dev';
          const cfAccountId = cfOpts.cf_account_id;
          const cfToken = cfOpts.cf_token;
          if (!cfAccountId || !cfToken) {
            throw new Error('Faltan credenciales de Cloudflare (Account ID y API Token)');
          }
          const workerUrl = `${cfWorkerUrl.replace(/\/+$/, '')}/`;

          // Parse the job period (year, month from fecha_desde)
          const desde = new Date(job.fecha_desde);
          const hasta = new Date(job.fecha_hasta);
          const tipo = job.tipo_comprobante === 'todos' ? 'factura' : (
            job.tipo_comprobante === '1' ? 'factura' :
            job.tipo_comprobante === '2' ? 'nota_credito' :
            job.tipo_comprobante === '3' ? 'nota_debito' :
            job.tipo_comprobante === '4' ? 'guia_remision' :
            job.tipo_comprobante === '6' ? 'retencion' : 'factura'
          );

          let totalDescargados = 0;
          let totalErrores = 0;

          // Iterate month by month within the date range
          let current = new Date(desde.getFullYear(), desde.getMonth(), 1);
          while (current <= hasta) {
            const year = current.getFullYear();
            const month = current.getMonth() + 1;
            const periodoLabel = `${year}-${String(month).padStart(2, '0')}`;
            await updateProgress(jobId, `Cloudflare: consultando ${periodoLabel}...`);

            const workerBody = JSON.stringify({
              ruc: job.ruc,
              clave: job.clave_sri,
              year,
              month,
              tipo,
            });

            const workerRes = await fetch(workerUrl, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'CF-Access-Key': cfAccountId,
                'CF-Access-Token': cfToken,
                'X-Auth-Token': cfToken,
              },
              body: workerBody,
              signal: AbortSignal.timeout(120000),
            });

            if (!workerRes.ok) {
              const errText = await workerRes.text();
              throw new Error(`Worker responded ${workerRes.status}: ${errText.substring(0, 200)}`);
            }

            const result = await workerRes.json();
            if (!result.success) {
              throw new Error(result.error || 'Worker retornó error');
            }

            const comprobantes: any[] = result.comprobantes || [];
            await updateProgress(jobId, `Cloudflare: ${comprobantes.length} comprobantes recibidos en ${periodoLabel}`);

            if (result.savedToNeon) {
              // Worker ya guardó directamente a Neon — solo contar
              totalDescargados += comprobantes.length;
              await updateProgress(jobId, `Cloudflare: ${comprobantes.length} guardados directamente a Neon`);
            } else {
              for (const comp of comprobantes) {
                try {
                  const claveAcceso = comp.claveAcceso;
                  if (!claveAcceso) continue;

                  // Save XML file (base64 → filesystem)
                  let xmlRelativePath: string | null = null;
                  if (comp.xmlBase64) {
                    const xmlContent = Buffer.from(comp.xmlBase64, 'base64').toString('utf-8');
                    const fechaEmision = comp.fecha ? new Date(comp.fecha) : new Date();
                    xmlRelativePath = xmlStorage.saveXml(job.ruc, claveAcceso, fechaEmision, 'autorizado', xmlContent);
                  }

                  // Save PDF file (base64 → filesystem)
                  let pdfPath: string | null = null;
                  if (comp.pdfBase64) {
                    const pdfDir = join(process.cwd(), 'downloads', 'RIDE');
                    if (!existsSync(pdfDir)) mkdirSync(pdfDir, { recursive: true });
                    pdfPath = join(pdfDir, `${claveAcceso}.pdf`);
                    writeFileSync(pdfPath, Buffer.from(comp.pdfBase64, 'base64'));
                  }

                  // Insert comprobante record if not exists
                  const existing = await db.queryOne(
                    'SELECT id FROM comprobantes WHERE clave_acceso = $1',
                    [claveAcceso]
                  );
                  if (!existing) {
                    const emisorRucMatch = claveAcceso.match(/^(\d{13})/);
                    const emisorRuc = emisorRucMatch ? emisorRucMatch[1] : null;
                    const fechaEmision = comp.fecha || null;
                    await db.query(
                      `INSERT INTO comprobantes (clave_acceso, tipo, emisor_ruc, emisor_razon_social, serie, secuencial, estado, numero_autorizacion, receptor_identificacion, tenant_id, fecha_emision, categoria)
                       VALUES ($1, $2, $3, $4, $5, $6, 'AUTORIZADO', $7, $8, $9, $10, 'Otros')`,
                      [
                        claveAcceso,
                        `0${job.tipo_comprobante}`,
                        emisorRuc,
                        comp.razonSocialEmisor || comp.nombre || '',
                        null,
                        null,
                        claveAcceso,
                        job.ruc,
                        job.tenant_id,
                        fechaEmision,
                      ]
                    );
                  }

                  // Insert XML reference
                  if (xmlRelativePath) {
                    const compId = await db.queryOne(
                      'SELECT id FROM comprobantes WHERE clave_acceso = $1',
                      [claveAcceso]
                    );
                    if (compId) {
                      await db.query(
                        `INSERT INTO comprobante_xmls (comprobante_id, tipo, ruta_archivo)
                         VALUES ($1, 'autorizado', $2)
                         ON CONFLICT (comprobante_id, tipo) DO UPDATE SET ruta_archivo = EXCLUDED.ruta_archivo`,
                        [compId.id, xmlRelativePath]
                      );
                    }
                  }

                  totalDescargados++;
                } catch (compErr: any) {
                  totalErrores++;
                  console.error(`[Sync Job ${jobId}] Error procesando comprobante:`, compErr.message);
                  await insertJobLog(jobId, 'error', `Error: ${comp.nombre || comp.claveAcceso} - ${compErr.message}`);
                }
              }
            }

            // Next month
            current.setMonth(current.getMonth() + 1);
          }

          await updateProgress(jobId, `Cloudflare completado: ${totalDescargados} descargados, ${totalErrores} errores`);
          scrapingSuccess = true;
        } else if (connectionMode === 'playwright') {
          await updateProgress(jobId, 'Usando Playwright (navegador robusto)...');
          scraper = new SriPlaywrightScraper({});
          await scraper.init();
          const loggedIn = await scraper.login(job.ruc, job.clave_sri, async (msg: string) => {
            await updateProgress(jobId!, msg);
          });
          if (!loggedIn) {
            throw new Error('No se pudo iniciar sesion con Playwright.');
          }
          await scraper.runMassDownload(job, updateProgress);
        } else {
          browser = await getBrowser(connectionMode as any);
          page = await browser.newPage();
          page.setDefaultTimeout(120000);
          page.setDefaultNavigationTimeout(120000);

          page.on('console', (msg: any) => console.log(`[Browser Console] ${msg.text()}`));

          const loggedIn = await ensureSession(page, job.ruc, job.clave_sri, async (msg: string) => {
            await updateProgress(jobId!, msg);
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

        scrapingSuccess = true;
        break;

      } catch (err: any) {
        lastError = err;
        console.error(`[Sync Job ${jobId}] Error en scraping (intento ${attempt + 1}/${MAX_RETRIES + 1}):`, err.message?.substring(0, 200));

        if (isTimeoutError(err) && attempt < MAX_RETRIES) {
          await updateProgress(jobId, `Timeout — liberando proxy y reintentando (${attempt + 2}/${MAX_RETRIES + 1})...`);
          if (assignedProxyId) {
            await releaseProxy(jobId).catch(() => {});
            assignedProxyId = null;
            assignedProxyUrl = null;
          }
          continue;
        }

        throw err;

      } finally {
        if (scraper) {
          await scraper.close().catch(() => {});
        }
        if (page) {
          await releasePage(page).catch(() => {});
        }
        const mode = getCachedMode();
        if (browser && mode !== 'cdp') {
          await browser.close().catch(() => {});
        }
      }
    }

    // ─── Post-loop: success or failure ─────────────────────────────────────
    if (!scrapingSuccess) {
      const errMsg = lastError?.message || 'Error desconocido';
      console.error(`[Sync Job ${jobId}] Scraping falló tras ${MAX_RETRIES + 1} intentos:`, lastError);
      await updateProgress(jobId, `Error crítico: ${errMsg}`, 'ERROR');
      return NextResponse.json({ success: false, error: errMsg }, { status: 500 });
    }

    const tenantId = job.tenant_id || null;
    const jobOpts = parseJobOptions(job.options);
    const soapLimit = connectionMode === 'playwright' ? 0 : (jobOpts.soap_sync_limit ?? 30);
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
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  } finally {
    if (jobId) {
      try {
        const finalJob = await db.queryOne("SELECT proxy_id FROM scraping_jobs WHERE id = $1", [jobId]);
        if (finalJob?.proxy_id) {
          await releaseProxy(jobId).catch(() => {});
        }
      } catch {}
    }
  }
}
