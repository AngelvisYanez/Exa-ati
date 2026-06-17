import puppeteer from 'puppeteer-core';
import chromium from '@sparticuz/chromium';
import fs from 'fs';
import path from 'path';

export async function getBrowser() {
  const isLocal = process.env.NODE_ENV === 'development' || !process.env.VERCEL;

  if (isLocal) {
    const isHeadless = process.env.HEADLESS !== 'false';
    console.log(`[Browser] Iniciando Chrome local (${isHeadless ? 'headless' : 'con interfaz'})...`);
    
    const launchArgs = [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--disable-blink-features=AutomationControlled',
      '--window-size=1366,768',
      '--disable-gpu',
      '--disable-web-security',
    ];

    const busterPath = path.resolve('./scripts/buster');
    if (fs.existsSync(busterPath)) {
      launchArgs.push(`--disable-extensions-except=${busterPath}`);
      launchArgs.push(`--load-extension=${busterPath}`);
    }

    return await puppeteer.launch({
      headless: isHeadless,
      executablePath: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
      args: launchArgs,
      defaultViewport: { width: 1366, height: 768 },
    });
  }

  console.log('[Browser] Iniciando Sparticuz Chromium en Vercel...');
  return await puppeteer.launch({
    args: [...chromium.args, '--hide-scrollbars', '--disable-web-security', '--disable-blink-features=AutomationControlled'],
    defaultViewport: (chromium as any).defaultViewport,
    executablePath: await chromium.executablePath(),
    headless: (chromium as any).headless,
    ignoreHTTPSErrors: true,
  } as any);
}
