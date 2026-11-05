import playwright, { Browser, Page, BrowserContext, Download } from 'playwright';
import path from 'path';
import fs from 'fs';
import os from 'os';
// @ts-expect-error - no types available for anticaptchaofficial
import ac from '@antiadmin/anticaptchaofficial';
import { updateComprobanteFromXml, extractRuc, cleanEmisorRazonSocial, parseSriFloat, extractSerie, extractSecuencial, extractFechaEmision } from './sri-utils';
import { getChromiumExecutablePath } from './chromium';
import { db } from '../sri-api/db';
import { saveAutorizadoXml } from '../sri-api/comprobante-importer';
import { resolveComprobanteXml } from '../sri-api/comprobante-xml-resolver';

/** True solo si todos los comprobantes del job tienen XML en sistema/BD. */
export function isMassDownloadFullySynced(summary: MassDownloadSummary): boolean {
  if (summary.targetsExpected != null) {
    return (
      summary.xmlsSynced === summary.targetsExpected &&
      summary.targetsMissing === 0 &&
      summary.xmlsFailed === 0
    );
  }
  if (summary.found === 0) return true;
  return summary.xmlsSynced === summary.found && summary.xmlsFailed === 0;
}

const SRI_BASE = 'https://srienlinea.sri.gob.ec';
const RECAPTCHA_SITE_KEY = '6LdukTQsAAAAAIcciM4GZq4ibeyplUhmWvlScuQE';

export interface ScrapeOptions {
  headless?: boolean;
  userDataDir?: string;
  diagDir?: string;
  proxyUrl?: string;
}

interface ScrapeCounters {
  found: number;
  xmls: number;
  pdfs: number;
  xmls_exist: number;
  pdfs_exist: number;
  /** XML guardado en disco + comprobante_xmls + AUTORIZADO */
  xmls_synced: number;
  /** Filas vistas sin XML usable en el sistema */
  xmls_failed: number;
}

export interface MassDownloadSummary {
  found: number;
  xmls: number;
  pdfs: number;
  xmlsExist: number;
  pdfsExist: number;
  xmlsSynced: number;
  xmlsFailed: number;
  /** Claves pedidas en options.clavesAcceso (null = descarga masiva normal) */
  targetsExpected: number | null;
  /** Claves objetivo no aparecieron en el portal */
  targetsMissing: number;
  missingClaves: string[];
}

/** Parse DATE / YYYY-MM-DD without timezone shift (Ecuador UTC-5 breaks `new Date('YYYY-MM-DD')`). */
export function parseJobCalendarDate(value: unknown): { year: number; month: number; day: number } {
  if (value instanceof Date && !isNaN(value.getTime())) {
    // DATE columns arrive as UTC midnight; use UTC parts (local getters shift the day in EC).
    return {
      year: value.getUTCFullYear(),
      month: value.getUTCMonth() + 1,
      day: value.getUTCDate(),
    };
  }
  const s = String(value ?? '').trim().slice(0, 10);
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s);
  if (!m) {
    throw new Error(`Fecha de job inválida: ${String(value)}`);
  }
  return { year: Number(m[1]), month: Number(m[2]), day: Number(m[3]) };
}

export function lastDayOfMonth(year: number, month: number): number {
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

export function buildSearchPeriods(
  start: { year: number; month: number; day: number },
  end: { year: number; month: number; day: number },
  flow: 'recibidos' | 'emitidos',
): { year: number; month: number; day: number }[] {
  const isWholeMonth =
    start.year === end.year &&
    start.month === end.month &&
    start.day === 1 &&
    end.day === lastDayOfMonth(start.year, start.month);

  // Recibidos: el portal permite Día = "Todos" (mes completo).
  // Emitidos: solo un día a la vez → iterar día por día.
  if (isWholeMonth && flow === 'recibidos') {
    return [{ year: start.year, month: start.month, day: 0 }];
  }

  const periods: { year: number; month: number; day: number }[] = [];
  const cursor = new Date(Date.UTC(start.year, start.month - 1, start.day));
  const endUtc = new Date(Date.UTC(end.year, end.month - 1, end.day));
  while (cursor.getTime() <= endUtc.getTime()) {
    periods.push({
      year: cursor.getUTCFullYear(),
      month: cursor.getUTCMonth() + 1,
      day: cursor.getUTCDate(),
    });
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }
  return periods;
}

export class SriPlaywrightScraper {
  private browser: Browser | null = null;
  private context: BrowserContext | null = null;
  private page: Page | null = null;
  private authenticated = false;
  private ruc = '';
  private clave = '';
  private tenantId: string | null = null;
  private headless: boolean;
  private diagDir: string;
  private downloadsDir = '';
  private proxyUrl?: string;
  private userDataDir?: string;
  /** Si está definido, solo descarga esas claves de acceso. */
  private targetClaves: Set<string> | null = null;
  private seenTargetClaves: Set<string> = new Set();

  constructor(opts?: ScrapeOptions) {
    this.headless = opts?.headless ?? process.env.HEADLESS !== 'false';
    this.diagDir = opts?.diagDir || path.join(os.tmpdir(), 'downloads', 'debug');
    this.proxyUrl = opts?.proxyUrl;
    this.userDataDir = opts?.userDataDir;
  }

  async init(): Promise<void> {
    const apiKey = process.env.SCRAPELESS_API_KEY;
    if (apiKey) {
      console.log('[Scrapeless] Conectando a Scraping Browser de Scrapeless...');
      const { Playwright } = require('@scrapeless-ai/sdk');
      this.browser = await Playwright.connect({
        apiKey: apiKey,
        // SRI exige IP Ecuador; Scrapeless provee el egress geolocalizado.
        proxyCountry: process.env.SCRAPELESS_PROXY_COUNTRY || 'EC',
        sessionName: 'sri_playwright_scraper',
        sessionTTL: 300,
      });
      if (!this.browser) {
        throw new Error('No se pudo inicializar el navegador Scrapeless');
      }
      // El navegador devuelto por connect() de Scrapeless es una instancia de Playwright Browser
      this.context = this.browser.contexts()[0] || await this.browser.newContext({
        viewport: { width: 1366, height: 768 },
        userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/149.0.0.0 Safari/537.36',
        locale: 'es-EC',
        timezoneId: 'America/Guayaquil',
        permissions: ['geolocation'],
        extraHTTPHeaders: { 'Accept-Language': 'es-EC,es;q=0.9' },
      });
      this.page = this.context.pages()[0] || await this.context.newPage();
    } else {
      const busterPath = path.resolve('./scripts/buster');
      // Extensiones no son fiables en headless clásico; solo cargar Buster en headed.
      const hasBuster = !this.headless && fs.existsSync(busterPath);

      const launchArgs = [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-web-security',
        '--disable-blink-features=AutomationControlled',
        '--disable-features=IsolateOrigins,site-per-process',
        '--hide-scrollbars',
      ];

      if (this.headless) {
        launchArgs.push('--headless=new');
      }

      if (hasBuster) {
        launchArgs.push(`--disable-extensions-except=${busterPath}`);
        launchArgs.push(`--load-extension=${busterPath}`);
      }

      const contextOptions: any = {
        headless: this.headless,
        args: launchArgs,
        acceptDownloads: true,
        downloadsPath: path.join(process.cwd(), 'downloads', 'temp'),
        viewport: { width: 1366, height: 768 },
        userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/149.0.0.0 Safari/537.36',
        locale: 'es-EC',
        timezoneId: 'America/Guayaquil',
        permissions: ['geolocation'],
        extraHTTPHeaders: { 'Accept-Language': 'es-EC,es;q=0.9' },
      };
      fs.mkdirSync(contextOptions.downloadsPath, { recursive: true });
      this.downloadsDir = contextOptions.downloadsPath;

      if (this.proxyUrl) {
        try {
          const purl = new URL(this.proxyUrl);
          contextOptions.proxy = {
            server: `${purl.protocol}//${purl.hostname}:${purl.port}`,
            username: purl.username || undefined,
            password: purl.password || undefined,
          };
          const logMsg = `Proxy activado para Playwright: ${purl.hostname}:${purl.port}`;
          console.log(`[PW] ${logMsg}`);
        } catch (e: any) {
          console.log(`[PW] Error parsing proxy URL "${this.proxyUrl}": ${e.message}`);
        }
      }

      // En serverless/cPanel el /tmp suele estar montado con `noexec`, y
      // @sparticuz/chromium extrae a /tmp y devuelve /tmp/chromium -> EACCES.
      // Se extrae el binario a un directorio ejecutable dentro de la app.
      let chromiumServerless: any;
      try {
        const mod = await import('@sparticuz/chromium');
        chromiumServerless = mod.default || mod;
        console.log('[PW] @sparticuz/chromium importado OK');
      } catch (e: any) {
        console.log('[PW] @sparticuz/chromium no disponible:', e?.message || e);
      }
      if (chromiumServerless) {
        try {
          const execPath = await getChromiumExecutablePath();
          if (execPath) {
            contextOptions.executablePath = execPath;
            contextOptions.args = [...(chromiumServerless.args || []), ...launchArgs];
            console.log('[PW] Usando chromium de la app:', execPath);
          } else {
            console.log('[PW] No se pudo preparar chromium; se usará el canal por defecto');
          }
        } catch (e: any) {
          console.log('[PW] Error usando @sparticuz/chromium:', e?.message || e);
        }
      }
      if (!contextOptions.executablePath) {
        const channel = process.env.PLAYWRIGHT_CHANNEL;
        const chromeCandidates = [
          process.env.PLAYWRIGHT_CHROME_PATH,
          'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
          'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
          path.join(process.env.LOCALAPPDATA || '', 'ms-playwright', 'chromium-1228', 'chrome-win64', 'chrome.exe'),
          path.join(process.env.LOCALAPPDATA || '', 'ms-playwright', 'chromium-1234', 'chrome-win64', 'chrome.exe'),
        ].filter(Boolean) as string[];

        const localChrome = chromeCandidates.find((p) => fs.existsSync(p));
        if (localChrome) {
          contextOptions.executablePath = localChrome;
          console.log('[PW] Usando Chrome/Chromium local:', localChrome);
        } else {
          contextOptions.channel = channel === 'none' ? undefined : (channel || 'chrome');
          console.log('[PW] Usando navegador Chromium por defecto, channel:', contextOptions.channel);
        }
      }

      const userDataDir =
        this.userDataDir ||
        path.join(process.cwd(), 'tmp', 'browser_session', 'sri_user_profile');
      fs.mkdirSync(userDataDir, { recursive: true });

      const chromium = playwright.chromium;

      const context = await chromium.launchPersistentContext(userDataDir, contextOptions);
      this.context = context;
      this.page = context.pages()[0] || await context.newPage();
    }

    if (!this.page) {
      throw new Error('Navegador o página no inicializada correctamente.');
    }
    const page = this.page;

    // Anti-detección: ocultar webdriver, plugins y otras huellas (inyectado como string para evitar helpers de esbuild)
    await page.addInitScript(`
      window.__name = (target, value) => {
        try {
          Object.defineProperty(target, 'name', { value, configurable: true });
        } catch (e) {}
        return target;
      };
      if (typeof globalThis !== 'undefined') {
        globalThis.__name = window.__name;
      }
      Object.defineProperty(navigator, 'webdriver', { get: () => false });
      Object.defineProperty(navigator, 'plugins', { get: () => [1, 2, 3, 4, 5] });
      Object.defineProperty(navigator, 'languages', { get: () => ['es-EC', 'es', 'en'] });
      Object.defineProperty(navigator, 'hardwareConcurrency', { get: () => 8 });
    `);

    // Diagnóstico de Consola del Navegador
    page.on('console', msg => {
      const txt = msg.text();
      if (txt.toLowerCase().includes('captcha') || msg.type() === 'error' || txt.includes('PrimeFaces')) {
        console.log(`   [Consola Navegador] [${msg.type()}] ${txt}`);
      }
    });

    page.on('pageerror', err => {
      console.error(`   [Consola Navegador] [PageError] ${err.message}`);
    });

    page.on('request', req => {
      const url = req.url();
      if (url.includes('.jsf') || url.includes('comprobantesRecibidos')) {
        console.log(`   [Network Request] ${req.method()} ${url}`);
      }
    });

    page.on('response', res => {
      const url = res.url();
      if (url.includes('.jsf') || url.includes('comprobantesRecibidos')) {
        console.log(`   [Network Response] [${res.status()}] ${url}`);
      }
    });

    this.downloadsDir = fs.mkdtempSync(path.join(os.tmpdir(), 'pw-downloads-'));
  }

  async login(ruc: string, clave: string, progress?: (msg: string) => Promise<void>): Promise<boolean> {
    this.ruc = ruc;
    this.clave = clave;
    const log = progress || (async (msg: string) => console.log('[PW]', msg));
    const { isProxyFailureError } = await import('@/services/scraping/proxy-assigner');
    let lastProxyError: Error | null = null;

    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        await log(`Iniciando sesion (intento ${attempt + 1}/3)...`);
        const ok = await this._loginAttempt(ruc, clave, log);
        if (ok) {
          this.authenticated = true;
          await log('Sesion iniciada correctamente.');
          return true;
        }
        if (attempt < 2) {
          await log(`Reintentando en ${2 * (attempt + 1)}s...`);
          await new Promise(r => setTimeout(r, 2000 * (attempt + 1)));
        }
      } catch (err: any) {
        await log(`Error en intento ${attempt + 1}: ${err.message}`);
        if (isProxyFailureError(err)) {
          lastProxyError = err instanceof Error ? err : new Error(String(err?.message || err));
          // Un intento de red fallido basta para rotar proxy EC (no quemar 3×60s).
          throw lastProxyError;
        }
        lastProxyError = err instanceof Error ? err : new Error(String(err?.message || err));
        if (attempt < 2) await new Promise(r => setTimeout(r, 2000 * (attempt + 1)));
      }
    }
    if (lastProxyError) throw lastProxyError;
    return false;
  }

  private async _loginAttempt(ruc: string, clave: string, log: (msg: string) => Promise<void>): Promise<boolean> {
    const page = this.page!;

    await log('Navegando al portal SRI...');
    await page.goto(`${SRI_BASE}/sri-en-linea/contribuyente/perfil`, { waitUntil: 'domcontentloaded', timeout: 60000 });
    await page.waitForTimeout(5000);

    const needsLogin = await page.evaluate(() => {
      const url = window.location.href;
      if (url.includes('login') || url.includes('openid-connect/auth')) return true;
      const visibleInput = document.querySelector('input#usuario:not([type="hidden"]), input[name="usuario"]:not([type="hidden"])');
      return visibleInput !== null;
    });

    if (!needsLogin) {
      this.authenticated = true;
      await log('Sesion ya activa.');
      return true;
    }

    await log('Llenando formulario de login con caracteres individuales...');
    const userInput = page.locator('input#usuario:not([type="hidden"]), input[name="usuario"]:not([type="hidden"])').first();
    await userInput.waitFor({ state: 'visible', timeout: 30000 });
    await userInput.click();
    await userInput.fill(''); // Limpiar autocompletado
    await userInput.pressSequentially(ruc, { delay: 50 });
    await page.waitForTimeout(800);

    const passInput = page.locator('input#password:not([type="hidden"]), input[name="password"]:not([type="hidden"])').first();
    await passInput.waitFor({ state: 'visible', timeout: 10000 });
    await passInput.click();
    await passInput.fill(''); // Limpiar autocompletado
    await passInput.pressSequentially(clave, { delay: 50 });
    await page.waitForTimeout(800);

    const apiKey = process.env.ANTICAPTCHA_KEY;
    if (apiKey) {
      await log('Pre-resolviendo CAPTCHA con Anti-Captcha...');
      await this._solveCaptcha(page, 'login');
    }

    await log('Haciendo clic en Ingresar...');
    const submitBtn = page.locator(
      'button[type="submit"], input[type="submit"], button#kc-login, .btn-primary, input#kc-login'
    ).first();
    try {
      await submitBtn.waitFor({ timeout: 10000 });
      await submitBtn.click({ force: true });
    } catch {
      await page.evaluate(() => {
        const btn = document.querySelector<HTMLElement>('button[type="submit"], input[type="submit"], button#kc-login');
        if (btn) btn.click();
      });
    }

    for (let i = 0; i < 30; i++) {
      await page.waitForTimeout(1000);
      try {
        const url = page.url();
        if (!url.includes('login') && !url.includes('openid-connect/auth') && !url.includes('keycloak')) {
          await log('Redireccion post-login detectada.');
          await page.waitForTimeout(3000);
          return true;
        }
      } catch {
        await page.waitForTimeout(1000);
        try {
          const url = page.url();
          if (!url.includes('login') && !url.includes('openid-connect/auth')) {
            await page.waitForTimeout(3000);
            return true;
          }
        } catch {}
      }
      const busterSolved = await this._tryBuster(page);
      if (busterSolved) {
        await page.locator(
          'button[type="submit"], input[type="submit"], button#kc-login, .btn-primary, input#kc-login'
        ).first().click({ force: true }).catch(() => {});
      }
    }

    await captureDiagnosticInfo(page, 'login-failed', this.diagDir);
    await log('No se detecto redireccion post-login. Capturado diagnostico.');
    return false;
  }

  async ensureAuthenticated(): Promise<boolean> {
    if (!this.authenticated && this.ruc && this.clave) {
      return this.login(this.ruc, this.clave);
    }
    return this.authenticated;
  }

  async navigateToComprobantes(flow: 'recibidos' | 'emitidos' = 'recibidos', progress?: (msg: string) => Promise<void>): Promise<boolean> {
    const page = this.page!;
    const log = progress || (async (msg: string) => console.log('[PW]', msg));
    const flowLabel = flow === 'emitidos' ? 'Emitidos' : 'Recibidos';

    try {
      await log(`Navegando a Comprobantes ${flowLabel}...`);
      const redirectCode = flow === 'emitidos' ? '56' : '57';
      await page.goto(`${SRI_BASE}/tuportal-internet/accederAplicacion.jspa?redireccion=${redirectCode}&idGrupo=55`, {
        waitUntil: 'domcontentloaded',
        timeout: 60000,
      }).catch((err: any) => {
        if (err.message?.includes('ERR_ABORTED')) console.log('[PW] Navigation abort (redirect)');
        else throw err;
      });

      await page.waitForLoadState('domcontentloaded').catch(() => {});
      await page.waitForTimeout(3000);

      const hasForm = await page.locator('select[id*="ano"], select[name*="ano"], form[id*="frmPrincipal"]').first().isVisible().catch(() => false);
      if (!hasForm) {
        const rucRadio = page.locator('input[id*="opciones:0"], input[value="ruc"]').first();
        if (await rucRadio.isVisible().catch(() => false)) {
          await rucRadio.click();
          await page.waitForTimeout(2000);
        }
        await page.waitForTimeout(3000);
      }

      await page.locator('select[id*="ano"]').first().waitFor({ timeout: 30000 }).catch(() => {});
      await page.waitForTimeout(2000);

      const isLogin = await page.evaluate(() => window.location.href.includes('login'));
      if (isLogin) {
        await log('Sesion expirada, re-autenticando...');
        this.authenticated = false;
        return false;
      }

      return true;
    } catch (err: any) {
      await log(`Error navegando a comprobantes: ${err.message}`);
      await captureDiagnosticInfo(page, 'navigate-error', this.diagDir);
      const { isProxyFailureError } = await import('@/services/scraping/proxy-assigner');
      if (isProxyFailureError(err)) throw err;
      return false;
    }
  }

  async runMassDownload(
    job: any,
    updateProgress: (jobId: string, msg: string, status?: string) => Promise<void>,
    flow: 'recibidos' | 'emitidos' = 'recibidos',
  ): Promise<MassDownloadSummary> {
    const jobId = job.id;
    const flowLabel = flow === 'emitidos' ? 'Emitidos' : 'Recibidos';
    const log = async (msg: string) => updateProgress(jobId, msg);

    if (!this.authenticated) {
      const ok = await this.login(this.ruc, this.clave, log);
      if (!ok) throw new Error('No se pudo iniciar sesion.');
    }

    this.tenantId = job.tenant_id || null;

    this.targetClaves = null;
    this.seenTargetClaves = new Set();
    try {
      const rawOpts = job.options
        ? typeof job.options === 'string'
          ? JSON.parse(job.options)
          : job.options
        : {};
      const claves = Array.isArray(rawOpts?.clavesAcceso)
        ? rawOpts.clavesAcceso.filter((c: unknown) => typeof c === 'string' && String(c).length === 49)
        : [];
      if (claves.length > 0) {
        this.targetClaves = new Set(claves);
        await log(`Descarga puntual: solo ${claves.length} clave(s) objetivo`);

        // Si todas ya están en sistema/BD, COMPLETED sin re-entrar al portal.
        const already: string[] = [];
        for (const clave of claves) {
          if (await this._xmlAlreadyInSystem(clave)) already.push(clave);
        }
        if (already.length === claves.length) {
          await log(
            `Las ${already.length} clave(s) ya tienen XML almacenado en sistema/BD — omitiendo scrape.`,
          );
          return {
            found: already.length,
            xmls: 0,
            pdfs: 0,
            xmlsExist: already.length,
            pdfsExist: 0,
            xmlsSynced: already.length,
            xmlsFailed: 0,
            targetsExpected: claves.length,
            targetsMissing: 0,
            missingClaves: [],
          };
        }
        const pending = claves.length - already.length;
        if (already.length > 0) {
          await log(`${already.length} ya en sistema; faltan ${pending} por descargar del portal`);
        }
      }
    } catch {
      this.targetClaves = null;
    }

    const start = parseJobCalendarDate(job.fecha_desde);
    const end = parseJobCalendarDate(job.fecha_hasta);
    const docType = job.tipo_comprobante || '1';
    const typeCodes = docType === 'todos' ? ['1', '2', '3', '4', '6'] : [docType];

    const xmlDir = path.join(process.cwd(), 'downloads', 'XML');
    const pdfDir = path.join(process.cwd(), 'downloads', 'RIDE');
    fs.mkdirSync(xmlDir, { recursive: true });
    fs.mkdirSync(pdfDir, { recursive: true });

    const counters: ScrapeCounters = {
      found: 0,
      xmls: 0,
      pdfs: 0,
      xmls_exist: 0,
      pdfs_exist: 0,
      xmls_synced: 0,
      xmls_failed: 0,
    };

    const searchPeriods = buildSearchPeriods(start, end, flow);
    if (searchPeriods.length === 1 && searchPeriods[0].day === 0) {
      await log(`Modo mes completo (${this._monthName(start.month)} ${start.year}) vía Día=Todos`);
    } else if (
      start.day === 1 &&
      end.day === lastDayOfMonth(start.year, start.month) &&
      start.month === end.month &&
      flow === 'emitidos'
    ) {
      await log(
        `Emitidos no admiten Día=Todos en el portal; consultando día a día (${searchPeriods.length} días)...`
      );
    }

    let portalHardFailures = 0;

    for (const period of searchPeriods) {
      const year = period.year;
      const month = period.month;
      const day = period.day;

      for (const typeCode of typeCodes) {
        const typeLabel = this._typeLabel(typeCode);
        const periodStr = day === 0 
          ? `mes completo de ${this._monthName(month)} ${year}`
          : `${day.toString().padStart(2,'0')}/${month.toString().padStart(2,'0')}/${year}`;
        await log(`Buscando ${typeLabel} (${flowLabel}) para ${periodStr}...`);

        try {
          const ok = await this._searchAndDownload(year, month, day, typeCode, xmlDir, pdfDir, counters, log, flow);
          if (!ok) {
            await this._recoverSession(log);
          }
        } catch (err: any) {
          portalHardFailures++;
          const { isProxyFailureError } = await import('@/services/scraping/proxy-assigner');
          // Si ya hay filas, terminar el flujo y dejar que el job-runner rote proxy.
          // Si aún no hay nada, propagar para hop inmediato.
          if (counters.found === 0 && (isProxyFailureError(err) || /select |sin resultados confiables|net::err/i.test(String(err?.message || '')))) {
            throw err;
          }
          await log(`Continuando tras fallo de portal (${typeLabel}): ${err.message}`);
          await this._recoverSession(log).catch(() => {});
        }
      }
    }

    if (counters.found === 0 && portalHardFailures > 0) {
      throw new Error(
        `Portal SRI sin resultados confiables (${portalHardFailures} fallo(s); posible proxy/sesión).`,
      );
    }

    const missingClaves = this.targetClaves
      ? [...this.targetClaves].filter((c) => !this.seenTargetClaves.has(c))
      : [];
    if (missingClaves.length > 0) {
      counters.xmls_failed += missingClaves.length;
      for (const c of missingClaves) {
        await log(`Clave objetivo no encontrada en el portal (sin XML): ${c}`);
      }
    }
    const totalXmls = counters.xmls + counters.xmls_exist;
    const totalPdfs = counters.pdfs + counters.pdfs_exist;
    await log(
      `Flujo ${flowLabel} listo. Comprobantes: ${counters.found}. ` +
        `XML en sistema: ${counters.xmls_synced}/${this.targetClaves ? this.targetClaves.size : counters.found} ` +
        `(archivos: ${totalXmls}, fallidos: ${counters.xmls_failed}` +
        `${missingClaves.length ? `, no encontrados: ${missingClaves.length}` : ''}). ` +
        `PDFs: ${totalPdfs}`
    );

    return {
      found: counters.found,
      xmls: counters.xmls,
      pdfs: counters.pdfs,
      xmlsExist: counters.xmls_exist,
      pdfsExist: counters.pdfs_exist,
      xmlsSynced: counters.xmls_synced,
      xmlsFailed: counters.xmls_failed,
      targetsExpected: this.targetClaves ? this.targetClaves.size : null,
      targetsMissing: missingClaves.length,
      missingClaves,
    };
  }

  private async _searchAndDownload(
    year: number, month: number, day: number, typeCode: string,
    xmlDir: string, pdfDir: string, counters: ScrapeCounters,
    log: (msg: string) => Promise<void>,
    flow: 'recibidos' | 'emitidos' = 'recibidos',
  ): Promise<boolean> {
    const page = this.page!;
    const dateStr = day === 0
      ? `Mes completo (${month.toString().padStart(2,'0')}/${year})`
      : `${day.toString().padStart(2,'0')}/${month.toString().padStart(2,'0')}/${year}`;

    try {
      const navOk = await this.navigateToComprobantes(flow, log);
      if (!navOk) {
        const relogged = await this.login(this.ruc, this.clave, log);
        if (!relogged) return false;
        await this.navigateToComprobantes(flow, log);
      }

      await page.waitForTimeout(2000);

      await this._selectAndVerify(page, 'select[id*="ano"]', String(year), log);
      await this._selectFormValue(page, 'select[id*="mes"]', [String(month), month.toString().padStart(2, '0')], log);
      await this._selectDay(page, day, log);
      await this._selectAndVerify(page, 'select[id*="cmbTipoComprobante"]', String(typeCode), log);

      await page.evaluate(() => {
        document.querySelectorAll('.ui-messages-close, [class*="close"], .rf-msg-close')
          .forEach(el => (el as HTMLElement).click());
      }).catch(() => {});

      // Espera antes de Consultar: el portal SRI suele aceptar la consulta tras unos minutos
      // sin resolver CAPTCHA por API. Configurable con SRI_CONSULTAR_WAIT_MS (default 90s).
      const consultarWaitMs = Math.max(0, Number(process.env.SRI_CONSULTAR_WAIT_MS || 90000));

      for (let attempt = 0; attempt < 3; attempt++) {
        const apiKey = process.env.ANTICAPTCHA_KEY?.trim();

        // Ruta opcional: Anti-Captcha solo si hay key (no es obligatorio).
        if (apiKey) {
          await log(`Pre-resolviendo CAPTCHA para ${dateStr} (intento ${attempt + 1})...`);
          const captchaSolved = await this._solveCaptcha(page, 'consulta_cel_recibidos');

          if (captchaSolved) {
            await log(`Enviando formulario con CAPTCHA resuelto...`);
            const submitted = await page.evaluate(() => {
              const form = document.getElementById('frmPrincipal') as HTMLFormElement;
              if (!form) return false;
              let hidden = form.querySelector('input[name="frmPrincipal\\:btnBuscar"]') as HTMLInputElement;
              if (!hidden) {
                hidden = document.createElement('input');
                hidden.type = 'hidden';
                hidden.name = 'frmPrincipal:btnBuscar';
                hidden.value = 'Consultar';
                form.appendChild(hidden);
              }
              form.submit();
              return true;
            });

            if (submitted) {
              try {
                await page.waitForLoadState('domcontentloaded', { timeout: 30000 }).catch(() => {});
                await page.waitForTimeout(4000);
              } catch {}
            }

            const checkResult = await page.evaluate(() => {
              const text = document.body?.innerText || '';
              const hasTable = document.querySelector('#frmPrincipal\\:tablaCompRecibidos tr, [id*="tablaCompRecibidos"] tr, #frmPrincipal\\:tablaCompEmitidos tr, [id*="tablaCompEmitidos"] tr') !== null;
              if (hasTable && text.match(/\d{49}/)) return 'table';
              if ((text.includes('No se encontraron') || text.includes('No existen') || text.includes('No se encontraron registros') || text.includes('No se encontraron comprobantes')) && !text.match(/\d{49}/)) return 'no_results';
              const errors = document.querySelectorAll('.ui-messages-error, .ui-message-error, .rf-msg-err, [class*="error"], [class*="alert"]');
              for (const el of errors) {
                if ((el as HTMLElement).innerText.toLowerCase().includes('captcha')) return 'captcha_error';
              }
              if (text.includes('Captcha incorrecta') || text.includes('CAPTCHA incorrecto')) return 'captcha_error';
              return 'timeout';
            });

            await log(`Resultado busqueda: ${checkResult}`);
            if (checkResult === 'table') {
              const txtDownloaded = await this._downloadTxtListado(page, `${year}${month.toString().padStart(2,'0')}${day.toString().padStart(2,'0')}`, log);
              await log(`TXT listado: ${txtDownloaded ? 'descargado' : 'no disponible'}`);
              await this._processTableResults(page, xmlDir, pdfDir, counters, log);
              return true;
            }
            if (checkResult === 'no_results') {
              await log(`Sin resultados para ${dateStr} tipo ${typeCode}`);
              return true;
            }
            if (checkResult === 'captcha_error') {
              await log(`CAPTCHA error con solver; pasando a espera + clic Consultar...`);
              await page.evaluate(() => {
                document.querySelectorAll('.ui-messages-close, [class*="close"], .rf-msg-close')
                  .forEach(el => (el as HTMLElement).click());
              }).catch(() => {});
            } else if (checkResult === 'timeout' && attempt < 2) {
              await log(`Timeout con solver en intento ${attempt + 1}; reintentando vía espera + Consultar...`);
            }
          }
        }

        // Flujo principal (sin AntiCaptcha): esperar y pulsar Consultar.
        if (consultarWaitMs > 0) {
          await log(
            `Esperando ${Math.round(consultarWaitMs / 1000)}s antes de Consultar (${dateStr}, intento ${attempt + 1}/3)...`
          );
          await page.waitForTimeout(consultarWaitMs);
        }

        await this._clickConsultar(page);
        const before = Date.now();
        const searchTimeout = this.headless ? 60000 : 120000;
        const searchResult = await this._waitForSearchResult(page, searchTimeout);
        const elapsed = Date.now() - before;
        await log(`Resultado busqueda: ${searchResult} (${elapsed}ms)`);

        if (searchResult === 'table') {
          const txtDownloaded = await this._downloadTxtListado(page, `${year}${month.toString().padStart(2,'0')}${day.toString().padStart(2,'0')}`, log);
          await log(`TXT listado: ${txtDownloaded ? 'descargado' : 'no disponible'}`);
          await this._processTableResults(page, xmlDir, pdfDir, counters, log);
          return true;
        }
        if (searchResult === 'no_results') {
          await log(`Sin resultados para ${dateStr} tipo ${typeCode}`);
          return true;
        }
        if (searchResult === 'captcha_error') {
          await log(`CAPTCHA visual en intento ${attempt + 1}; reintentando tras nueva espera...`);
          await page.evaluate(() => {
            document.querySelectorAll('.ui-messages-close, [class*="close"], .rf-msg-close')
              .forEach(el => (el as HTMLElement).click());
          }).catch(() => {});
          await page.waitForTimeout(2000);
          continue;
        }
        if (searchResult === 'timeout' && attempt < 2) {
          await log(`Timeout en intento ${attempt + 1}, reintentando...`);
          continue;
        }
      }

      await captureDiagnosticInfo(page, `failed-${year}${month}${day}`, this.diagDir);
      await log(`No se pudieron obtener resultados para ${dateStr} tras 3 intentos.`);
      // Formulario inaccesible / CAPTCHA / timeout: no fingir periodo vacío.
      throw new Error(`Portal SRI sin resultados confiables para ${dateStr} (posible proxy/sesión).`);
    } catch (err: any) {
      await log(`Error en ${dateStr}: ${err.message}`);
      await captureDiagnosticInfo(page, `error-${year}${month}${day}`, this.diagDir);
      const { isProxyFailureError } = await import('@/services/scraping/proxy-assigner');
      if (
        isProxyFailureError(err) ||
        /No se pudo establecer el select|sin resultados confiables|ERR_TIMED_OUT|ERR_CONNECTION|timeout/i.test(
          String(err.message || ''),
        )
      ) {
        throw err;
      }
      return true;
    }
  }

  private async _clickConsultar(page: Page): Promise<boolean> {
    // Clic real en Consultar (no executeRecaptcha: en headless suele fallar con
    // "No reCAPTCHA clients exist" y nunca dispara la búsqueda).
    const selectors = [
      `input[type="submit"][id*="btnConsultar"], input[type="submit"][id*="btnBuscar"]`,
      `button[id*="btnConsultar"], button[id*="btnBuscar"], button[id*="Consultar"]`,
      `a[id*="btnConsultar"], a[id*="btnBuscar"]`,
      `input[type="submit"][value*="Consultar"], input[type="button"][value*="Consultar"]`,
    ];

    for (const sel of selectors) {
      const btn = page.locator(sel).first();
      if (await btn.isVisible().catch(() => false)) {
        await btn.scrollIntoViewIfNeeded();
        await page.waitForTimeout(300);
        console.log(`[PW] Clic en Consultar (${sel})`);
        await btn.click({ force: true });
        await page.waitForTimeout(2000);
        return true;
      }
    }

    const textBtn = page.getByText('Consultar', { exact: true }).first();
    if (await textBtn.isVisible().catch(() => false)) {
      console.log('[PW] Clic en Consultar (texto exacto)');
      await textBtn.click({ force: true });
      await page.waitForTimeout(2000);
      return true;
    }

    const primeSuccess = await page.evaluate(() => {
      const prime = (window as any).PrimeFaces;
      if (prime?.ab) {
        try { prime.ab({ source: 'frmPrincipal:btnBuscar' }); return true; } catch {}
        try { prime.ab({ source: 'frmPrincipal:btnConsultar' }); return true; } catch {}
      }
      return false;
    });
    if (primeSuccess) {
      console.log('[PW] Consultar vía PrimeFaces.ab');
      await page.waitForTimeout(2000);
      return true;
    }

    const formSuccess = await page.evaluate(() => {
      const form = document.getElementById('frmPrincipal') as HTMLFormElement;
      if (!form) return false;
      let hidden = form.querySelector('input[name="frmPrincipal:btnBuscar"]') as HTMLInputElement;
      if (!hidden) {
        hidden = document.createElement('input');
        hidden.type = 'hidden';
        hidden.name = 'frmPrincipal:btnBuscar';
        hidden.value = 'Consultar';
        form.appendChild(hidden);
      }
      form.submit();
      return true;
    });
    if (formSuccess) {
      console.log('[PW] Consultar vía form.submit()');
      await page.waitForTimeout(2000);
      return true;
    }

    await captureDiagnosticInfo(page, 'no-consultar-button', this.diagDir);
    throw new Error('No se pudo encontrar ni hacer clic en el boton Consultar');
  }

  private async _waitForSearchResult(page: Page, timeoutMs: number): Promise<'table' | 'no_results' | 'captcha_error' | 'timeout'> {
    await page.waitForTimeout(3000);

    const start = Date.now();
    while (Date.now() - start < timeoutMs) {
      try {
        // Intentar resolver desafío visual de recaptcha usando la extensión Buster si aparece
        await this._tryBuster(page);

        const result = await page.evaluate(() => {
          const text = document.body?.innerText || '';

          const hasTableRows = document.querySelector(
            '#frmPrincipal\\:tablaCompRecibidos tr, [id*="tablaCompRecibidos"] tr, #frmPrincipal\\:tablaCompEmitidos tr, [id*="tablaCompEmitidos"] tr'
          ) !== null;
          if (hasTableRows && (text.match(/\d{49}/))) return 'table';

          const hasLoadingIndicator = (
            document.querySelector('.rf-msg-wait, .ui-loading, .ajax-loader, [class*="loading"]') !== null ||
            text.includes('Procesando') || text.includes('Cargando')
          );
          if (hasLoadingIndicator) return null;

          const noResults = (
            text.includes('No se encontraron') ||
            text.includes('No existen') ||
            text.includes('No se encontraron registros') ||
            text.includes('No se encontraron comprobantes')
          ) && !text.match(/\d{49}/);
          if (noResults) return 'no_results';

          const cleanText = text.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
          if (cleanText.includes('captcha incorrecta') || cleanText.includes('captcha incorrecto')) return 'captcha_error';

          const captchaMsgs = document.querySelectorAll(
            '.ui-messages-error, .ui-message-error, .ui-messages-warn, .ui-message-warn, .ui-messages-info, .rf-msg-err, [class*="error"], [class*="alert"], [class*="warn"]'
          );
          for (const el of captchaMsgs) {
            const msgText = (el as HTMLElement).innerText.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
            if (msgText.includes('captcha') || msgText.includes('incorrecta') || msgText.includes('incorrecto')) return 'captcha_error';
          }

          const hasTableOnly = document.querySelector(
            '#frmPrincipal\\:tablaCompRecibidos, [id*="tablaCompRecibidos"], #frmPrincipal\\:tablaCompEmitidos, [id*="tablaCompEmitidos"], table.rf-dt-bdy'
          ) !== null;
          if (hasTableOnly) return 'table';

          return null;
        });

        if (result) return result as any;
      } catch {}
      await page.waitForTimeout(500);
    }
    return 'timeout';
  }

  private async _downloadTxtListado(page: Page, dateKey: string, log: (msg: string) => Promise<void>): Promise<boolean> {
    try {
      const txtLink = page.locator('a[id*="lnkTxtlistado"], *[id*="lnkTxtlistado"]').first();
      if (!(await txtLink.isVisible().catch(() => false))) return false;

      const downloadPromise = (page.waitForEvent('download', { timeout: 15000 }) as Promise<Download | null>).catch(() => null);
      await txtLink.click();
      const download = await downloadPromise;
      if (!download) return false;

      const targetPath = path.join(this.downloadsDir, `listado-${dateKey}.txt`);
      await download.saveAs(targetPath);
      return true;
    } catch {
      return false;
    }
  }

  private async _detectColumnHeaders(page: Page): Promise<{
    tipo: number; rucEmisor: number; emisor: number; clave: number;
    serie: number; secuencial: number; fechaAutorizacion: number;
    fechaEmision: number; subtotal: number; iva: number; total: number;
    relacionados: number;
  }> {
    const fallback = {
      tipo: 1, rucEmisor: 2, emisor: 3, clave: 4, serie: -1, secuencial: -1,
      fechaAutorizacion: 5, fechaEmision: -1, subtotal: -1, iva: -1, total: -1,
      relacionados: -1,
    };

    try {
      const detected = await page.evaluate(() => {
        const selectors = [
          '#frmPrincipal\\:tablaCompRecibidos thead th',
          '#frmPrincipal\\:tablaCompRecibidos tr.rf-dt-shdr th',
          '#frmPrincipal\\:tablaCompRecibidos .rf-dt-shdr th',
          '#frmPrincipal\\:tablaCompEmitidos thead th',
          '#frmPrincipal\\:tablaCompEmitidos tr.rf-dt-shdr th',
          '#frmPrincipal\\:tablaCompEmitidos .rf-dt-shdr th',
          '[id*="tablaComp"] thead th',
          '[id*="tablaComp"] tr.rf-dt-shdr th',
        ];
        for (const sel of selectors) {
          const ths = Array.from(document.querySelectorAll(sel));
          if (ths.length < 3) continue;
          const texts = ths.map(th => (th as HTMLElement).innerText.trim().toUpperCase());
          const hasRuc = texts.some(t => t.includes('RUC'));
          const hasClave = texts.some(t => t.includes('CLAVE') || t.includes('ACCESO'));
          if (!hasRuc && !hasClave) continue;

          return {
            tipo: texts.findIndex(t => t.includes('TIPO') || t.includes('COMPROBANTE')),
            rucEmisor: texts.findIndex(t => t.includes('RUC')),
            emisor: texts.findIndex(t => t.includes('RAZON') || t.includes('RAZÓN') || t.includes('SOCIAL') || t.includes('NOMBRE')),
            serie: texts.findIndex(t => t.includes('SERIE')),
            secuencial: texts.findIndex(t => t.includes('SECUENCIAL') || t.includes('NÚMERO') || t.includes('NUMERO')),
            clave: texts.findIndex(t => t.includes('CLAVE') || t.includes('ACCESO') || t.includes('AUTORIZA')),
            fechaAutorizacion: texts.findIndex(t => t.includes('FECHA') && (t.includes('AUTORIZA') || t.includes('HORA'))),
            fechaEmision: texts.findIndex(t => t.includes('FECHA') && (t.includes('EMISIO') || t.includes('EMISIÓN'))),
            subtotal: texts.findIndex(t => t.includes('SIN') || t.includes('SUBTOTAL') || t.includes('NETO') || t.includes('BASE')),
            iva: texts.findIndex(t => t === 'IVA' || t.includes('I.V.A.')),
            total: texts.findIndex(t => t.includes('TOTAL') || t.includes('IMPORTE') || t.includes('VALOR')),
            relacionados: texts.findIndex(t => t.includes('MODIFICADO') || t.includes('SUSTENTO') || t.includes('RELACIONADO')),
          };
        }
        return null;
      });
      if (detected && (detected.clave !== -1 || detected.rucEmisor !== -1)) return detected;
    } catch {}
    return fallback;
  }

  private async _processTableResults(
    page: Page, xmlDir: string, pdfDir: string, counters: ScrapeCounters,
    log: (msg: string) => Promise<void>,
  ): Promise<void> {
    const colIdx = await this._detectColumnHeaders(page);
    const tipoMap: Record<string, string> = { 'FACTURA': '01', 'LIQUIDACIÓN': '03', 'LIQUIDACION': '03', 'NOTA DE CRÉDITO': '04', 'NOTA DE CREDITO': '04', 'NOTA DE DÉBITO': '05', 'NOTA DE DEBITO': '05', 'COMPROBANTE DE RETENCIÓN': '07', 'COMPROBANTE DE RETENCION': '07' };

    let hasNextPage = true;
    let pageNum = 1;

    while (hasNextPage) {
      await log(`Procesando pagina ${pageNum} de resultados...`);

      const rowsData = await page.evaluate(() => {
        const allRows = Array.from(document.querySelectorAll('#frmPrincipal\\:tablaCompRecibidos tr, [id*="tablaCompRecibidos"] tr, #frmPrincipal\\:tablaCompEmitidos tr, [id*="tablaCompEmitidos"] tr'));
        return allRows
          .filter(tr => (tr as HTMLElement).innerText.match(/\d{49}/))
          .map((tr, idx) => {
            const cells = (tr as HTMLElement).querySelectorAll('td');
            const cellTexts = Array.from(cells).map(c => (c as HTMLElement).innerText.trim());
            return { index: idx, textos: cellTexts };
          });
      });

      await log(`Página ${pageNum}: ${rowsData.length} filas con clave de acceso`);

      for (const row of rowsData) {
        const textos = row.textos;
        const rawClave = (colIdx.clave !== -1 && colIdx.clave < textos.length) ? textos[colIdx.clave] : '';
        const claveAcceso = rawClave.match(/\d{49}/)?.[0];
        if (!claveAcceso) continue;

        if (this.targetClaves && !this.targetClaves.has(claveAcceso)) {
          continue;
        }

        this.seenTargetClaves.add(claveAcceso);

        const rucEmisor = (colIdx.rucEmisor !== -1 && colIdx.rucEmisor < textos.length) ? textos[colIdx.rucEmisor] : null;
        const emisor = (colIdx.emisor !== -1 && colIdx.emisor < textos.length) ? textos[colIdx.emisor] : null;
        const rawTipo = (colIdx.tipo !== -1 && colIdx.tipo < textos.length) ? textos[colIdx.tipo].toUpperCase() : '';
        const tipoCode = Object.entries(tipoMap).find(([k]) => rawTipo.includes(k))?.[1] || '01';
        const rawTotal = (colIdx.total !== -1 && colIdx.total < textos.length) ? textos[colIdx.total] : '';
        const rawSubtotal = (colIdx.subtotal !== -1 && colIdx.subtotal < textos.length) ? textos[colIdx.subtotal] : '';
        const rawIva = (colIdx.iva !== -1 && colIdx.iva < textos.length) ? textos[colIdx.iva] : '';
        const rawFechaEmision = (colIdx.fechaEmision !== -1 && colIdx.fechaEmision < textos.length) ? textos[colIdx.fechaEmision] : null;
        const rawFechaAutorizacion = (colIdx.fechaAutorizacion !== -1 && colIdx.fechaAutorizacion < textos.length) ? textos[colIdx.fechaAutorizacion] : null;

        const total = parseSriFloat(rawTotal);
        const subtotal = parseSriFloat(rawSubtotal);
        const iva = parseSriFloat(rawIva);
        const fechaEmisionVal = rawFechaEmision ? this._parseSriDate(rawFechaEmision) : null;
        const fechaAutVal = rawFechaAutorizacion ? this._parseSriDate(rawFechaAutorizacion) : null;
        const rucEmisorVal = extractRuc(rucEmisor) || extractRuc(claveAcceso) || rucEmisor?.replace(/\s+/g, ' ').trim() || null;
        const emisorVal = cleanEmisorRazonSocial(emisor) || emisor?.replace(/\s+/g, ' ').trim() || null;

        counters.found++;
        await log(`Fila: ${tipoCode} ${claveAcceso} | ${emisorVal || ''} | $${total}`);

        const exists = await db.queryOne('SELECT id FROM comprobantes WHERE clave_acceso = $1', [claveAcceso])
          .catch(() => null);
        if (!exists) {
          try {
            await db.query(
              `INSERT INTO comprobantes (id, clave_acceso, tipo, estado, receptor_identificacion, tenant_id,
                emisor_ruc, emisor_razon_social, importe_total, total_sin_impuesto, total_iva,
                fecha_emision, fecha_autorizacion, serie, secuencial, created_at, updated_at)
               VALUES (gen_random_uuid(), $1, $2, 'PENDIENTE', $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, NOW(), NOW())`,
              [claveAcceso, tipoCode, this.ruc, this.tenantId, rucEmisorVal, emisorVal,
               total || null, subtotal || null, iva || null, fechaEmisionVal, fechaAutVal, extractSerie(claveAcceso), extractSecuencial(claveAcceso)],
            );
            await log(`DB: insertado comprobante ${claveAcceso}`);
          } catch (e: any) {
            await log(`ERROR DB insert: ${claveAcceso} — ${e.message}`);
          }
        } else {
          try {
            const totalVal = (total !== null && total !== undefined && total > 0) ? total : null;
            const subtotalVal = (subtotal !== null && subtotal !== undefined && subtotal > 0) ? subtotal : null;
            const ivaVal = (iva !== null && iva !== undefined && iva > 0) ? iva : null;

            await db.query(
              `UPDATE comprobantes SET
                tipo = COALESCE(NULLIF($1, ''), tipo),
                emisor_ruc = COALESCE($2, emisor_ruc),
                emisor_razon_social = COALESCE($3, emisor_razon_social),
                importe_total = COALESCE($4, importe_total),
                total_sin_impuesto = COALESCE($5, total_sin_impuesto),
                total_iva = COALESCE($6, total_iva),
                fecha_emision = COALESCE($7, fecha_emision),
                fecha_autorizacion = COALESCE($8, fecha_autorizacion),
                serie = COALESCE(serie, $9),
                secuencial = COALESCE(secuencial, $10),
                updated_at = NOW()
               WHERE clave_acceso = $11`,
              [tipoCode, rucEmisorVal, emisorVal, totalVal, subtotalVal,
               ivaVal, fechaEmisionVal, fechaAutVal, extractSerie(claveAcceso), extractSecuencial(claveAcceso), claveAcceso],
            );
          } catch (e: any) {
            await log(`ERROR DB update: ${claveAcceso} — ${e.message}`);
          }
        }

        const alreadyStored = await this._xmlAlreadyInSystem(claveAcceso);
        if (alreadyStored) {
          counters.xmls_synced++;
          await log(`XML ya en sistema/BD: ${claveAcceso}`);
          continue;
        }

        const xmlPath = path.join(xmlDir, `${claveAcceso}.xml`);

        // Descarga de comprobantes electrónicos = portal SRI (Playwright).
        // SOAP AutorizacionComprobantesOffline NO lista ni descarga recibidos/emitidos del periodo:
        // solo consulta una clave ya conocida (flujo de emisión propia). Por eso existe el scraper.
        await this._downloadRowFiles(page, row.index, claveAcceso, xmlDir, pdfDir, counters, log);

        const synced = await this._syncDownloadedXmlToSystem(xmlPath, claveAcceso, log);
        if (synced) {
          counters.xmls_synced++;
        } else {
          counters.xmls_failed++;
          await log(
            `Comprobante ${claveAcceso} incompleto: XML no quedó almacenado en sistema/BD.`,
          );
        }

        // Pausa entre filas: el portal reutiliza Factura.xml y se satura si se clica muy rápido.
        const gapMs = Math.max(1500, Number(process.env.SRI_XML_GAP_MS || 3000) || 3000);
        await page.waitForTimeout(gapMs);
      }

      const nextBtn = page.locator('.rf-ds-btn-next:not(.rf-ds-dis), [id*="ds_next"]:not(.rf-ds-dis)').first();
      if (await nextBtn.isVisible().catch(() => false)) {
        const firstKeyBefore = await this._firstTableKey(page);
        await nextBtn.click();
        await page.waitForTimeout(2000);
        let changed = false;
        for (let w = 0; w < 15; w++) {
          await page.waitForTimeout(500);
          const firstKeyAfter = await this._firstTableKey(page);
          if (firstKeyAfter && firstKeyAfter !== firstKeyBefore) { changed = true; break; }
        }
        hasNextPage = changed;
        pageNum++;
        if (changed) await log(`Avanzando a página ${pageNum}...`);
      } else {
        hasNextPage = false;
      }
    }
    await log(`Paginación finalizada (${pageNum} página(s)). Acumulado: found=${counters.found} xml=${counters.xmls} pdf=${counters.pdfs}`);
  }

  private _parseSriDate(dateStr: string | null): string | null {
    if (!dateStr) return null;
    const parts = dateStr.match(/(\d{2})\/(\d{2})\/(\d{4})/);
    if (parts) return `${parts[3]}-${parts[2]}-${parts[1]}`;
    return null;
  }

  private async _firstTableKey(page: Page): Promise<string | null> {
    return page.evaluate(() => {
      const rows = Array.from(document.querySelectorAll('#frmPrincipal\\:tablaCompRecibidos tr, [id*="tablaCompRecibidos"] tr, #frmPrincipal\\:tablaCompEmitidos tr, [id*="tablaCompEmitidos"] tr'));
      for (const tr of rows) {
        const m = (tr as HTMLElement).innerText.match(/\d{49}/);
        if (m) return m[0];
      }
      return null;
    });
  }

  /** Fecha de calendario estable para rutas XML (evita desfase UTC→mes incorrecto). */
  private _calendarDateFromClaveOrDb(claveAcceso: string, fechaEmision: unknown): Date {
    const fromClave = extractFechaEmision(claveAcceso);
    let iso: string | null = fromClave;
    if (!iso && typeof fechaEmision === 'string' && /^\d{4}-\d{2}-\d{2}/.test(fechaEmision)) {
      iso = fechaEmision.slice(0, 10);
    } else if (!iso && fechaEmision instanceof Date && !isNaN(fechaEmision.getTime())) {
      iso = `${fechaEmision.getUTCFullYear()}-${String(fechaEmision.getUTCMonth() + 1).padStart(2, '0')}-${String(fechaEmision.getUTCDate()).padStart(2, '0')}`;
    }
    if (iso) {
      const [y, m, d] = iso.split('-').map(Number);
      return new Date(Date.UTC(y, m - 1, d, 12, 0, 0));
    }
    return new Date();
  }

  /** XML usable en comprobante_xmls / disco del sistema (no solo tmp de descarga). */
  private async _xmlAlreadyInSystem(claveAcceso: string): Promise<boolean> {
    try {
      const xml = await resolveComprobanteXml(claveAcceso, { fetchFromSri: false });
      return Boolean(xml && xml.trim().length > 50);
    } catch {
      return false;
    }
  }

  /**
   * Tras descargar el XML del portal: parsea, marca AUTORIZADO y guarda en xmlStorage
   * + comprobante_xmls. Así el comprobante queda usable sin "Sincronizar" / SOAP.
   */
  private async _syncDownloadedXmlToSystem(
    xmlPath: string,
    claveAcceso: string,
    log: (msg: string) => Promise<void>,
  ): Promise<boolean> {
    if (!fs.existsSync(xmlPath)) {
      await log(`Sin XML local para sincronizar: ${claveAcceso}`);
      return false;
    }

    try {
      await updateComprobanteFromXml(db, xmlPath, claveAcceso, this.tenantId);
    } catch (e: any) {
      await log(`ERROR updateComprobanteFromXml: ${claveAcceso} — ${e.message}`);
    }

    try {
      let compRecord = await db.queryOne<{ id: string; fecha_emision: unknown; emisor_ruc: string | null }>(
        'SELECT id, fecha_emision, emisor_ruc FROM comprobantes WHERE clave_acceso = $1',
        [claveAcceso],
      );

      if (!compRecord?.id) {
        const tipoFromClave = claveAcceso.length >= 10 ? claveAcceso.substring(8, 10) : '01';
        const rucFromClave = extractRuc(claveAcceso);
        const fechaIso = extractFechaEmision(claveAcceso);
        const fechaVal = fechaIso ? this._calendarDateFromClaveOrDb(claveAcceso, null) : null;
        await db.query(
          `INSERT INTO comprobantes (id, clave_acceso, tipo, estado, receptor_identificacion, tenant_id,
            emisor_ruc, fecha_emision, serie, secuencial, created_at, updated_at)
           VALUES (gen_random_uuid(), $1, $2, 'PENDIENTE', $3, $4, $5, $6, $7, $8, NOW(), NOW())
           ON CONFLICT (clave_acceso) DO NOTHING`,
          [
            claveAcceso,
            tipoFromClave,
            this.ruc,
            this.tenantId,
            rucFromClave,
            fechaVal,
            extractSerie(claveAcceso),
            extractSecuencial(claveAcceso),
          ],
        );
        await updateComprobanteFromXml(db, xmlPath, claveAcceso, this.tenantId);
        compRecord = await db.queryOne(
          'SELECT id, fecha_emision, emisor_ruc FROM comprobantes WHERE clave_acceso = $1',
          [claveAcceso],
        );
      }

      if (!compRecord?.id) {
        await log(`ERROR sync: comprobante no existe en DB ${claveAcceso}`);
        return false;
      }

      const xmlContent = fs.readFileSync(xmlPath, 'utf-8');
      const rucStorage =
        extractRuc(compRecord.emisor_ruc) ||
        extractRuc(claveAcceso) ||
        this.ruc;
      const fecha = this._calendarDateFromClaveOrDb(claveAcceso, compRecord.fecha_emision);

      await saveAutorizadoXml(compRecord.id, rucStorage, claveAcceso, fecha, xmlContent);

      await db.query(
        `UPDATE comprobantes SET
           estado = 'AUTORIZADO',
           estado_sri = COALESCE(estado_sri, 'AUTORIZADO'),
           updated_at = NOW()
         WHERE clave_acceso = $1`,
        [claveAcceso],
      );

      await log(`Sincronizado en sistema: ${claveAcceso} (AUTORIZADO + XML)`);
      return true;
    } catch (e: any) {
      await log(`ERROR persistiendo XML en sistema: ${claveAcceso} — ${e.message}`);
      return false;
    }
  }

  private async _downloadRowFiles(
    page: Page, rowIndex: number, claveAcceso: string,
    xmlDir: string, pdfDir: string, counters: ScrapeCounters,
    log: (msg: string) => Promise<void>,
  ): Promise<void> {
    const xmlPath = path.join(xmlDir, `${claveAcceso}.xml`);
    const pdfPath = path.join(pdfDir, `${claveAcceso}.pdf`);

    const colInfo = await page.evaluate(
      ({ idx, clave }: { idx: number; clave: string }) => {
        const rows = Array.from(
          document.querySelectorAll(
            '#frmPrincipal\\:tablaCompRecibidos tr, [id*="tablaCompRecibidos"] tr, #frmPrincipal\\:tablaCompEmitidos tr, [id*="tablaCompEmitidos"] tr',
          ),
        ).filter((tr) => (tr as HTMLElement).innerText.match(/\d{49}/));
        const row =
          rows.find((tr) => (tr as HTMLElement).innerText.includes(clave)) ||
          (idx < rows.length ? rows[idx] : null);
        if (!row) return null;
        const cells = row.querySelectorAll('td');
        return Array.from(cells).map((cell, colIdx) => {
          const anchors = Array.from(cell.querySelectorAll('a'));
          const inputs = Array.from(cell.querySelectorAll('input[type="image"]'));
          const buttons = Array.from(cell.querySelectorAll('button'));
          const allEls = [...anchors, ...inputs, ...buttons];
          return {
            col: colIdx,
            html: cell.innerHTML.substring(0, 500),
            elements: allEls.map((el) => ({
              tag: el.tagName.toLowerCase(),
              src: (el as HTMLElement).getAttribute('src') || '',
              id: (el as HTMLElement).getAttribute('id') || '',
              title: (el as HTMLElement).getAttribute('title') || '',
              onclick: (el as HTMLElement).getAttribute('onclick') || '',
              text: (el as HTMLElement).textContent?.trim() || '',
              href: (el as HTMLAnchorElement).href || '',
            })),
          };
        });
      },
      { idx: rowIndex, clave: claveAcceso },
    );

    if (!colInfo) return;

    let xmlCol: number | null = null;
    let pdfCol: number | null = null;
    let relCol: number | null = null;

    for (const cell of colInfo) {
      for (const el of cell.elements) {
        const info = (el.src + el.id + el.title + el.onclick + el.text + el.href).toLowerCase();
        // Preferir "xml" explícito; "comprobante" solo como fallback (evita columna incorrecta).
        if (info.includes('xml')) xmlCol = cell.col;
        else if (xmlCol === null && (info.includes('descargar') && info.includes('autorizado'))) xmlCol = cell.col;
        if (info.includes('pdf') || info.includes('ride')) pdfCol = cell.col;
        if (info.includes('relacionado') || info.includes('relacionados')) relCol = cell.col;
      }
    }

    if (xmlCol !== null) {
      await log(`Columna XML detectada: ${xmlCol} (PDF=${pdfCol}, REL=${relCol})`);
      if (fs.existsSync(xmlPath)) {
        counters.xmls_exist++;
      } else {
        await this._downloadFromColumn(page, rowIndex, xmlCol, xmlPath, 'XML', counters, log, claveAcceso);
      }
    } else {
      await log(`Sin columna XML detectable para ${claveAcceso}`);
    }

    // RIDE/relacionados son opcionales: en masa saturan el portal y rompen descargas XML siguientes.
    // Activar solo con SRI_DOWNLOAD_RIDE=true / SRI_DOWNLOAD_RELACIONADOS=true.
    if (
      process.env.SRI_DOWNLOAD_RIDE === 'true' &&
      pdfCol !== null &&
      fs.existsSync(xmlPath)
    ) {
      if (fs.existsSync(pdfPath)) {
        counters.pdfs_exist++;
      } else {
        await this._downloadFromColumn(page, rowIndex, pdfCol, pdfPath, 'RIDE', counters, log, claveAcceso);
      }
    }

    if (
      process.env.SRI_DOWNLOAD_RELACIONADOS === 'true' &&
      relCol !== null &&
      fs.existsSync(xmlPath)
    ) {
      await this._downloadRelacionados(page, rowIndex, relCol, claveAcceso, xmlDir, pdfDir, counters, log);
    }
  }

  private async _downloadFromColumn(
    page: Page, rowIndex: number, col: number | null,
    targetPath: string, label: string,
    counters: ScrapeCounters, log: (msg: string) => Promise<void>,
    claveAcceso: string,
  ): Promise<void> {
    if (col === null || fs.existsSync(targetPath)) return;

    await log(`Descargando ${label} ${claveAcceso}...`);
    const wantXml = label.toUpperCase().includes('XML');
    const idHint = wantXml ? 'lnkxml' : 'lnkpdf';

    const clickFn = async () => {
      // Localizar por clave (estable tras re-render); índice solo como fallback.
      const meta = await page.evaluate(
        ({ c, idx, clave, hint }: { c: number; idx: number; clave: string; hint: string }) => {
          const rows = Array.from(
            document.querySelectorAll(
              '#frmPrincipal\\:tablaCompRecibidos tr, [id*="tablaCompRecibidos"] tr, #frmPrincipal\\:tablaCompEmitidos tr, [id*="tablaCompEmitidos"] tr',
            ),
          ).filter((tr) => (tr as HTMLElement).innerText.match(/\d{49}/));
          const row =
            rows.find((tr) => (tr as HTMLElement).innerText.includes(clave)) ||
            (idx < rows.length ? rows[idx] : null);
          if (!row) return null;

          const all = Array.from(
            row.querySelectorAll('a, input[type="image"], button, img'),
          ) as HTMLElement[];
          const byId = all.find((el) =>
            (el.getAttribute('id') || '').toLowerCase().includes(hint),
          );
          if (byId) {
            return {
              id: byId.getAttribute('id') || '',
              tag: byId.tagName.toLowerCase(),
              src: (byId.getAttribute('src') || '').slice(-80),
              title: byId.getAttribute('title') || '',
            };
          }

          const cells = row.querySelectorAll('td');
          if (c >= cells.length) return null;
          const cell = cells[c] as HTMLElement;
          const candidates = Array.from(
            cell.querySelectorAll('a, input[type="image"], button, img'),
          ) as HTMLElement[];
          const preferred =
            candidates.find((el) => {
              const info = (
                (el.getAttribute('src') || '') +
                (el.getAttribute('id') || '') +
                (el.getAttribute('title') || '') +
                (el.getAttribute('alt') || '') +
                (el.getAttribute('onclick') || '') +
                (el.textContent || '')
              ).toLowerCase();
              return (
                info.includes('xml') ||
                info.includes('pdf') ||
                info.includes('ride') ||
                info.includes('descargar')
              );
            }) || candidates[0];
          if (!preferred) return null;
          return {
            id: preferred.getAttribute('id') || '',
            tag: preferred.tagName.toLowerCase(),
            src: (preferred.getAttribute('src') || '').slice(-80),
            title: preferred.getAttribute('title') || '',
          };
        },
        { c: col, idx: rowIndex, clave: claveAcceso, hint: idHint },
      );

      if (!meta) throw new Error(`No hay botón ${label} para clave ${claveAcceso}`);
      await log(
        `${label} botón: id=${meta.id || '(sin id)'} tag=${meta.tag} title=${meta.title} src=...${meta.src}`,
      );

      if (meta.id) {
        // Click DOM nativo: PrimeFaces suele ignorar el click de Playwright en reintentos.
        const domClicked = await page
          .evaluate((id: string) => {
            const el = document.getElementById(id) as HTMLElement | null;
            if (!el) return false;
            el.scrollIntoView({ block: 'center', inline: 'nearest' });
            el.click();
            return true;
          }, meta.id)
          .catch(() => false);
        if (domClicked) return;

        const loc = page.locator(`[id="${meta.id}"]`).first();
        if ((await loc.count().catch(() => 0)) > 0) {
          await loc.scrollIntoViewIfNeeded().catch(() => {});
          await page.waitForTimeout(250);
          await loc.click({ force: true, timeout: 10000 });
          return;
        }
      }

      const handle = await page.evaluateHandle(
        ({ c, idx, clave, hint }: { c: number; idx: number; clave: string; hint: string }) => {
          const rows = Array.from(
            document.querySelectorAll(
              '#frmPrincipal\\:tablaCompRecibidos tr, [id*="tablaCompRecibidos"] tr, #frmPrincipal\\:tablaCompEmitidos tr, [id*="tablaCompEmitidos"] tr',
            ),
          ).filter((tr) => (tr as HTMLElement).innerText.match(/\d{49}/));
          const row =
            rows.find((tr) => (tr as HTMLElement).innerText.includes(clave)) ||
            (idx < rows.length ? rows[idx] : null);
          if (!row) return null;
          const all = Array.from(
            row.querySelectorAll('a, input[type="image"], button, img'),
          ) as HTMLElement[];
          const byId = all.find((el) =>
            (el.getAttribute('id') || '').toLowerCase().includes(hint),
          );
          if (byId) return byId;
          const cells = row.querySelectorAll('td');
          const cell = cells?.[c] as HTMLElement | undefined;
          if (!cell) return null;
          const candidates = Array.from(
            cell.querySelectorAll('a, input[type="image"], button, img'),
          ) as HTMLElement[];
          return (
            candidates.find((el) => {
              const info = (
                (el.getAttribute('src') || '') +
                (el.getAttribute('id') || '') +
                (el.getAttribute('title') || '')
              ).toLowerCase();
              return info.includes('xml') || info.includes('pdf') || info.includes('ride');
            }) ||
            candidates[0] ||
            null
          );
        },
        { c: col, idx: rowIndex, clave: claveAcceso, hint: idHint },
      );
      const el = handle.asElement();
      if (!el) {
        await handle.dispose().catch(() => {});
        throw new Error(`Fallback click falló ${label} ${claveAcceso}`);
      }
      try {
        await el.scrollIntoViewIfNeeded();
        await el.click({ force: true, timeout: 10000 });
      } finally {
        await handle.dispose().catch(() => {});
      }
    };

    await this._downloadWithCapture(page, clickFn, targetPath, label, counters, log, claveAcceso);
  }

  private async _downloadWithCapture(
    page: Page, clickFn: () => Promise<void>,
    targetPath: string, label: string,
    counters: ScrapeCounters, log: (msg: string) => Promise<void>,
    claveAcceso: string,
  ): Promise<boolean> {
    const isXml = label.includes('XML');
    const maxAttempts = 2;
    const timeout = isXml ? 28000 : 40000;
    fs.mkdirSync(path.dirname(targetPath), { recursive: true });
    const tempDir = this.downloadsDir || path.join(process.cwd(), 'downloads', 'temp');
    fs.mkdirSync(tempDir, { recursive: true });

    // No CDP setDownloadBehavior aquí: pelea con context.downloadsPath y provoca
    // saveAs ENOENT (el GUID temporal desaparece).

    const clearStaleTemp = () => {
      for (const name of ['Factura.xml', 'factura.xml', 'Factura.pdf', 'factura.pdf']) {
        const p = path.join(tempDir, name);
        try {
          if (fs.existsSync(p)) fs.unlinkSync(p);
        } catch {
          /* ignore */
        }
      }
    };

    const dismissOverlays = async () => {
      await page.keyboard.press('Escape').catch(() => {});
      await page
        .evaluate(() => {
          document
            .querySelectorAll(
              '.ui-dialog-titlebar-close, .ui-widget-overlay, a.ui-dialog-titlebar-close',
            )
            .forEach((el) => {
              try {
                (el as HTMLElement).click();
              } catch {
                /* ignore */
              }
            });
        })
        .catch(() => {});
    };

    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      try {
        await dismissOverlays();
        clearStaleTemp();
        const beforeFiles = new Set(
          fs.existsSync(tempDir) ? fs.readdirSync(tempDir) : [],
        );
        const clickAt = Date.now();

        // No usar Promise.race crudo: si "download" hace reject, mata el poll de archivo.
        type Win =
          | { kind: 'download'; dl: Download }
          | { kind: 'file'; fp: string };

        const winnerPromise = new Promise<Win>((resolve, reject) => {
          let settled = false;
          const finish = (w: Win) => {
            if (settled) return;
            settled = true;
            clearTimeout(timer);
            resolve(w);
          };
          const timer = setTimeout(() => {
            if (!settled) {
              settled = true;
              reject(new Error(`${label}-capture-timeout`));
            }
          }, timeout);

          page
            .waitForEvent('download', { timeout: timeout + 2000 })
            .then((dl) => finish({ kind: 'download', dl }))
            .catch(() => {});

          void (async () => {
            const deadline = Date.now() + timeout;
            while (Date.now() < deadline && !settled) {
              await page.waitForTimeout(300);
              if (!fs.existsSync(tempDir)) continue;
              const files = fs
                .readdirSync(tempDir)
                .filter((f) => !f.endsWith('.crdownload') && !f.endsWith('.tmp'))
                .filter((f) => {
                  if (!beforeFiles.has(f)) return true;
                  try {
                    return fs.statSync(path.join(tempDir, f)).mtimeMs >= clickAt - 200;
                  } catch {
                    return false;
                  }
                });
              const match =
                files.find((f) =>
                  isXml
                    ? f.toLowerCase().endsWith('.xml') || f.toLowerCase().includes('factura')
                    : f.toLowerCase().endsWith('.pdf'),
                ) || files[0];
              if (!match) continue;
              const full = path.join(tempDir, match);
              try {
                if (fs.statSync(full).size >= 50) finish({ kind: 'file', fp: full });
              } catch {
                /* keep polling */
              }
            }
          })();
        });

        await clickFn();
        // Dar tiempo al POST JSF tras el clic
        await page.waitForTimeout(800);

        const winner = await winnerPromise;

        let saved = false;
        if (winner.kind === 'download') {
          saved = await this._persistPlaywrightDownload(winner.dl, targetPath, tempDir, log, label);
        } else {
          saved = this._copyDownloadFile(winner.fp, targetPath);
        }

        if (saved) {
          if (isXml) counters.xmls++;
          else counters.pdfs++;
          await log(`${label} descargado: ${claveAcceso}`);
          clearStaleTemp();
          await dismissOverlays();
          return true;
        }
        await log(`${label}: no se pudo persistir archivo (intento ${attempt + 1})`);
      } catch (err: any) {
        console.log(
          `[PW] ${label} ${claveAcceso} intento ${attempt + 1} fallo (${err?.message || 'timeout'})`,
        );
      }
      await dismissOverlays();
      await page.waitForTimeout(2500 + attempt * 1500);
    }
    return false;
  }

  /** Persiste Download aunque saveAs falle (ENOENT típico con downloadsPath). */
  private async _persistPlaywrightDownload(
    dl: Download,
    targetPath: string,
    tempDir: string,
    log: (msg: string) => Promise<void>,
    label: string,
  ): Promise<boolean> {
    fs.mkdirSync(path.dirname(targetPath), { recursive: true });

    try {
      await dl.saveAs(targetPath);
      if (fs.existsSync(targetPath) && fs.statSync(targetPath).size >= 50) return true;
    } catch (e: any) {
      await log(`${label}: saveAs falló (${e.message}); usando path/disco…`);
    }

    const fromPath = await dl.path().catch(() => null);
    if (fromPath && this._copyDownloadFile(fromPath, targetPath)) return true;

    const suggested = dl.suggestedFilename();
    const candidates = [
      suggested ? path.join(tempDir, suggested) : '',
      path.join(tempDir, 'Factura.xml'),
      path.join(tempDir, 'factura.xml'),
    ].filter(Boolean);

    try {
      const recent = fs
        .readdirSync(tempDir)
        .map((f) => {
          const p = path.join(tempDir, f);
          return { p, t: fs.statSync(p).mtimeMs };
        })
        .filter((x) => x.t > Date.now() - 60_000)
        .sort((a, b) => b.t - a.t);
      for (const r of recent) candidates.push(r.p);
    } catch {
      /* ignore */
    }

    for (const c of candidates) {
      if (this._copyDownloadFile(c, targetPath)) return true;
    }
    return false;
  }

  private _copyDownloadFile(src: string, targetPath: string): boolean {
    try {
      if (!src || !fs.existsSync(src)) return false;
      const st = fs.statSync(src);
      if (!st.isFile() || st.size < 50) return false;
      fs.mkdirSync(path.dirname(targetPath), { recursive: true });
      fs.copyFileSync(src, targetPath);
      return fs.existsSync(targetPath) && fs.statSync(targetPath).size >= 50;
    } catch {
      return false;
    }
  }

  private async _downloadRelacionados(
    page: Page, rowIndex: number, relCol: number,
    claveAcceso: string, xmlDir: string, pdfDir: string,
    counters: ScrapeCounters, log: (msg: string) => Promise<void>,
  ): Promise<void> {
    await log(`Revisando documentos relacionados para ${claveAcceso}...`);

    try {
      await page.evaluate(({ c, idx }: any) => {
        const rows = Array.from(document.querySelectorAll('#frmPrincipal\\:tablaCompRecibidos tr, [id*="tablaCompRecibidos"] tr, #frmPrincipal\\:tablaCompEmitidos tr, [id*="tablaCompEmitidos"] tr'))
          .filter(tr => (tr as HTMLElement).innerText.match(/\d{49}/));
        if (idx >= rows.length) return;
        const cells = rows[idx].querySelectorAll('td');
        if (c >= cells.length) return;
        const link = cells[c].querySelector('a');
        if (link) (link as HTMLElement).click();
      }, { c: relCol, idx: rowIndex });

      // Esperar a que el modal esté cargado y contenga la clave del documento relacionado
      let hasKey = false;
      for (let i = 0; i < 15; i++) {
        await page.waitForTimeout(500);
        hasKey = await page.evaluate(() => {
          const modal = document.querySelector(
            '.rf-pp-cnt, .ui-dialog-content, [role="dialog"], div[id*="popup"]:not([style*="none"]), div[id*="dlg"]:not([style*="none"])'
          );
          if (!modal) return false;
          return /\d{49}/.test((modal as HTMLElement).innerText);
        });
        if (hasKey) break;
      }

      const modalVisible = await page.evaluate(() => {
        const modal = document.querySelector(
          '.rf-pp-cnt, .ui-dialog-content, [role="dialog"], div[id*="popup"]:not([style*="none"]), div[id*="dlg"]:not([style*="none"])'
        );
        return modal !== null;
      });

      if (!modalVisible) {
        await log(`Sin documentos relacionados para ${claveAcceso}`);
        return;
      }

      await log(`Modal de relacionados abierto para ${claveAcceso}`);

      const modalInfo = await page.evaluate(() => {
        const modal = document.querySelector(
          '.rf-pp-cnt, .ui-dialog-content, [role="dialog"], div[id*="popup"], div[id*="dlg"]'
        );
        if (!modal) return null;
        const text = (modal as HTMLElement).innerText;
        const match = text.match(/\d{49}/);
        const btns = (modal as HTMLElement).querySelectorAll('a, input[type="image"], button');
        return {
          clave: match ? match[0] : null,
          buttons: Array.from(btns).map((b, i) => ({
            index: i,
            src: (b as HTMLElement).getAttribute('src') || '',
            id: (b as HTMLElement).getAttribute('id') || '',
            title: (b as HTMLElement).getAttribute('title') || '',
            text: (b as HTMLElement).textContent?.trim() || '',
            href: (b as HTMLAnchorElement).href || '',
            onclick: (b as HTMLElement).getAttribute('onclick') || '',
          })),
        };
      });

      if (!modalInfo) return;

      const relClave = modalInfo.clave || claveAcceso;

      const relXmlBtn = modalInfo.buttons.find((b: any) =>
        (b.src + b.id + b.title + b.text + b.href + b.onclick).toLowerCase().includes('xml')
      );
      const relPdfBtn = modalInfo.buttons.find((b: any) =>
        (b.src + b.id + b.title + b.text + b.href + b.onclick).toLowerCase().includes('pdf') ||
        b.text.toLowerCase().includes('ride')
      );

      if (relXmlBtn) {
        const relXmlPath = path.join(xmlDir, `${relClave}.xml`);
        if (!fs.existsSync(relXmlPath)) {
          await log(`Descargando XML relacionado ${relClave}...`);
          await this._downloadWithCapture(
            page,
            () => page.evaluate((idx: number) => {
              const modal = document.querySelector(
                '.rf-pp-cnt, .ui-dialog-content, [role="dialog"], div[id*="popup"], div[id*="dlg"]'
              );
              if (!modal) return;
              const btns = (modal as HTMLElement).querySelectorAll('a, input[type="image"], button');
              if (idx < btns.length) (btns[idx] as HTMLElement).click();
            }, relXmlBtn.index),
            relXmlPath, 'XML (relacionado)', counters, log, relClave,
          );
        } else {
          counters.xmls_exist++;
        }
        if (fs.existsSync(relXmlPath)) {
          const relSynced = await this._syncDownloadedXmlToSystem(relXmlPath, relClave, log);
          if (relSynced) {
            // Relacionados no suman a `found`; solo logueamos el resultado.
            await log(`XML relacionado sincronizado: ${relClave}`);
          } else {
            await log(`XML relacionado NO sincronizado: ${relClave}`);
          }
        }
      }

      if (relPdfBtn) {
        const relPdfPath = path.join(pdfDir, `${relClave}.pdf`);
        if (!fs.existsSync(relPdfPath)) {
          await log(`Descargando RIDE relacionado ${relClave}...`);
          await this._downloadWithCapture(
            page,
            () => page.evaluate((idx: number) => {
              const modal = document.querySelector(
                '.rf-pp-cnt, .ui-dialog-content, [role="dialog"], div[id*="popup"], div[id*="dlg"]'
              );
              if (!modal) return;
              const btns = (modal as HTMLElement).querySelectorAll('a, input[type="image"], button');
              if (idx < btns.length) (btns[idx] as HTMLElement).click();
            }, relPdfBtn.index),
            relPdfPath, 'RIDE (relacionado)', counters, log, relClave,
          );
        } else {
          counters.pdfs_exist++;
        }
      }

      await page.evaluate(() => {
        const closeBtn = document.querySelector<HTMLElement>(
          '.rf-pp-btn-close, .ui-dialog-titlebar-close, a[class*="close"], button[class*="close"]'
        );
        if (closeBtn) closeBtn.click();
      });
      await page.waitForTimeout(1500);
    } catch (err: any) {
      console.log(`[PW] Error relacionados ${claveAcceso}: ${err.message}`);
    }
  }

  private async _recoverSession(log: (msg: string) => Promise<void>): Promise<void> {
    await log('Recuperando sesion...');
    this.authenticated = false;
    await this.login(this.ruc, this.clave, log);
  }

  private async _solveCaptcha(page: Page, action?: string): Promise<boolean> {
    const scrapelessKey = process.env.SCRAPELESS_API_KEY;
    const anticaptchaKey = process.env.ANTICAPTCHA_KEY;
    const currentUrl = page.url();

    // Si tenemos Scrapeless, preferimos usar su API solver
    if (scrapelessKey) {
      try {
        console.log(`[Scrapeless Solver] Creando tarea de CAPTCHA para ${currentUrl}...`);
        const fetch = require('node-fetch');
        const createTaskRes = await fetch('https://api.scrapeless.com/api/v1/createTask', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-api-token': scrapelessKey,
          },
          body: JSON.stringify({
            actor: 'captcha.recaptcha',
            input: {
              version: 'v2',
              pageURL: currentUrl,
              siteKey: RECAPTCHA_SITE_KEY,
              pageAction: action || 'submit',
            },
          }),
        });

        const createTaskData = await createTaskRes.json();
        const taskId = createTaskData.taskId;
        if (!taskId) {
          console.log('[Scrapeless Solver] No se pudo crear la tarea:', JSON.stringify(createTaskData));
          return false;
        }

        console.log(`[Scrapeless Solver] Tarea creada con ID ${taskId}. Esperando solución...`);
        let token = '';
        for (let i = 0; i < 30; i++) {
          await new Promise(r => setTimeout(r, 2000));
          const resultRes = await fetch(`https://api.scrapeless.com/api/v1/getTaskResult/${taskId}`, {
            headers: { 'x-api-token': scrapelessKey },
          });
          const resultData = await resultRes.json();
          if (resultData.status === 'ready' && resultData.success && resultData.data?.solution?.gRecaptchaResponse) {
            token = resultData.data.solution.gRecaptchaResponse;
            break;
          }
          if (resultData.status === 'ready' && !resultData.success) {
            console.log('[Scrapeless Solver] La tarea falló:', JSON.stringify(resultData));
            break;
          }
        }

        if (!token) {
          console.log('[Scrapeless Solver] No se obtuvo el token en el tiempo límite.');
          return false;
        }

        console.log('[Scrapeless Solver] Token obtenido, inyectando en la página...');
        await page.evaluate((t: string) => {
          const ta = document.getElementById('g-recaptcha-response') as HTMLTextAreaElement;
          if (ta) ta.value = t;

          if (!(window as any).grecaptcha) (window as any).grecaptcha = {};
          const g = (window as any).grecaptcha;
          if (!g.enterprise) g.enterprise = {};
          g.enterprise.execute = () => Promise.resolve(t);
          g.enterprise.ready = (cb: any) => { if (typeof cb === 'function') cb(); };

          (window as any).executeRecaptcha = (_action: string, _source: string) => {
            const ta2 = document.getElementById('g-recaptcha-response') as HTMLTextAreaElement;
            if (ta2) ta2.value = t;
            return t;
          };
        }, token);

        return true;
      } catch (err: any) {
        console.log(`[Scrapeless Solver] Error: ${err.message}`);
      }
    }

    if (!anticaptchaKey) return false;

    try {
      ac.setAPIKey(anticaptchaKey);
      ac.setSoftId(0);
      console.log(`[PW CAPTCHA] Resolviendo para URL: ${currentUrl}, action: ${action || 'ninguno'}`);

      const payload: any = {};
      if (action) payload.s = action;

      const token = await ac.solveRecaptchaV2EnterpriseProxyless(currentUrl, RECAPTCHA_SITE_KEY, payload);
      if (!token) {
        console.log('[PW CAPTCHA] No se obtuvo token de Anti-Captcha.');
        return false;
      }
      console.log('[PW CAPTCHA] Token obtenido, inyectando en la pagina...');

      await page.evaluate((t: string) => {
        const ta = document.getElementById('g-recaptcha-response') as HTMLTextAreaElement;
        if (ta) ta.value = t;

        if (!(window as any).grecaptcha) (window as any).grecaptcha = {};
        const g = (window as any).grecaptcha;
        if (!g.enterprise) g.enterprise = {};
        g.enterprise.execute = () => Promise.resolve(t);
        g.enterprise.ready = (cb: any) => { if (typeof cb === 'function') cb(); };

        // Sobrescribir executeRecaptcha SIEMPRE (aunque no esté definida en headless)
        (window as any).executeRecaptcha = (_action: string, _source: string) => {
          const ta2 = document.getElementById('g-recaptcha-response') as HTMLTextAreaElement;
          if (ta2) ta2.value = t;
          return t;
        };

      }, token);

      return true;
    } catch (err: any) {
      console.log(`[PW CAPTCHA] Error: ${err.message}`);
      return false;
    }
  }

  private async _tryBuster(page: Page): Promise<boolean> {
    try {
      for (const frame of page.frames()) {
        if (frame.url().includes('api2/bframe') || frame.name().startsWith('c-')) {
          const btn = frame.locator('#solver-button');
          if (await btn.isVisible().catch(() => false)) {
            await btn.click();
            await page.waitForTimeout(5000);
            return true;
          }
        }
      }
    } catch {}
    return false;
  }

  private _typeLabel(code: string): string {
    const labels: Record<string, string> = { '1': 'Factura', '2': 'Liquidacion', '3': 'NC', '4': 'ND', '6': 'Retencion' };
    return labels[code] || code;
  }

  private _monthName(month: number): string {
    const names = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];
    return names[month - 1] || String(month);
  }

  /** Select day; day=0 means "Todos" (whole month) on SRI recibidos form. */
  private async _selectDay(
    page: Page,
    day: number,
    log: (msg: string) => Promise<void>,
  ): Promise<void> {
    const selector = 'select[id*="dia"]';
    if (day === 0) {
      const locator = page.locator(selector).first();
      await locator.waitFor({ state: 'attached', timeout: 5000 });
      const options = await locator.evaluate((sel) =>
        Array.from((sel as HTMLSelectElement).options).map((o) => ({
          value: o.value,
          text: (o.textContent || '').trim(),
        })),
      );
      const allOpt = options.find(
        (o) =>
          /^todos$/i.test(o.text) ||
          o.value === '0' ||
          o.value === '00' ||
          o.value === '',
      );
      if (!allOpt) {
        const preview = options.slice(0, 5).map((o) => `${o.value}=${o.text}`).join(', ');
        throw new Error(`No se encontró opción "Todos" en el select de día (opciones: ${preview}...)`);
      }
      await this._selectFormValue(page, selector, [allOpt.value], log);
      await log(`Día=Todos seleccionado (value="${allOpt.value}")`);
      return;
    }

    await this._selectFormValue(
      page,
      selector,
      [String(day), day.toString().padStart(2, '0')],
      log,
    );
  }

  /** Try candidate values until the select accepts one. */
  private async _selectFormValue(
    page: Page,
    selector: string,
    candidates: string[],
    log: (msg: string) => Promise<void>,
  ): Promise<void> {
    const unique = [...new Set(candidates.filter((c) => c !== undefined && c !== null))];
    let lastError: Error | null = null;
    for (const value of unique) {
      try {
        await this._selectAndVerify(page, selector, value, log);
        return;
      } catch (e: any) {
        lastError = e instanceof Error ? e : new Error(String(e?.message || e));
      }
    }
    throw lastError || new Error(`No se pudo establecer ${selector}`);
  }

  private async _selectAndVerify(
    page: Page,
    selector: string,
    value: string,
    log: (msg: string) => Promise<void>
  ): Promise<void> {
    const locator = page.locator(selector).first();
    for (let i = 0; i < 3; i++) {
      try {
        await locator.waitFor({ state: 'attached', timeout: 5000 });
        await locator.selectOption({ value });
        await page.waitForTimeout(500);
        const actual = await locator.inputValue();
        if (actual === value) {
          return;
        }
        // Some SRI options normalize "3" ↔ "03"
        const normalizedOk =
          actual.replace(/^0+/, '') === value.replace(/^0+/, '') &&
          actual.replace(/^0+/, '') !== '';
        if (normalizedOk) {
          return;
        }
        await log(`[Scraper] Advertencia: "${selector}" no se pudo establecer a "${value}" (valor actual: "${actual}"). Reintentando...`);
      } catch (e: any) {
        await log(`[Scraper] Advertencia en _selectAndVerify para "${selector}": ${e.message}. Reintentando...`);
      }
      await page.waitForTimeout(1000);
    }
    throw new Error(`No se pudo establecer el select "${selector}" a "${value}"`);
  }

  /** Página activa (tras init + login). */
  getPage(): Page | null {
    return this.page;
  }

  setTenantId(tenantId: string | null): void {
    this.tenantId = tenantId;
  }

  /** Cierra el browser y reinicia con otro proxy (hop de rotación EC). */
  async reinitWithProxy(proxyUrl: string | undefined): Promise<void> {
    await this.close().catch(() => {});
    this.proxyUrl = proxyUrl;
    this.authenticated = false;
    this.ruc = '';
    this.clave = '';
    // Perfil distinto por hop evita cookies/sesión pegadas al proxy anterior.
    if (this.userDataDir) {
      this.userDataDir = `${this.userDataDir}_hop_${Date.now()}`;
    }
    await this.init();
  }

  async close(): Promise<void> {
    if (this.context) await this.context.close().catch(() => {});
    if (this.browser) await this.browser.close().catch(() => {});
    this.page = null;
    this.context = null;
    this.browser = null;
    this.authenticated = false;
  }
}

async function captureDiagnosticInfo(page: Page, label: string, diagDir: string): Promise<void> {
  try {
    fs.mkdirSync(diagDir, { recursive: true });
    const ts = Date.now();
    await page.screenshot({ path: path.join(diagDir, `${label}-${ts}.png`), fullPage: true }).catch(() => {});
    const html = await page.evaluate(() => {
      const f = document.getElementById('frmPrincipal');
      return f ? f.outerHTML : document.body?.innerHTML?.substring(0, 10000) || '';
    }).catch(() => '');
    fs.writeFileSync(path.join(diagDir, `${label}-${ts}.html`), html);
  } catch {}
}
