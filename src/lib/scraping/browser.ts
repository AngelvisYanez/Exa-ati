import puppeteer from 'puppeteer-core';
import chromium from '@sparticuz/chromium';
import { getConnectedBrowser, getCachedMode, releasePage, closeBrowser } from './bridge';
import type { ConnectionMode } from './bridge';

export async function getBrowser(mode?: ConnectionMode) {
  const isLocal = process.env.NODE_ENV === 'development' || !process.env.VERCEL;

  if (isLocal) {
    const connectionMode = mode || getCachedMode() || 'cdp';
    return getConnectedBrowser(connectionMode);
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

export { getCachedMode, releasePage, closeBrowser };
export type { ConnectionMode };
