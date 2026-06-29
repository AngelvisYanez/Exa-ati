import puppeteer, { Browser, Page } from 'puppeteer-core';
import fs from 'fs';
import path from 'path';
import { spawn, execSync } from 'child_process';

export type ConnectionMode = 'cdp' | 'new_browser' | 'headless_separate' | 'http';

export interface ScrapingJobOptions {
  connection_mode?: ConnectionMode;
  captcha_strategy?: 'auto' | 'anticaptcha' | 'buster' | 'manual';
  debug_screenshots?: boolean;
  verbose_logging?: boolean;
  dom_dump_on_error?: boolean;
  use_listado_txt?: boolean;
  parallel_days?: number;
  soap_sync_limit?: number;
  http_retry_count?: number;
  use_proxy?: boolean;
  proxy_url?: string;
  proxy_id?: number;
}

let cachedBrowser: Browser | null = null;
let cachedMode: ConnectionMode | null = null;

const SESSION_DIR = path.resolve('./browser_session');

const CHROME_PATHS = [
  'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
  'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
  ...(process.env.LOCALAPPDATA
    ? [`${process.env.LOCALAPPDATA}\\Google\\Chrome\\Application\\chrome.exe`]
    : []),
  '/usr/bin/google-chrome',
  '/usr/bin/google-chrome-stable',
  '/usr/bin/chromium-browser',
  '/snap/bin/chromium',
];

function findChromeExecutable(): string | null {
  for (const p of CHROME_PATHS) {
    if (fs.existsSync(p)) return p;
  }
  return null;
}

function isChromeRunning(): boolean {
  try {
    if (process.platform === 'win32') {
      execSync('tasklist /FI "IMAGENAME eq chrome.exe" /NH', { stdio: 'pipe', timeout: 3000 });
      return true;
    }
    return true;
  } catch {
    return false;
  }
}

function ensureSessionDir(): void {
  if (!fs.existsSync(SESSION_DIR)) {
    fs.mkdirSync(SESSION_DIR, { recursive: true });
  }
}

async function connectCDP(): Promise<Browser> {
  console.log('[Bridge] Conectando a Chrome vía CDP (puerto 9222)...');
  const browser = await puppeteer.connect({
    browserURL: 'http://127.0.0.1:9222',
    defaultViewport: { width: 1366, height: 768 },
  });
  console.log('[Bridge] Conectado al navegador.');
  return browser;
}

async function launchCDPBrowser(): Promise<Browser> {
  const chromePath = findChromeExecutable();
  if (!chromePath) throw new Error('No se encontró Chrome en el sistema.');

  ensureSessionDir();
  console.log(`[Bridge] Lanzando Chrome con --remote-debugging-port=9222 (session: ${SESSION_DIR})...`);

  const proc = spawn(chromePath, [
    `--remote-debugging-port=9222`,
    `--user-data-dir="${SESSION_DIR}"`,
    '--no-first-run',
    '--no-default-browser-check',
    '--disable-blink-features=AutomationControlled',
    '--window-size=1366,768',
  ], { detached: true, stdio: 'ignore' });

  proc.unref();

  for (let i = 0; i < 15; i++) {
    await new Promise(r => setTimeout(r, 2000));
    try {
      const browser = await puppeteer.connect({
        browserURL: 'http://127.0.0.1:9222',
        defaultViewport: { width: 1366, height: 768 },
      });
      console.log('[Bridge] Chrome lanzado y conectado con debug port.');
      return browser;
    } catch {
      console.log(`[Bridge] Esperando que Chrome arranque... (${i + 1}/15)`);
    }
  }
  throw new Error('No se pudo conectar al Chrome lanzado después de 30s.');
}

export async function getConnectedBrowser(mode: ConnectionMode = 'cdp'): Promise<Browser> {
  if (cachedBrowser && cachedMode === mode) {
    try {
      await cachedBrowser.pages();
      return cachedBrowser;
    } catch {
      cachedBrowser = null;
      cachedMode = null;
    }
  }

  await closeBrowser();

  if (mode === 'http') {
    throw new Error('http mode no usa Puppeteer. Usa SriHttpScraper directamente.');
  }

  if (mode === 'cdp') {
    try {
      cachedBrowser = await connectCDP();
      cachedMode = mode;
      return cachedBrowser;
    } catch {
      console.log('[Bridge] CDP no disponible en puerto 9222. Lanzando Chrome persistente...');
    }

    try {
      cachedBrowser = await launchCDPBrowser();
      cachedMode = mode;
      console.log('[Bridge] ✅ Chrome lanzado en modo CDP. La sesión SRI persistirá en ./browser_session/');
      return cachedBrowser;
    } catch (err: any) {
      console.warn(`[Bridge] Error lanzando Chrome con debug port: ${err.message}. Fallback a new_browser.`);
    }
  }

  if (mode === 'new_browser') {
    const chromePath = findChromeExecutable() || 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
    try {
      console.log('[Bridge] Lanzando Chrome visible con perfil personal...');
      cachedBrowser = await puppeteer.launch({
        headless: false,
        executablePath: chromePath,
        args: [
          '--no-sandbox',
          '--disable-setuid-sandbox',
          '--disable-dev-shm-usage',
          '--disable-blink-features=AutomationControlled',
          '--window-size=1366,768',
        ],
        defaultViewport: { width: 1366, height: 768 },
      });
      cachedMode = mode;
      return cachedBrowser;
    } catch {
      console.warn('[Bridge] Fallback a headless_separate.');
    }
  }

  console.log('[Bridge] Lanzando Chrome headless con sesión aislada...');
  const isHeadless = process.env.HEADLESS !== 'false';
  const chromePath = findChromeExecutable() || 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
  const launchArgs = [
    '--no-sandbox',
    '--disable-setuid-sandbox',
    '--disable-dev-shm-usage',
    '--disable-blink-features=AutomationControlled',
  ];
  const busterPath = path.resolve('./scripts/buster');
  if (fs.existsSync(busterPath)) {
    launchArgs.push(`--disable-extensions-except=${busterPath}`);
    launchArgs.push(`--load-extension=${busterPath}`);
  }
  cachedBrowser = await puppeteer.launch({
    headless: isHeadless ? ('shell' as any) : false,
    defaultViewport: null,
    userDataDir: SESSION_DIR,
    executablePath: chromePath,
    args: launchArgs,
  });
  cachedMode = mode;
  return cachedBrowser;
}

export function getCachedMode(): ConnectionMode | null {
  return cachedMode;
}

export async function releasePage(page: Page): Promise<void> {
  try {
    await page.close();
  } catch {}
}

export async function closeBrowser(): Promise<void> {
  if (cachedBrowser) {
    try {
      if (cachedMode === 'cdp') {
        await cachedBrowser.disconnect();
      } else {
        await cachedBrowser.close();
      }
    } catch {}
    cachedBrowser = null;
    cachedMode = null;
  }
}

export function parseJobOptions(optionsStr: string | null | undefined): ScrapingJobOptions {
  if (!optionsStr) return {};
  try {
    return JSON.parse(optionsStr);
  } catch {
    return {};
  }
}

export function isDevMode(): boolean {
  return process.env.NODE_ENV === 'development' || process.env.NEXT_PUBLIC_DEV_MODE === 'true';
}
