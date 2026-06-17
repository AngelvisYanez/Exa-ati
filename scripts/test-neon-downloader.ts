import 'dotenv/config';
import puppeteer from 'puppeteer-extra';
import StealthPlugin from 'puppeteer-extra-plugin-stealth';
import { db } from '../src/lib/sri-api/db';
import { downloadReceivedComprobantes } from '../src/lib/scraping/sri-downloader';
import { solveRecaptchaAntiCaptcha, trySolveRecaptcha, ensureSession } from '../src/lib/scraping/sri-auth';
import path from 'path';
import fs from 'fs';

puppeteer.use(StealthPlugin());

async function updateProgress(jobId: string, message: string, status?: string) {
  console.log(`[Sync Progress] [${status || 'INFO'}] ${message}`);
  let query = "UPDATE scraping_jobs SET progress_message = $1, updated_at = NOW() WHERE id = $2";
  let params = [message, jobId];
  if (status) {
    query = "UPDATE scraping_jobs SET progress_message = $1, status = $2, updated_at = NOW() WHERE id = $3";
    params = [message, status, jobId];
  }
  await db.query(query, params);
}

async function main() {
  const jobId = 3;
  const job = await db.queryOne("SELECT * FROM scraping_jobs WHERE id = $1", [jobId]);
  if (!job) {
    console.error('Job no encontrado');
    return;
  }

  console.log('Job data:', job);

  console.log('[Test] Lanzando browser...');
  const browser = await puppeteer.launch({
    headless: false,
    defaultViewport: null,
    executablePath: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  const page = await browser.newPage();
  
  page.on('console', (msg: any) => console.log(`[Browser Console] ${msg.text()}`));

  console.log('[Test] Asegurando sesión...');
  const loggedIn = await ensureSession(page, job.ruc, job.clave_sri, async (msg: string) => {
    console.log(`[Session Progress] ${msg}`);
  });

  if (!loggedIn) {
    console.error('No se pudo iniciar sesión.');
    await browser.close();
    return;
  }

  console.log('[Test] Corriendo downloadReceivedComprobantes...');
  await downloadReceivedComprobantes(
    page,
    job,
    updateProgress,
    solveRecaptchaAntiCaptcha,
    trySolveRecaptcha
  );

  console.log('[Test] Sincronización finalizada.');
  await browser.close();
}

main().catch(err => {
  console.error('Error en el test:', err);
});
