import { db } from '../../src/lib/sri-api/db.js';
import { getBrowser } from '../../src/lib/scraping/browser.js';
import { ensureSession, solveRecaptchaAntiCaptcha, trySolveRecaptcha } from '../../src/lib/scraping/sri-auth.js';
import { downloadReceivedComprobantes } from '../../src/lib/scraping/sri-downloader.js';
import { config } from 'dotenv';
import ws from 'ws';

config({ path: '.env' });

if (typeof globalThis.WebSocket === 'undefined') {
  globalThis.WebSocket = ws;
}

async function updateProgress(jobId, message, status) {
  console.log(`[Diagnostic Job ${jobId}] ${message} (status: ${status || 'no change'})`);
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
  console.log(`🔍 Starting diagnostic scraping run for Job ID: ${jobId}`);

  const job = await db.queryOne("SELECT * FROM scraping_jobs WHERE id = $1", [jobId]);
  if (!job) {
    console.error('❌ Job not found');
    return;
  }

  // Reset to pending so we can run
  await updateProgress(jobId, 'Starting diagnostic scraping run...', 'PROCESSING');

  let browser = null;
  try {
    browser = await getBrowser();
    const page = await browser.newPage();
    page.setDefaultTimeout(120000);
    page.setDefaultNavigationTimeout(120000);

    page.on('console', msg => console.log(`[Browser Console] ${msg.text()}`));
    page.on('pageerror', err => console.error(`[Browser PageError] ${err.message}`));

    console.log('🔑 Logging in to SRI...');
    const loggedIn = await ensureSession(page, job.ruc, job.clave_sri, async (msg) => {
      await updateProgress(jobId, msg);
    });

    if (!loggedIn) {
      throw new Error('Could not establish session in SRI');
    }

    console.log('📥 Executing downloadReceivedComprobantes...');
    await downloadReceivedComprobantes(
      page,
      job,
      (id, msg, status) => updateProgress(id, msg, status),
      solveRecaptchaAntiCaptcha,
      trySolveRecaptcha
    );

    console.log('✅ Diagnostic scraping completed successfully!');
  } catch (err) {
    console.error('❌ Error during diagnostic run:', err);
    await updateProgress(jobId, `Error diagnóstico: ${err.message}`, 'ERROR');
  } finally {
    if (browser) {
      await browser.close();
    }
  }
}

main().catch(console.error);
