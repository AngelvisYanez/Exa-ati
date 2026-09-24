import { db } from '@/services/sri-api/db';
import {
  SriPlaywrightScraper,
  isMassDownloadFullySynced,
  type MassDownloadSummary,
} from '@/services/scraping/sri-playwright-scraper';
import { encryption } from '@/services/sri-api/encryption';
import {
  formatJobDateIso,
  type SriScrapeAction,
} from '@/services/scraping/sri-scrape-actions';
import { scrapeDeclaracionesPresentadas } from '@/services/scraping/sri-playwright-declaraciones';
import { scrapeObligacionesPortal } from '@/services/scraping/sri-playwright-obligaciones';
import { buildAtsPrepareResult, periodoFromJobDates } from '@/services/scraping/sri-playwright-ats';
import {
  assignAliveProxy,
  isProxyFailureError,
  releaseProxy,
  resurrectEcProxies,
  rotateAliveProxy,
} from '@/services/scraping/proxy-assigner';
import { resolveComprobanteXml } from '@/services/sri-api/comprobante-xml-resolver';
import path from 'path';

function downloadNeedsAnotherHop(summaries: MassDownloadSummary[]): boolean {
  if (summaries.length === 0) return false;
  if (summaries.every(isMassDownloadFullySynced)) return false;
  const found = summaries.reduce((n, s) => n + s.found, 0);
  // Periodo vacío: no rotar. Si hubo filas pero faltan XML → otro proxy EC.
  return found > 0;
}

/** Serialize Playwright jobs — shared user profile cannot run concurrently. */
let scrapeJobChain: Promise<unknown> = Promise.resolve();

function enqueueScrapeJob<T>(fn: () => Promise<T>): Promise<T> {
  const next = scrapeJobChain.then(fn, fn);
  scrapeJobChain = next.then(
    () => undefined,
    () => undefined
  );
  return next;
}

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
  let query = 'UPDATE scraping_jobs SET progress_message = $1, updated_at = NOW() WHERE id = $2';
  let params: any[] = [message, jobId];
  if (status) {
    query = 'UPDATE scraping_jobs SET progress_message = $1, status = $2, updated_at = NOW() WHERE id = $3';
    params = [message, status, jobId];
  }
  await db.query(query, params);
  const level = status === 'ERROR' ? 'error' : status === 'COMPLETED' ? 'success' : 'info';
  await insertJobLog(jobId, level, message);
}

async function resolveClaveSri(job: any): Promise<string | null> {
  if (job.clave_sri) return job.clave_sri;
  if (!job.ruc) return null;
  const emisor = await db.queryOne<any>(
    'SELECT clave_sri_encrypted FROM emisores WHERE ruc = $1 AND activo = true',
    [job.ruc]
  );
  if (emisor?.clave_sri_encrypted) {
    try {
      return await encryption.decrypt(emisor.clave_sri_encrypted);
    } catch {
      return null;
    }
  }
  return null;
}

async function isCancelled(jobId: number): Promise<boolean> {
  const row = await db.queryOne<{ status: string }>(
    'SELECT status FROM scraping_jobs WHERE id = $1',
    [jobId]
  );
  return row?.status === 'CANCELLED';
}

function parseJobClavesAcceso(job: any): string[] {
  try {
    const raw = job.options
      ? typeof job.options === 'string'
        ? JSON.parse(job.options)
        : job.options
      : {};
    return Array.isArray(raw?.clavesAcceso)
      ? raw.clavesAcceso.filter((c: unknown) => typeof c === 'string' && String(c).length === 49)
      : [];
  } catch {
    return [];
  }
}

async function allTargetClavesHaveXml(claves: string[]): Promise<boolean> {
  if (claves.length === 0) return false;
  for (const clave of claves) {
    const xml = await resolveComprobanteXml(clave, { fetchFromSri: false }).catch(() => null);
    if (!xml || xml.trim().length < 50) return false;
  }
  return true;
}

async function claimJob(jobId: number): Promise<any | null> {
  const msg = 'Iniciando descarga con scraper de navegador...';

  if (process.env.DATABASE_URL) {
    const row = await db.queryOne<any>(
      `UPDATE scraping_jobs
       SET status = 'PROCESSING', progress_message = $2, updated_at = NOW()
       WHERE id = $1 AND status IN ('PENDING', 'ERROR')
       RETURNING *`,
      [jobId, msg]
    );
    if (!row) return null;
    await insertJobLog(jobId, 'info', msg);
    return row;
  }

  const result = await db.query(
    `UPDATE scraping_jobs
     SET status = 'PROCESSING', progress_message = $2, updated_at = NOW()
     WHERE id = $1 AND status IN ('PENDING', 'ERROR')`,
    [jobId, msg]
  );
  if ((result.rowCount || 0) === 0) return null;
  await insertJobLog(jobId, 'info', msg);
  return db.queryOne<any>('SELECT * FROM scraping_jobs WHERE id = $1', [jobId]);
}

/**
 * Orquestador SRI solo Playwright (+ proxy EC). Sin fallback SOAP ni conexión directa.
 */
export async function ejecutarTrabajoScraping(jobId: number): Promise<{ success: boolean; message: string }> {
  return enqueueScrapeJob(() => ejecutarTrabajoScrapingInternal(jobId));
}

async function ejecutarTrabajoScrapingInternal(jobId: number): Promise<{ success: boolean; message: string }> {
  let scraper: SriPlaywrightScraper | null = null;
  let claimedProxyId: number | null = null;

  try {
    const job = await claimJob(jobId);
    if (!job) {
      const existing = await db.queryOne<any>('SELECT status FROM scraping_jobs WHERE id = $1', [jobId]);
      if (!existing) return { success: false, message: 'Trabajo no encontrado' };
      return {
        success: false,
        message: `El trabajo ya está en estado ${existing.status} y no se puede reiniciar.`,
      };
    }

    const action = (job.action_type || 'DOWNLOAD_RECEIVED') as SriScrapeAction | string;

    const isDownloadActionEarly =
      action === 'DOWNLOAD_RECEIVED' ||
      action === 'DOWNLOAD_EMITTED' ||
      action === 'DOWNLOAD_BOTH';
    const targetClaves = parseJobClavesAcceso(job);
    if (isDownloadActionEarly && targetClaves.length > 0) {
      const allReady = await allTargetClavesHaveXml(targetClaves);
      if (allReady) {
        const finalMsg =
          `Scraping completo: ${targetClaves.length} XML ya almacenados en sistema/BD` +
          ` (sin re-descarga del portal).`;
        await updateProgress(jobId, finalMsg, 'COMPLETED');
        return { success: true, message: finalMsg };
      }
    }

    const claveSri = await resolveClaveSri(job);
    if (!claveSri) {
      throw new Error('No se encontró la contraseña del SRI vinculada a la cuenta.');
    }
    job.clave_sri = claveSri;
    job.fecha_desde = formatJobDateIso(job.fecha_desde) ?? job.fecha_desde;
    job.fecha_hasta = formatJobDateIso(job.fecha_hasta) ?? job.fecha_hasta;

    try {
      // Con Scrapeless el egress EC lo provee el browser remoto; no exigir pool local.
      const useScrapeless = Boolean(process.env.SCRAPELESS_API_KEY?.trim());
      const useProxy =
        !useScrapeless && process.env.SCRAPING_USE_PROXY !== 'false';
      if (useScrapeless) {
        await updateProgress(jobId, 'Usando Scrapeless (browser remoto + IP EC)...');
      }
      const maxHops = Math.max(1, Number(process.env.SCRAPING_PROXY_MAX_HOPS || 14) || 14);
      let proxyUrl: string | undefined;
      let excludeProxyIds: number[] = [];
      let hopReason: string | undefined;

      let jobOptions: { headless?: boolean } = {};
      try {
        if (job.options) {
          jobOptions = typeof job.options === 'string' ? JSON.parse(job.options) : job.options;
        }
      } catch {
        jobOptions = {};
      }
      const headless =
        typeof jobOptions.headless === 'boolean'
          ? jobOptions.headless
          : process.env.HEADLESS !== 'false';

      const isDownloadAction =
        action === 'DOWNLOAD_RECEIVED' ||
        action === 'DOWNLOAD_EMITTED' ||
        action === 'DOWNLOAD_BOTH' ||
        action === 'SCRAPE_RETENCIONES' ||
        action === 'SCRAPE_ATS';

      let downloadSummaries: MassDownloadSummary[] = [];
      let hop = 0;
      /** Reintentos en el mismo proxy EC antes de rotar (ya-synced se saltan). */
      const maxSameProxyRetries = Math.max(
        0,
        Number(process.env.SCRAPING_SAME_PROXY_RETRIES || 2) || 2,
      );
      let sameProxyRetries = 0;
      let preferSameProxyNext = false;

      while (hop < maxHops) {
        hop += 1;
        let rotatedThisHop = false;

        if (await isCancelled(jobId)) {
          return { success: false, message: 'Trabajo cancelado' };
        }

        if (useProxy) {
          if (hop === 1) {
            await updateProgress(jobId, 'Buscando proxy Ecuador (EC) disponible...');
            const revived = await resurrectEcProxies(excludeProxyIds);
            if (revived > 0) {
              await updateProgress(jobId, `Reactivados ${revived} proxy(s) EC por TCP antes del hop 1`);
            }
            const assigned = await assignAliveProxy(jobId, 14, 'EC', excludeProxyIds);
            if (!assigned.proxy || !assigned.proxyUrl) {
              throw new Error(
                'No hay proxy de Ecuador (EC) activo disponible. El portal SRI requiere IP EC — agrega/activa proxies en Configuración → Proxies.'
              );
            }
            claimedProxyId = assigned.proxy.id;
            proxyUrl = assigned.proxyUrl;
            rotatedThisHop = true;
            await updateProgress(
              jobId,
              `Hop ${hop}/${maxHops}: proxy EC ${assigned.proxy.proxy_host}:${assigned.proxy.proxy_port}`
            );
          } else if (preferSameProxyNext && claimedProxyId != null && proxyUrl) {
            preferSameProxyNext = false;
            sameProxyRetries += 1;
            rotatedThisHop = false;
            await updateProgress(
              jobId,
              `Hop ${hop}/${maxHops}: reintento mismo proxy EC #${claimedProxyId} ` +
                `(pase ${sameProxyRetries}/${maxSameProxyRetries}; XML ya sync se omiten)...`
            );
          } else {
            preferSameProxyNext = false;
            sameProxyRetries = 0;
            await updateProgress(
              jobId,
              `Hop ${hop}/${maxHops}: rotando proxy EC (${hopReason || 'reintento'})...`
            );
            const rotated = await rotateAliveProxy(
              jobId,
              claimedProxyId,
              excludeProxyIds,
              'EC',
              hopReason || `Hop ${hop}: proxy anterior sin descarga completa`
            );
            excludeProxyIds = rotated.excludeIds;
            claimedProxyId = rotated.proxy?.id ?? null;
            proxyUrl = rotated.proxyUrl ?? undefined;
            rotatedThisHop = true;
            if (!rotated.proxy || !rotated.proxyUrl) {
              throw new Error(
                `Sin más proxies EC vivos tras ${hop - 1} hop(s). Agotado el pool Ecuador.`
              );
            }
            await updateProgress(
              jobId,
              `Hop ${hop}/${maxHops}: nuevo proxy EC ${rotated.proxy.proxy_host}:${rotated.proxy.proxy_port}`
            );
          }
        }

        try {
          if (!scraper) {
            scraper = new SriPlaywrightScraper({
              proxyUrl,
              headless,
              userDataDir: path.join(process.cwd(), 'tmp', 'browser_session', `job_${jobId}`),
            });
            await updateProgress(jobId, `Iniciando Playwright (headless=${headless}, hop=${hop})...`);
            await scraper.init();
          } else if (rotatedThisHop) {
            await updateProgress(jobId, `Reconectando Playwright con nuevo proxy (hop=${hop})...`);
            await scraper.reinitWithProxy(proxyUrl);
          } else {
            await updateProgress(
              jobId,
              `Reutilizando sesión Playwright (hop=${hop}) para completar XML pendientes...`,
            );
          }

          const loggedIn = await scraper.login(job.ruc, job.clave_sri, async (msg: string) => {
            await updateProgress(jobId, msg);
          });
          if (!loggedIn) {
            throw new Error(
              'No se pudo iniciar sesión en el portal del SRI (login falló sin excepción; captcha, sesión cerrada o portal bloqueó la IP del servidor).'
            );
          }

          if (await isCancelled(jobId)) {
            return { success: false, message: 'Trabajo cancelado' };
          }

          const page = scraper.getPage();
          if (!page) throw new Error('Página Playwright no disponible');

          downloadSummaries = [];

          switch (action) {
            case 'SCRAPE_DECLARACIONES': {
              await updateProgress(jobId, 'Consultando declaraciones presentadas en el portal SRI...');
              const periodo = periodoFromJobDates(job.fecha_desde);
              const rows = await scrapeDeclaracionesPresentadas({
                page,
                tenantId: job.tenant_id || null,
                ruc: job.ruc,
                log: async (m) => updateProgress(jobId, m),
                periodo: periodo || undefined,
              });
              await updateProgress(jobId, `Declaraciones consultadas: ${rows.length}`);
              break;
            }

            case 'SCRAPE_OBLIGACIONES': {
              if (!job.tenant_id) throw new Error('SCRAPE_OBLIGACIONES requiere tenant_id');
              await updateProgress(jobId, 'Extrayendo obligaciones / vencimientos del perfil SRI...');
              const obl = await scrapeObligacionesPortal({
                page,
                tenantId: job.tenant_id,
                ruc: job.ruc,
                log: async (m) => updateProgress(jobId, m),
              });
              await updateProgress(jobId, `Obligaciones guardadas: ${obl.length}`);
              break;
            }

            case 'SCRAPE_RETENCIONES': {
              const retJob = { ...job, tipo_comprobante: '6' };
              await updateProgress(jobId, 'Descargando comprobantes de retención (tipo 6) recibidos...');
              downloadSummaries.push(await scraper.runMassDownload(retJob, updateProgress, 'recibidos'));
              if (await isCancelled(jobId)) return { success: false, message: 'Trabajo cancelado' };
              await updateProgress(jobId, 'Descargando comprobantes de retención (tipo 6) emitidos...');
              downloadSummaries.push(await scraper.runMassDownload(retJob, updateProgress, 'emitidos'));
              break;
            }

            case 'SCRAPE_ATS': {
              await updateProgress(jobId, 'Sincronizando comprobantes del periodo para ATS...');
              const atsJob = { ...job, tipo_comprobante: job.tipo_comprobante || 'todos' };
              downloadSummaries.push(await scraper.runMassDownload(atsJob, updateProgress, 'recibidos'));
              if (await isCancelled(jobId)) return { success: false, message: 'Trabajo cancelado' };
              downloadSummaries.push(await scraper.runMassDownload(atsJob, updateProgress, 'emitidos'));
              const atsInfo = buildAtsPrepareResult({
                periodo: periodoFromJobDates(job.fecha_desde),
                syncDone: true,
              });
              await updateProgress(jobId, atsInfo.message);
              break;
            }

            case 'DOWNLOAD_RECEIVED':
            case 'DOWNLOAD_BOTH': {
              await updateProgress(jobId, 'Scrapeando y descargando comprobantes recibidos del SRI...');
              downloadSummaries.push(await scraper.runMassDownload(job, updateProgress, 'recibidos'));
              if (await isCancelled(jobId)) return { success: false, message: 'Trabajo cancelado' };
              if (action === 'DOWNLOAD_BOTH') {
                await updateProgress(jobId, 'Scrapeando y descargando comprobantes emitidos del SRI...');
                downloadSummaries.push(await scraper.runMassDownload(job, updateProgress, 'emitidos'));
              }
              break;
            }
            case 'DOWNLOAD_EMITTED': {
              await updateProgress(jobId, 'Scrapeando y descargando comprobantes emitidos del SRI...');
              downloadSummaries.push(await scraper.runMassDownload(job, updateProgress, 'emitidos'));
              break;
            }
            default:
              throw new Error(`action_type no soportado: ${action}`);
          }
        } catch (hopErr: any) {
          const msg = hopErr?.message || String(hopErr);
          const badCreds = /credenciales proporcionadas|contraseña|clave incorrecta|usuario o clave/i.test(msg);
          const canRotate =
            useProxy &&
            !badCreds &&
            hop < maxHops &&
            (isProxyFailureError(hopErr) ||
              /timeout|túnel|tunnel|navegaci[oó]n|net::err|econn|select |sin resultados confiables|portal sri/i.test(
                msg,
              ));
          if (canRotate) {
            hopReason = `Error hop ${hop}: ${msg}`.slice(0, 400);
            await updateProgress(jobId, `Proxy/sesión falló — buscando otro EC. ${hopReason}`);
            continue;
          }
          throw hopErr;
        }

        if (await isCancelled(jobId)) {
          return { success: false, message: 'Trabajo cancelado' };
        }

        if (!isDownloadAction) {
          break;
        }

        if (!downloadNeedsAnotherHop(downloadSummaries)) {
          break;
        }

        if (!useProxy || hop >= maxHops) {
          break;
        }

        const synced = downloadSummaries.reduce((n, s) => n + s.xmlsSynced, 0);
        const failed = downloadSummaries.reduce((n, s) => n + s.xmlsFailed, 0);
        const found = downloadSummaries.reduce((n, s) => n + s.found, 0);

        // Si el proxy ya sirvió (listado/login OK), reintentar en el mismo IP antes de rotar.
        // Los XML ya sincronizados se omiten en la siguiente pasada.
        if (
          useProxy &&
          claimedProxyId != null &&
          sameProxyRetries < maxSameProxyRetries
        ) {
          preferSameProxyNext = true;
          hopReason =
            `Descarga incompleta hop ${hop}: ${synced} XML / ${failed} fallidos (vistos: ${found}). ` +
            `Reintento en mismo proxy EC antes de rotar.`;
          await updateProgress(jobId, hopReason);
          continue;
        }

        hopReason =
          `Descarga incompleta hop ${hop}: ${synced} XML / ${failed} fallidos (vistos: ${found}). Probando otro proxy EC.`;
        await updateProgress(jobId, hopReason);
        // Listado OK pero XML incompleto: no matar el proxy; excluir soft y rotar.
        // Si ya syncó al menos 1 XML, no excluir: puede volver más tarde en el pool.
        if (
          claimedProxyId != null &&
          synced === 0 &&
          !excludeProxyIds.includes(claimedProxyId)
        ) {
          excludeProxyIds = [...excludeProxyIds, claimedProxyId];
        }
        claimedProxyId = null; // rotateAliveProxy con null no marca muerto
        sameProxyRetries = 0;
        preferSameProxyNext = false;
      }

      if (scraper) {
        await scraper.close().catch(() => {});
        scraper = null;
      }

      if (isDownloadAction) {
        const allSynced = downloadSummaries.every(isMassDownloadFullySynced);
        const synced = downloadSummaries.reduce((n, s) => n + s.xmlsSynced, 0);
        const failed = downloadSummaries.reduce((n, s) => n + s.xmlsFailed, 0);
        const found = downloadSummaries.reduce((n, s) => n + s.found, 0);
        const missing = downloadSummaries.reduce((n, s) => n + s.targetsMissing, 0);

        if (!allSynced) {
          const finalMsg =
            `Descarga incompleta tras ${hop} hop(s): ${synced} XML en sistema, ${failed} fallidos` +
            (missing ? `, ${missing} clave(s) no encontradas` : '') +
            ` (comprobantes vistos: ${found}). COMPLETED solo si todos tienen XML en BD/disco.`;
          await updateProgress(jobId, finalMsg, 'ERROR');
          return { success: false, message: finalMsg };
        }

        const finalMsg =
          found === 0 && downloadSummaries.every((s) => s.targetsExpected == null)
            ? 'Scraping finalizado: no había comprobantes en el periodo.'
            : `Scraping completo: ${synced} XML almacenados en sistema/BD` +
              (found ? ` de ${found} comprobante(s)` : '') +
              (hop > 1 ? ` (${hop} hops de proxy EC)` : '') +
              '.';
        await updateProgress(jobId, finalMsg, 'COMPLETED');
        return { success: true, message: finalMsg };
      }

      const finalMsg = 'Scraping y descarga finalizada exitosamente.';
      await updateProgress(jobId, finalMsg, 'COMPLETED');
      return { success: true, message: finalMsg };
    } finally {
      if (scraper) {
        await scraper.close().catch(() => {});
        scraper = null;
      }
    }
  } catch (err: any) {
    console.error(`[JobRunner ${jobId}] Error:`, err.message);
    const current = await db.queryOne<{ status: string }>(
      'SELECT status FROM scraping_jobs WHERE id = $1',
      [jobId]
    );
    if (current?.status !== 'CANCELLED') {
      await updateProgress(jobId, `Error en scraper: ${err.message}`, 'ERROR');
    }
    return { success: false, message: err.message };
  } finally {
    if (claimedProxyId != null) {
      await releaseProxy(jobId).catch(() => {});
    }
  }
}
