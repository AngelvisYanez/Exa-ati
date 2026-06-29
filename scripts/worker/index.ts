import 'dotenv/config';
import puppeteerExtra from 'puppeteer-extra';
import StealthPlugin from 'puppeteer-extra-plugin-stealth';
import mysql from 'mysql2/promise';
import fs from 'fs';
import path from 'path';

import { ensureSession, solveRecaptchaAntiCaptcha, trySolveRecaptcha } from './auth.js';
import { downloadReceivedComprobantes } from './modules/comprobantes.js';
import { sincronizarConSri } from '../../src/lib/sri-api/sync-service';
import { getConnectedBrowser, releasePage, parseJobOptions } from '../../src/lib/scraping/bridge';
import type { ConnectionMode } from '../../src/lib/scraping/bridge';
import {
  claimProxy,
  releaseProxy,
  formatProxyUrl,
  countAvailable,
  countInUse,
} from '../../src/lib/scraping/proxy-assigner';

puppeteerExtra.use(StealthPlugin());

const MAX_CONCURRENT_JOBS = parseInt(process.env.WORKER_MAX_CONCURRENT || '5', 10);
const POLL_INTERVAL_MS = parseInt(process.env.WORKER_POLL_INTERVAL || '10000', 10);

const getDbConnection = async () => {
  return await mysql.createConnection({
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '3306', 10),
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'db_sri',
  });
};

async function updateProgress(pool: any, jobId: number, message: string, status?: string) {
  console.log(`[Job ${jobId}] ${message}`);
  let query = "UPDATE scraping_jobs SET progress_message = ?, updated_at = NOW() WHERE id = ?";
  let params = [message, jobId];
  if (status) {
    query = "UPDATE scraping_jobs SET progress_message = ?, status = ?, updated_at = NOW() WHERE id = ?";
    params = [message, status, jobId];
  }
  await pool.query(query, params);
}

async function launchStandaloneBrowser(proxyUrl?: string) {
  const isHeadless = process.env.HEADLESS !== 'false';
  const busterPath = path.resolve('./scripts/buster');
  const launchArgs = [
    '--no-sandbox',
    '--disable-setuid-sandbox',
    '--disable-dev-shm-usage',
    '--disable-blink-features=AutomationControlled',
  ];

  if (fs.existsSync(busterPath)) {
    launchArgs.push(`--disable-extensions-except=${busterPath}`);
    launchArgs.push(`--load-extension=${busterPath}`);
  }

  if (proxyUrl) {
    const parsed = new URL(proxyUrl);
    launchArgs.push(`--proxy-server=${parsed.protocol}//${parsed.hostname}:${parsed.port}`);
    console.log(`[Worker] Usando proxy: ${parsed.hostname}:${parsed.port}`);
  }

  return await puppeteerExtra.launch({
    headless: isHeadless ? 'shell' as any : false,
    defaultViewport: null,
    userDataDir: path.resolve('./browser_session'),
    executablePath: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    args: launchArgs,
  });
}

async function processJob(pool: any, job: any): Promise<void> {
  let browser: any = null;
  let page: any = null;
  let currentMode: ConnectionMode = 'cdp';
  let assignedProxyId: number | null = null;

  try {
    const jobOpts = parseJobOptions(job.options);
    currentMode = jobOpts.connection_mode || 'cdp';

    // Asignar proxy del pool
    let proxyUrl: string | undefined;
    try {
      const proxy = await claimProxy(job.id);
      if (proxy) {
        assignedProxyId = proxy.id;
        proxyUrl = formatProxyUrl(proxy);
        // Guardar proxy_id en el job
        await pool.query('UPDATE scraping_jobs SET proxy_id = ? WHERE id = ?', [proxy.id, job.id]);
        await updateProgress(pool, job.id, `Proxy asignado: ${proxy.proxy_host}:${proxy.proxy_port}`);
      }
    } catch (proxyErr: any) {
      console.error(`[Job ${job.id}] Error asignando proxy:`, proxyErr.message);
    }

    if (currentMode === 'cdp' || currentMode === 'new_browser') {
      console.log(`[Worker] Conectando navegador en modo: ${currentMode}`);
      browser = await getConnectedBrowser(currentMode);
      page = await browser.newPage();

      const downloadsDir = path.resolve('./downloads');
      const tempPath = path.join(downloadsDir, 'temp');
      fs.mkdirSync(tempPath, { recursive: true });

      const client = await page.target().createCDPSession();
      await client.send('Page.setDownloadBehavior', {
        behavior: 'allow',
        downloadPath: tempPath,
      });
    } else {
      console.log('[Worker] Lanzando navegador headless aislado...');
      browser = await launchStandaloneBrowser(proxyUrl);
      page = await browser.newPage();

      const downloadsDir = path.resolve('./downloads');
      const tempPath = path.join(downloadsDir, 'temp');
      fs.mkdirSync(tempPath, { recursive: true });

      const client = await page.target().createCDPSession();
      await client.send('Page.setDownloadBehavior', {
        behavior: 'allow',
        downloadPath: tempPath,
      });
    }

    page.on('console', (msg: any) => {
      console.log(`[Browser Console] [${msg.type()}] ${msg.text()}`);
    });
    page.on('pageerror', (err: any) => {
      console.error(`[Browser PageError] ${err.message}`);
    });
    page.on('requestfailed', (req: any) => {
      console.log(`[Browser ReqFailed] ${req.url()} - ${req.failure()?.errorText || 'unknown'}`);
    });

    const loggedIn = await ensureSession(page, job.ruc, job.clave_sri, async (msg: string) => {
      await updateProgress(pool, job.id, msg, 'PROCESSING');
    });

    if (!loggedIn) {
      throw new Error('No se pudo establecer sesión en el SRI.');
    }

    const action = job.action_type || 'DOWNLOAD_RECEIVED';

    if (action === 'DOWNLOAD_RECEIVED') {
      await downloadReceivedComprobantes(
        page,
        pool,
        job,
        updateProgress,
        solveRecaptchaAntiCaptcha,
        trySolveRecaptcha
      );
    } else {
      throw new Error(`Acción no soportada: ${action}`);
    }

    const tenantId = job.tenant_id || null;
    if (tenantId && job.ruc && job.fecha_desde && job.fecha_hasta) {
      try {
        await updateProgress(pool, job.id, 'Sincronizando comprobantes pendientes con SOAP del SRI...');
        const syncResult = await sincronizarConSri(tenantId, job.ruc, {
          fechaDesde: job.fecha_desde,
          fechaHasta: job.fecha_hasta,
          modo: 'completo',
          limite: 30,
        });
        console.log(`[Job ${job.id}] Post-scrape SOAP sync: ${syncResult.message}`);
      } catch (syncErr: any) {
        console.error(`[Job ${job.id}] Post-scrape SOAP sync error:`, syncErr.message);
      }
    }

    await updateProgress(pool, job.id, 'Job completado exitosamente', 'COMPLETED');

  } catch (error: any) {
    console.error(`[Job ${job?.id || '?'}] Error en el worker:`, error.message);
    if (page) {
      try {
        const errScreenshotPath = path.resolve(`./downloads/worker-error-${job?.id || 'unknown'}.png`);
        await page.screenshot({ path: errScreenshotPath, fullPage: true });
        console.error(`[Job ${job?.id || '?'}] Captura de pantalla del error guardada en: ${errScreenshotPath}`);
      } catch (e: any) {
        console.error(`[Job ${job?.id || '?'}] No se pudo tomar captura del error:`, e.message);
      }
    }
    if (job) {
      await updateProgress(pool, job.id, `Error crítico: ${error.message}`, 'ERROR');
    }
  } finally {
    if (page) {
      await releasePage(page).catch(() => {});
    }
    if (browser && currentMode !== 'cdp') {
      await browser.close().catch(() => {});
    }
    // Liberar proxy
    if (assignedProxyId) {
      await releaseProxy(job.id).catch((e: any) =>
        console.error(`[Job ${job.id}] Error liberando proxy:`, e.message)
      );
    }
  }
}

async function runWorker() {
  console.log(`👷 Iniciando SriWorker concurrente (max ${MAX_CONCURRENT_JOBS} jobs simultáneos)...`);

  let pool;
  try {
    pool = await getDbConnection();
  } catch (err) {
    console.error("Error conectando a BD:", err);
    process.exit(1);
  }

  while (true) {
    try {
      const available = await countAvailable().catch(() => 0);
      const inUse = await countInUse().catch(() => 0);

      if (available === 0) {
        console.log(`[Worker] Sin proxies disponibles (${inUse} en uso). Esperando ${POLL_INTERVAL_MS / 1000}s...`);
        await new Promise(res => setTimeout(res, POLL_INTERVAL_MS));
        continue;
      }

      const slots = Math.min(available, MAX_CONCURRENT_JOBS);

      // Obtener hasta N jobs PENDING
      const [rows] = await pool.query(
        `SELECT * FROM scraping_jobs
         WHERE status = 'PENDING'
         ORDER BY created_at ASC
         LIMIT ?`,
        [slots]
      );
      const jobs = rows as any[];

      if (!jobs || jobs.length === 0) {
        await new Promise(res => setTimeout(res, POLL_INTERVAL_MS));
        continue;
      }

      // Marcar todos como PROCESSING
      const jobIds = jobs.map((j: any) => j.id);
      await pool.query(
        `UPDATE scraping_jobs SET status = 'PROCESSING', updated_at = NOW()
         WHERE id IN (${jobIds.map(() => '?').join(',')})`,
        jobIds
      );

      console.log(`[Worker] Procesando ${jobs.length} job(s) concurrentemente...`);

      // Ejecutar en paralelo (uno por proxy disponible)
      await Promise.allSettled(jobs.map((job: any) => processJob(pool, job)));

      console.log(`[Worker] Lote completado. Revisando más trabajos...`);

    } catch (error: any) {
      console.error('[Worker] Error en bucle principal:', error.message);
      await new Promise(res => setTimeout(res, POLL_INTERVAL_MS));
    }
  }
}

runWorker().catch(err => {
  console.error("Fallo crítico en Worker:", err);
  process.exit(1);
});
