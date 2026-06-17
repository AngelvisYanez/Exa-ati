import 'dotenv/config';
import puppeteer from 'puppeteer-extra';
import StealthPlugin from 'puppeteer-extra-plugin-stealth';
import mysql from 'mysql2/promise';
import fs from 'fs';
import path from 'path';

import { ensureSession, solveRecaptchaAntiCaptcha, trySolveRecaptcha } from './auth.js';
import { downloadReceivedComprobantes } from './modules/comprobantes.js';

puppeteer.use(StealthPlugin());

const lockFilePath = path.resolve(process.cwd(), 'sri-worker.lock');

function acquireLock() {
  if (fs.existsSync(lockFilePath)) {
    try {
      const existingPid = parseInt(fs.readFileSync(lockFilePath, 'utf8').trim(), 10);
      if (existingPid) {
        process.kill(existingPid, 0);
        console.log(`[Worker] El worker ya se encuentra en ejecución (PID: ${existingPid}). Saliendo.`);
        process.exit(0);
      }
    } catch (e: any) {
      console.log('[Worker] Se detectó un archivo de bloqueo huérfano. Reclamando el bloqueo.');
    }
  }
  
  fs.writeFileSync(lockFilePath, String(process.pid), 'utf8');
  
  const cleanup = () => {
    try {
      if (fs.existsSync(lockFilePath)) {
        const storedPid = parseInt(fs.readFileSync(lockFilePath, 'utf8').trim(), 10);
        if (storedPid === process.pid) {
          fs.unlinkSync(lockFilePath);
          console.log('[Worker] Cerradura liberada correctamente.');
        }
      }
    } catch (e) {}
  };
  
  process.on('exit', cleanup);
  process.on('SIGINT', () => { cleanup(); process.exit(0); });
  process.on('SIGTERM', () => { cleanup(); process.exit(0); });
}

acquireLock();

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

async function runWorker() {
  console.log('👷 Iniciando SriWorker (Modular) en modo polling y background...');

  let pool;
  try {
    pool = await getDbConnection();
  } catch (err) {
    console.error("Error conectando a BD:", err);
    process.exit(1);
  }

  while (true) {
    let job: any = null;
    let browser = null;
    let page: any = null;
    
    try {
      const [rows] = await pool.query("SELECT * FROM scraping_jobs WHERE status = 'PENDING' ORDER BY created_at ASC LIMIT 1");
      const jobs = rows as any[];
      
      if (!jobs || jobs.length === 0) {
        await new Promise(res => setTimeout(res, 10000));
        continue;
      }
      
      job = jobs[0];
      
      const isHeadless = process.env.HEADLESS !== 'false';
      const busterPath = path.resolve('./scripts/buster');
      const launchArgs = [
        '--no-sandbox', 
        '--disable-setuid-sandbox', 
        '--disable-dev-shm-usage',
        '--disable-blink-features=AutomationControlled'
      ];

      if (fs.existsSync(busterPath)) {
        launchArgs.push(`--disable-extensions-except=${busterPath}`);
        launchArgs.push(`--load-extension=${busterPath}`);
      }

      browser = await puppeteer.launch({
        headless: isHeadless ? 'shell' as any : false,
        defaultViewport: null,
        userDataDir: path.resolve('./browser_session'),
        executablePath: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
        args: launchArgs
      });

      page = await browser.newPage();
      
      page.on('console', (msg: any) => {
        console.log(`[Browser Console] [${msg.type()}] ${msg.text()}`);
      });
      page.on('pageerror', (err: any) => {
        console.error(`[Browser PageError] ${err.message}`);
      });
      page.on('requestfailed', (req: any) => {
        console.log(`[Browser ReqFailed] ${req.url()} - ${req.failure()?.errorText || 'unknown'}`);
      });

      const downloadsDir = path.resolve('./downloads');
      const tempPath = path.join(downloadsDir, 'temp');
      
      const client = await page.target().createCDPSession();
      await client.send('Page.setDownloadBehavior', {
        behavior: 'allow',
        downloadPath: tempPath,
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
      await new Promise(res => setTimeout(res, 10000));
    } finally {
      if (browser) {
        await browser.close().catch(() => {});
      }
    }
    
    await new Promise(res => setTimeout(res, 5000));
  }
}

runWorker().catch(err => {
  console.error("Fallo crítico en Worker:", err);
  process.exit(1);
});
