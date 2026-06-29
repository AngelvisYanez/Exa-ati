import playwright, { Browser, Page, BrowserContext, Download } from 'playwright';
import path from 'path';
import fs from 'fs';
import os from 'os';
// @ts-expect-error - no types available for anticaptchaofficial
import ac from '@antiadmin/anticaptchaofficial';
import { updateComprobanteFromXml, extractRuc, cleanEmisorRazonSocial, parseSriFloat, extractSerie, extractSecuencial } from './sri-utils';

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

  constructor(opts?: ScrapeOptions) {
    this.headless = opts?.headless ?? process.env.HEADLESS !== 'false';
    this.diagDir = opts?.diagDir || './downloads/debug';
    this.proxyUrl = opts?.proxyUrl;
  }

  async init(): Promise<void> {
    const apiKey = process.env.SCRAPELESS_API_KEY;
    if (apiKey) {
      console.log('[Scrapeless] Conectando a Scraping Browser de Scrapeless...');
      const { Playwright } = require('@scrapeless-ai/sdk');
      this.browser = await Playwright.connect({
        apiKey: apiKey,
        proxyCountry: 'US', // O el que prefieras
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
      const hasBuster = fs.existsSync(busterPath);

      const launchArgs = [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-web-security',
        '--disable-blink-features=AutomationControlled',
        '--disable-features=IsolateOrigins,site-per-process',
        '--hide-scrollbars',
      ];

      if (hasBuster) {
        launchArgs.push(`--disable-extensions-except=${busterPath}`);
        launchArgs.push(`--load-extension=${busterPath}`);
      }

      const contextOptions: any = {
        headless: this.headless,
        args: launchArgs,
        channel: process.env.PLAYWRIGHT_CHANNEL === 'none' ? undefined : (process.env.PLAYWRIGHT_CHANNEL || 'chrome'),
        viewport: { width: 1366, height: 768 },
        userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/149.0.0.0 Safari/537.36',
        locale: 'es-EC',
        timezoneId: 'America/Guayaquil',
        permissions: ['geolocation'],
        extraHTTPHeaders: { 'Accept-Language': 'es-EC,es;q=0.9' },
      };

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

      const userDataDir = path.resolve('./browser_session/sri_user_profile');
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
        if (attempt < 2) await new Promise(r => setTimeout(r, 2000 * (attempt + 1)));
      }
    }
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

  async navigateToComprobantes(progress?: (msg: string) => Promise<void>): Promise<boolean> {
    const page = this.page!;
    const log = progress || (async (msg: string) => console.log('[PW]', msg));

    try {
      await log('Navegando a Comprobantes Recibidos...');
      await page.goto(`${SRI_BASE}/tuportal-internet/accederAplicacion.jspa?redireccion=57&idGrupo=55`, {
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
      return false;
    }
  }

  async runMassDownload(
    job: any,
    updateProgress: (jobId: string, msg: string, status?: string) => Promise<void>,
  ): Promise<void> {
    const jobId = job.id;
    const log = async (msg: string) => updateProgress(jobId, msg);
    const logWithStatus = async (msg: string, status?: string) => updateProgress(jobId, msg, status);

    if (!this.authenticated) {
      const ok = await this.login(this.ruc, this.clave, log);
      if (!ok) throw new Error('No se pudo iniciar sesion.');
    }

    this.tenantId = job.tenant_id || null;

    const startD = new Date(job.fecha_desde);
    const endD = new Date(job.fecha_hasta);
    const docType = job.tipo_comprobante || '1';
    const typeCodes = docType === 'todos' ? ['1', '2', '3', '4', '6'] : [docType];

    const xmlDir = path.join(process.cwd(), 'downloads', 'XML');
    const pdfDir = path.join(process.cwd(), 'downloads', 'RIDE');
    fs.mkdirSync(xmlDir, { recursive: true });
    fs.mkdirSync(pdfDir, { recursive: true });

    const counters: ScrapeCounters = { found: 0, xmls: 0, pdfs: 0, xmls_exist: 0, pdfs_exist: 0 };

    for (const dateObj = new Date(startD); dateObj <= endD; dateObj.setDate(dateObj.getDate() + 1)) {
      const year = dateObj.getFullYear();
      const month = dateObj.getMonth() + 1;
      const day = dateObj.getDate();

      for (const typeCode of typeCodes) {
        const typeLabel = this._typeLabel(typeCode);
        await log(`Buscando ${typeLabel} para ${day.toString().padStart(2,'0')}/${month.toString().padStart(2,'0')}/${year}...`);

        const ok = await this._searchAndDownload(year, month, day, typeCode, xmlDir, pdfDir, counters, log);
        if (!ok) {
          await this._recoverSession(log);
        }
      }
    }

    const totalXmls = counters.xmls + counters.xmls_exist;
    const totalPdfs = counters.pdfs + counters.pdfs_exist;
    await logWithStatus(
      `Completado. Total comprobantes encontrados: ${counters.found}. XMLs: ${totalXmls} (${counters.xmls} nuevos, ${counters.xmls_exist} ya existentes), PDFs: ${totalPdfs} (${counters.pdfs} nuevos, ${counters.pdfs_exist} ya existentes)`,
      'COMPLETED'
    );
  }

  private async _searchAndDownload(
    year: number, month: number, day: number, typeCode: string,
    xmlDir: string, pdfDir: string, counters: ScrapeCounters,
    log: (msg: string) => Promise<void>,
  ): Promise<boolean> {
    const page = this.page!;
    const dateStr = `${day.toString().padStart(2,'0')}/${month.toString().padStart(2,'0')}/${year}`;

    try {
      const navOk = await this.navigateToComprobantes(log);
      if (!navOk) {
        const relogged = await this.login(this.ruc, this.clave, log);
        if (!relogged) return false;
        await this.navigateToComprobantes(log);
      }

      await page.waitForTimeout(2000);

      await this._selectAndVerify(page, 'select[id*="ano"]', String(year), log);
      await this._selectAndVerify(page, 'select[id*="mes"]', String(month), log);
      await this._selectAndVerify(page, 'select[id*="dia"]', String(day), log);
      await this._selectAndVerify(page, 'select[id*="cmbTipoComprobante"]', String(typeCode), log);

      await page.evaluate(() => {
        document.querySelectorAll('.ui-messages-close, [class*="close"], .rf-msg-close')
          .forEach(el => (el as HTMLElement).click());
      }).catch(() => {});

      for (let attempt = 0; attempt < 3; attempt++) {
        const apiKey = process.env.ANTICAPTCHA_KEY;
        const hasCaptcha = !!apiKey;

        if (hasCaptcha) {
          await log(`Pre-resolviendo CAPTCHA para ${dateStr} (intento ${attempt + 1})...`);
          const captchaSolved = await this._solveCaptcha(page, 'consulta_cel_recibidos');

          if (captchaSolved) {
            // Enviar formulario vía POST completo (no AJAX).
            // El token ya está en g-recaptcha-response y se incluye en el POST.
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

            // Verificar resultado directamente en la página nueva
            const checkResult = await page.evaluate(() => {
              const text = document.body?.innerText || '';
              const hasTable = document.querySelector('#frmPrincipal\\:tablaCompRecibidos tr, [id*="tablaCompRecibidos"] tr') !== null;
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
              await log(`CAPTCHA error en intento ${attempt + 1}, reintentando...`);
              await page.evaluate(() => {
                document.querySelectorAll('.ui-messages-close, [class*="close"], .rf-msg-close')
                  .forEach(el => (el as HTMLElement).click());
              }).catch(() => {});
              await page.waitForTimeout(2000);
              continue;
            }
            // timeout — reintentar
            await log(`Timeout en intento ${attempt + 1}, reintentando...`);
            continue;
          }
        }

        // Sin CAPTCHA disponible — fallback a click + polling AJAX
        await this._clickConsultar(page);
        const before = Date.now();
        const searchTimeout = this.headless ? 40000 : 90000;
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
          await log(`CAPTCHA error en intento ${attempt + 1}, reintentando...`);
          await page.evaluate(() => {
            document.querySelectorAll('.ui-messages-close, [class*="close"], .rf-msg-close')
              .forEach(el => (el as HTMLElement).click());
          }).catch(() => {});
          await page.waitForTimeout(2000);
          continue;
        }
        if (searchResult === 'timeout') {
          if (attempt < 2) {
            await log(`Timeout en intento ${attempt + 1}, reintentando...`);
            continue;
          }
        }
      }

      await captureDiagnosticInfo(page, `failed-${year}${month}${day}`, this.diagDir);
      await log(`No se pudieron obtener resultados para ${dateStr} tras 3 intentos.`);
      return true;
    } catch (err: any) {
      await log(`Error en ${dateStr}: ${err.message}`);
      await captureDiagnosticInfo(page, `error-${year}${month}${day}`, this.diagDir);
      return true;
    }
  }

  private async _clickConsultar(page: Page): Promise<boolean> {
    // Si la función global executeRecaptcha existe en el portal y no estamos usando resolvedor externo,
    // la llamamos directamente para evitar peticiones síncronas concurrentes y conflictos de ViewState de PrimeFaces/JSF.
    const hasExecuteRecaptcha = await page.evaluate(() => typeof (window as any).executeRecaptcha === 'function').catch(() => false);
    if (hasExecuteRecaptcha) {
      console.log('[PW] Lanzando consulta llamando directamente a executeRecaptcha()...');
      await page.evaluate(() => (window as any).executeRecaptcha('consulta_cel_recibidos', 'SI')).catch(() => {});
      await page.waitForTimeout(2000);
      return true;
    }

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
        await btn.click({ force: true });
        await page.waitForTimeout(2000);
        return true;
      }
    }

    const textBtn = page.getByText('Consultar', { exact: true }).first();
    if (await textBtn.isVisible().catch(() => false)) {
      await textBtn.click({ force: true });
      await page.waitForTimeout(2000);
      return true;
    }

    const primeSuccess = await page.evaluate(() => {
      const prime = (window as any).PrimeFaces;
      if (prime?.ab) {
        try { prime.ab({ source: 'frmPrincipal:btnBuscar' }); return true; } catch {}
      }
      return false;
    });
    if (primeSuccess) { await page.waitForTimeout(2000); return true; }

    const formSuccess = await page.evaluate(() => {
      const form = document.getElementById('frmPrincipal') as HTMLFormElement;
      if (form) { form.submit(); return true; }
      return false;
    });
    if (formSuccess) { await page.waitForTimeout(2000); return true; }

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
            '#frmPrincipal\\:tablaCompRecibidos tr, [id*="tablaCompRecibidos"] tr'
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
            '#frmPrincipal\\:tablaCompRecibidos, [id*="tablaCompRecibidos"], table.rf-dt-bdy'
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
    const { db } = require('@/lib/sri-api/db');
    const colIdx = await this._detectColumnHeaders(page);
    const tipoMap: Record<string, string> = { 'FACTURA': '01', 'LIQUIDACIÓN': '03', 'LIQUIDACION': '03', 'NOTA DE CRÉDITO': '04', 'NOTA DE CREDITO': '04', 'NOTA DE DÉBITO': '05', 'NOTA DE DEBITO': '05', 'COMPROBANTE DE RETENCIÓN': '06', 'COMPROBANTE DE RETENCION': '06' };

    let hasNextPage = true;
    let pageNum = 1;

    while (hasNextPage) {
      await log(`Procesando pagina ${pageNum} de resultados...`);

      const rowsData = await page.evaluate(() => {
        const allRows = Array.from(document.querySelectorAll('#frmPrincipal\\:tablaCompRecibidos tr, [id*="tablaCompRecibidos"] tr'));
        return allRows
          .filter(tr => (tr as HTMLElement).innerText.match(/\d{49}/))
          .map((tr, idx) => {
            const cells = (tr as HTMLElement).querySelectorAll('td');
            const cellTexts = Array.from(cells).map(c => (c as HTMLElement).innerText.trim());
            return { index: idx, textos: cellTexts };
          });
      });

      for (const row of rowsData) {
        const textos = row.textos;
        const rawClave = (colIdx.clave !== -1 && colIdx.clave < textos.length) ? textos[colIdx.clave] : '';
        const claveAcceso = rawClave.match(/\d{49}/)?.[0];
        if (!claveAcceso) continue;

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
              `INSERT INTO comprobantes (clave_acceso, tipo, estado, receptor_identificacion, tenant_id,
                emisor_ruc, emisor_razon_social, importe_total, total_sin_impuesto, total_iva,
                fecha_emision, fecha_autorizacion, serie, secuencial)
               VALUES ($1, $2, 'PENDIENTE', $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)`,
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

        await this._downloadRowFiles(page, row.index, claveAcceso, xmlDir, pdfDir, counters, log);

        const xmlPath = path.join(xmlDir, `${claveAcceso}.xml`);
        if (fs.existsSync(xmlPath)) {
          try {
            await updateComprobanteFromXml(db, xmlPath, claveAcceso, this.tenantId);
          } catch (e: any) {
            await log(`ERROR updateComprobanteFromXml: ${claveAcceso} — ${e.message}`);
          }
          try {
            const compRecord = await db.queryOne(
              'SELECT id, fecha_emision FROM comprobantes WHERE clave_acceso = $1', [claveAcceso],
            );
            if (compRecord) {
              const { xmlStorage } = require('@/lib/sri-api/xml-storage');
              const xmlContent = fs.readFileSync(xmlPath, 'utf-8');
              let fechaEmisionDate: Date;
              if (compRecord.fecha_emision instanceof Date) {
                fechaEmisionDate = compRecord.fecha_emision;
              } else if (compRecord.fecha_emision && typeof compRecord.fecha_emision === 'string') {
                fechaEmisionDate = new Date(compRecord.fecha_emision.includes('T') ? compRecord.fecha_emision : compRecord.fecha_emision + 'T12:00:00');
              } else {
                fechaEmisionDate = new Date();
              }
              if (isNaN(fechaEmisionDate.getTime())) {
                fechaEmisionDate = new Date();
              }
              const autorizadoPath = xmlStorage.saveXml(
                this.ruc, claveAcceso, fechaEmisionDate, 'autorizado', xmlContent,
              );
              
              const xmlExists = await db.queryOne(
                'SELECT id FROM comprobante_xmls WHERE comprobante_id = $1', [compRecord.id]
              ).catch(() => null);

              if (xmlExists) {
                await db.query(
                  'UPDATE comprobante_xmls SET xml_autorizado_path = $1 WHERE comprobante_id = $2',
                  [autorizadoPath, compRecord.id]
                );
              } else {
                await db.query(
                  'INSERT INTO comprobante_xmls (comprobante_id, xml_autorizado_path) VALUES ($1, $2)',
                  [compRecord.id, autorizadoPath]
                );
              }
              await log(`DB: XML persistido en xmlStorage + comprobante_xmls`);
            }
          } catch (e: any) {
            await log(`ERROR guardando XML en xmlStorage: ${claveAcceso} — ${e.message}`);
          }
        }
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
      } else {
        hasNextPage = false;
      }
    }
  }

  private _parseSriDate(dateStr: string | null): string | null {
    if (!dateStr) return null;
    const parts = dateStr.match(/(\d{2})\/(\d{2})\/(\d{4})/);
    if (parts) return `${parts[3]}-${parts[2]}-${parts[1]}`;
    return null;
  }

  private async _firstTableKey(page: Page): Promise<string | null> {
    return page.evaluate(() => {
      const rows = Array.from(document.querySelectorAll('#frmPrincipal\\:tablaCompRecibidos tr, [id*="tablaCompRecibidos"] tr'));
      for (const tr of rows) {
        const m = (tr as HTMLElement).innerText.match(/\d{49}/);
        if (m) return m[0];
      }
      return null;
    });
  }

  private async _downloadRowFiles(
    page: Page, rowIndex: number, claveAcceso: string,
    xmlDir: string, pdfDir: string, counters: ScrapeCounters,
    log: (msg: string) => Promise<void>,
  ): Promise<void> {
    const xmlPath = path.join(xmlDir, `${claveAcceso}.xml`);
    const pdfPath = path.join(pdfDir, `${claveAcceso}.pdf`);

    const colInfo = await page.evaluate((idx: number) => {
      const rows = Array.from(document.querySelectorAll('#frmPrincipal\\:tablaCompRecibidos tr, [id*="tablaCompRecibidos"] tr'))
        .filter(tr => (tr as HTMLElement).innerText.match(/\d{49}/));
      if (idx >= rows.length) return null;
      const cells = rows[idx].querySelectorAll('td');
      return Array.from(cells).map((cell, colIdx) => {
        const anchors = Array.from(cell.querySelectorAll('a'));
        const inputs = Array.from(cell.querySelectorAll('input[type="image"]'));
        const buttons = Array.from(cell.querySelectorAll('button'));
        const allEls = [...anchors, ...inputs, ...buttons];
        return {
          col: colIdx,
          html: cell.innerHTML.substring(0, 500),
          elements: allEls.map(el => ({
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
    }, rowIndex);

    if (!colInfo) return;

    let xmlCol: number | null = null;
    let pdfCol: number | null = null;
    let relCol: number | null = null;

    for (const cell of colInfo) {
      for (const el of cell.elements) {
        const info = (el.src + el.id + el.title + el.onclick + el.text + el.href).toLowerCase();
        if (info.includes('xml') || info.includes('comprobante')) xmlCol = cell.col;
        if (info.includes('pdf') || info.includes('ride')) pdfCol = cell.col;
        if (info.includes('relacionado') || info.includes('relacionados')) relCol = cell.col;
      }
    }

    if (xmlCol !== null) {
      if (fs.existsSync(xmlPath)) {
        counters.xmls_exist++;
      } else {
        await this._downloadFromColumn(page, rowIndex, xmlCol, xmlPath, 'XML', counters, log, claveAcceso);
      }
    }

    if (pdfCol !== null) {
      if (fs.existsSync(pdfPath)) {
        counters.pdfs_exist++;
      } else {
        await this._downloadFromColumn(page, rowIndex, pdfCol, pdfPath, 'RIDE', counters, log, claveAcceso);
      }
    }

    if (relCol !== null) {
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

    const clickFn = () => page.evaluate(({ c, idx }: any) => {
      const rows = Array.from(document.querySelectorAll('#frmPrincipal\\:tablaCompRecibidos tr, [id*="tablaCompRecibidos"] tr'))
        .filter(tr => (tr as HTMLElement).innerText.match(/\d{49}/));
      if (idx >= rows.length) return;
      const cells = rows[idx].querySelectorAll('td');
      if (c >= cells.length) return;
      const clickable = cells[c].querySelector('a, input[type="image"], button');
      if (clickable) (clickable as HTMLElement).click();
    }, { c: col, idx: rowIndex });

    await this._downloadWithCapture(page, clickFn, targetPath, label, counters, log, claveAcceso);
  }

  private async _downloadWithCapture(
    page: Page, clickFn: () => Promise<void>,
    targetPath: string, label: string,
    counters: ScrapeCounters, log: (msg: string) => Promise<void>,
    claveAcceso: string,
  ): Promise<boolean> {
    const isXml = label.includes('XML');
    const timeout = 25000;

    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        const downloadP = page.waitForEvent('download', { timeout });
        const responseP = page.waitForResponse(
          r => {
            const ct = (r.headers()['content-type'] || '').toLowerCase();
            const cd = (r.headers()['content-disposition'] || '').toLowerCase();
            return (
              ct.includes('xml') || ct.includes('octet-stream') || ct.includes('force-download') ||
              cd.includes('attachment') || ct.includes('application/pdf')
            );
          },
          { timeout },
        );
        const newPageP = page.context().waitForEvent('page', { timeout });

        await clickFn();

        const result = await Promise.race([
          downloadP.then(dl => ({ type: 'download' as const, data: dl })),
          responseP.then(r => ({ type: 'response' as const, data: r })),
          newPageP.then(p => ({ type: 'page' as const, data: p })),
        ]);

        if (result.type === 'download') {
          await result.data.saveAs(targetPath);
          if (isXml) counters.xmls++; else counters.pdfs++;
          await log(`${label} descargado: ${claveAcceso}`);
          return true;
        }

        if (result.type === 'response') {
          const buffer = await result.data.body();
          fs.writeFileSync(targetPath, buffer);
          if (isXml) counters.xmls++; else counters.pdfs++;
          await log(`${label} descargado: ${claveAcceso}`);
          return true;
        }

        if (result.type === 'page') {
          const newPage = result.data;
          await newPage.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => {});
          await newPage.waitForTimeout(2000);
          let saved = false;
          const pageResp = await newPage.evaluate(async () => {
            try {
              const r = await fetch(window.location.href);
              const buf = await r.arrayBuffer();
              return Array.from(new Uint8Array(buf));
            } catch { return null; }
          }).catch(() => null);
          if (pageResp && pageResp.length > 100) {
            fs.writeFileSync(targetPath, Buffer.from(pageResp));
            saved = true;
          }
          if (!saved) {
            const html = await newPage.content().catch(() => '');
            if (html && html.length > 100) {
              fs.writeFileSync(targetPath, html);
              saved = true;
            }
          }
          if (saved) {
            if (isXml) counters.xmls++; else counters.pdfs++;
            await log(`${label} descargado (desde nueva pestaña): ${claveAcceso}`);
          } else {
            await log(`${label}: no se pudo obtener contenido`);
          }
          await newPage.close().catch(() => {});
          return saved;
        }
      } catch {
        console.log(`[PW] ${label} ${claveAcceso} intento ${attempt + 1} fallo (timeout)`);
      }
      await page.waitForTimeout(2000);
    }
    return false;
  }

  private async _downloadRelacionados(
    page: Page, rowIndex: number, relCol: number,
    claveAcceso: string, xmlDir: string, pdfDir: string,
    counters: ScrapeCounters, log: (msg: string) => Promise<void>,
  ): Promise<void> {
    await log(`Revisando documentos relacionados para ${claveAcceso}...`);

    try {
      await page.evaluate(({ c, idx }: any) => {
        const rows = Array.from(document.querySelectorAll('#frmPrincipal\\:tablaCompRecibidos tr, [id*="tablaCompRecibidos"] tr'))
          .filter(tr => (tr as HTMLElement).innerText.match(/\d{49}/));
        if (idx >= rows.length) return;
        const cells = rows[idx].querySelectorAll('td');
        if (c >= cells.length) return;
        const link = cells[c].querySelector('a');
        if (link) (link as HTMLElement).click();
      }, { c: relCol, idx: rowIndex });

      await page.waitForTimeout(3000);

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
        await locator.selectOption(value);
        await page.waitForTimeout(500);
        const actual = await locator.inputValue();
        if (actual === value) {
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

  async close(): Promise<void> {
    if (this.context) await this.context.close().catch(() => {});
    if (this.browser) await this.browser.close().catch(() => {});
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
