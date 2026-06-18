import * as cheerio from 'cheerio';
import path from 'path';
import fs from 'fs';
// @ts-ignore
import ac from '@antiadmin/anticaptchaofficial';
import { HttpClient, parseForm, resolveUrl } from './http-client';
import { parseSriFloat, extractClaveAcceso, extractRuc, cleanEmisorRazonSocial, extractFechaEmision } from './sri-utils';

const SRI_BASE = 'https://srienlinea.sri.gob.ec';
const RECAPTCHA_SITE_KEY = '6LdukTQsAAAAAIcciM4GZq4ibeyplUhmWvlScuQE';

export interface ComprobanteRow {
  claveAcceso: string;
  rucEmisor: string | null;
  razonSocial: string | null;
  total: number;
  tipo: string;
  fechaAutorizacion: string | null;
  xmlUrl?: string;
  pdfUrl?: string;
}

export interface SearchOptions {
  year: number;
  month: number;
  day: number;
  typeCode: string;
}

export interface CaptchaProvider {
  solve(action?: string): Promise<string>;
}

interface ColumnIndex {
  tipo: number;
  rucEmisor: number;
  emisor: number;
  clave: number;
  fechaAutorizacion: number;
  total: number;
}

const DEFAULT_COL_IDX: ColumnIndex = {
  tipo: 1,
  rucEmisor: 2,
  emisor: 3,
  clave: 4,
  fechaAutorizacion: 5,
  total: -1,
};

function logDebug(...args: any[]): void {
  console.log('[HTTP]', ...args);
}

class AntiCaptchaProvider implements CaptchaProvider {
  async solve(action?: string): Promise<string> {
    const apiKey = process.env.ANTICAPTCHA_KEY;
    if (!apiKey) return '';
    try {
      ac.setAPIKey(apiKey);
      ac.setSoftId(0);
      logDebug(`Resolviendo CAPTCHA con Anti-Captcha${action ? ` (${action})` : ''}...`);
      const token = await ac.solveRecaptchaV2EnterpriseProxyless(
        `${SRI_BASE}/comprobantes-electronicos-internet/pages/consultas/recibidos/comprobantesRecibidos.jsf`,
        RECAPTCHA_SITE_KEY,
        action ? { s: action } : {}
      );
      if (token) logDebug('Token CAPTCHA obtenido.');
      return token || '';
    } catch (err: any) {
      logDebug(`Error Anti-Captcha: ${err.message}`);
      return '';
    }
  }
}

class TwoCaptchaProvider implements CaptchaProvider {
  private solver: any;

  constructor() {
    try {
      const { CaptchaSolver } = require('2captcha-ts');
      this.solver = new CaptchaSolver(process.env.TWOCAPTCHA_KEY || '');
    } catch {
      logDebug('2captcha-ts no disponible');
    }
  }

  async solve(action?: string): Promise<string> {
    if (!this.solver) return '';
    try {
      logDebug(`Resolviendo CAPTCHA con 2captcha${action ? ` (${action})` : ''}...`);
      const result = await this.solver.recaptcha({
        pageurl: `${SRI_BASE}/comprobantes-electronicos-internet/pages/consultas/recibidos/comprobantesRecibidos.jsf`,
        googlekey: RECAPTCHA_SITE_KEY,
        ...(action ? { action } : {}),
      });
      if (result?.data) {
        logDebug('Token CAPTCHA obtenido de 2captcha.');
        return result.data;
      }
    } catch (err: any) {
      logDebug(`Error 2captcha: ${err.message}`);
    }
    return '';
  }
}

function createCaptchaProviders(): CaptchaProvider[] {
  const providers: CaptchaProvider[] = [];
  if (process.env.ANTICAPTCHA_KEY) providers.push(new AntiCaptchaProvider());
  if (process.env.TWOCAPTCHA_KEY) providers.push(new TwoCaptchaProvider());
  return providers;
}

export class SriHttpScraper {
  private client: HttpClient;
  private authenticated = false;
  private viewState = '';
  private appFormAction = '';
  private tenantId: string | null = null;
  private captchaProviders: CaptchaProvider[] = [];
  private ruc = '';
  private clave = '';
  private progressLog?: (msg: string) => Promise<void>;

  constructor(opts?: {
    proxyUrl?: string;
    cookieJarPath?: string;
    tenantId?: string;
  }) {
    this.client = new HttpClient({
      proxyUrl: opts?.proxyUrl,
      cookieJarPath: opts?.cookieJarPath,
    });
    this.tenantId = opts?.tenantId || null;
    this.captchaProviders = createCaptchaProviders();
    this.client.loadCookiesFromDisk();
  }

  private async solveCaptcha(action?: string): Promise<string> {
    for (const provider of this.captchaProviders) {
      const token = await provider.solve(action);
      if (token) return token;
    }
    return '';
  }

  private async log(msg: string): Promise<void> {
    if (this.progressLog) {
      await this.progressLog(msg);
    } else {
      logDebug(msg);
    }
  }

  async login(ruc: string, clave: string, updateProgress?: (msg: string) => Promise<void>): Promise<boolean> {
    this.ruc = ruc;
    this.clave = clave;
    this.progressLog = updateProgress;
    await this.log('Iniciando sesión HTTP en el SRI...');

    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        const result = await this._loginAttempt(ruc, clave, this.log.bind(this));
        if (result) {
          this.client.saveCookiesToDisk();
          return true;
        }
        if (attempt < 2) {
          await this.log(`Reintentando login (${attempt + 1}/3)...`);
          await new Promise(r => setTimeout(r, 2000 * Math.pow(2, attempt)));
          this.client.clearCookies();
        }
      } catch (err: any) {
        await this.log(`Error en intento ${attempt + 1}: ${err.message}`);
        if (attempt < 2) await new Promise(r => setTimeout(r, 2000 * Math.pow(2, attempt)));
      }
    }
    return false;
  }

  private isProbablySessionPage(body: string): boolean {
    const lower = body.toLowerCase();
    if (lower.includes('login') || lower.includes('password') || lower.includes('openid-connect')) return false;
    if (lower.includes('validación de navegadores') || lower.includes('validacion de navegadores') || lower.includes('acceder a los servicios autenticados')) return false;
    if (lower.includes('logout') || lower.includes('cerrar sesión') || lower.includes('cerrar sesion')) return true;
    if (lower.includes('ruc') && body.length > 1000) return true;
    return false;
  }

  private async _loginAttempt(
    ruc: string, clave: string,
    log: (msg: string) => Promise<void>
  ): Promise<boolean> {
    let landing = await this.client.get(`${SRI_BASE}/sri-en-linea/contribuyente/perfil`, { redirect: 'manual' });
    let loginUrl = landing.headers.get('location');

    if (!loginUrl) {
      if (landing.status === 200 && this.isProbablySessionPage(landing.body)) {
        this.authenticated = true;
        await log('Sesión HTTP ya activa.');
        return true;
      }
      // SPA devuelve 200 sin redirect. Probar con el portal legacy.
      await log('SPA detectado, probando portal legacy...');
      landing = await this.client.get(`${SRI_BASE}/tuportal-internet/`, { redirect: 'manual' });
      loginUrl = landing.headers.get('location');
      if (!loginUrl) {
        await log('No se recibió redirect al login. Status: ' + landing.status);
        return false;
      }
      await log('Redirigiendo desde portal legacy...');
    }

    await log('Siguiendo redirect a Keycloak...');
    const authPage = await this.client.get(loginUrl, { redirect: 'follow' });
    const $ = cheerio.load(authPage.body);

    const forms: { action: string; fields: Record<string, string> }[] = [];
    $('form').each((_, el) => {
      const action = $(el).attr('action') || '';
      if (!action && !$(el).attr('method')) return;
      const fields: Record<string, string> = {};
      $(el).find('input[name]').each((_, inp) => {
        const name = $(inp).attr('name')!;
        const type = $(inp).attr('type') || 'text';
        if (type === 'submit' || type === 'button' || type === 'checkbox' || type === 'radio') return;
        fields[name] = $(inp).attr('value') || '';
      });
      if (Object.keys(fields).length > 0) {
        forms.push({ action, fields });
      }
    });

    if (forms.length === 0) {
      // Fallback: buscar todos los inputs en la página
      await log('No se encontraron forms con fields, intentando extracción directa...');
      const allInputs: Record<string, string> = {};
      $('input[name]').each((_, el) => {
        const name = $(el).attr('name')!;
        const type = $(el).attr('type') || 'text';
        if (type === 'submit' || type === 'button') return;
        allInputs[name] = $(el).attr('value') || '';
      });
      if (allInputs['username'] !== undefined || allInputs['password'] !== undefined) {
        forms.push({ action: '', fields: allInputs });
      }
    }

    const loginForm = forms.find(f => (f.fields['usuario'] !== undefined || f.fields['username'] !== undefined) && f.fields['password'] !== undefined);
    if (!loginForm) {
      await log(`No se encontró formulario de login Keycloak. Forms: ${forms.length}, fields: ${forms.map(f => Object.keys(f.fields).join(',')).join(' | ')}`);
      return false;
    }

    const actionUrl = resolveUrl(authPage.url, loginForm.action);
    const formBody = new URLSearchParams(loginForm.fields);
    // Keycloak usa "usuario" como campo visible; "username" es hidden
    if (formBody.has('usuario')) {
      formBody.set('usuario', ruc);
    }
    formBody.set('password', clave);

    const captchaToken = '';
    await log('Enviando credenciales a Keycloak...');
    const postLogin = await this.client.post(actionUrl, formBody, { redirect: 'manual' });

    if (postLogin.status === 302 || postLogin.status === 303) {
      return this._handleLoginRedirect(postLogin, log);
    }

    if (postLogin.status === 200) {
      if (/login|credencial|error/i.test(postLogin.body)) {
        const $2 = cheerio.load(postLogin.body);
        const errMsg = $2('.alert-error, .alert-danger, .kc-feedback-text, .error').text().trim();
        await log(`Credenciales rechazadas: ${errMsg || 'revísalas'}`);
        return false;
      }
    }

    this.authenticated = true;
    await log('Login HTTP exitoso (status ' + postLogin.status + ').');
    return true;
  }

  private async _handleLoginRedirect(postLogin: any, log: (msg: string) => Promise<void>): Promise<boolean> {
    const redirectTarget = postLogin.headers.get('location');
    if (!redirectTarget) {
      await log('Redirect sin Location header.');
      return false;
    }
    const finalFollow = await this.client.get(redirectTarget, { redirect: 'follow' });
    if (/login|credencial|error/i.test(finalFollow.body)) {
      const $2 = cheerio.load(finalFollow.body);
      const errMsg = $2('.alert-error, .alert-danger, .kc-feedback-text').text().trim();
      await log(`Error en login: ${errMsg || 'credenciales inválidas'}`);
      return false;
    }

    await log('Verificando sesión en app SRI...');
    const appCheck = await this.client.get(
      `${SRI_BASE}/tuportal-internet/accederAplicacion.jspa?redireccion=57&idGrupo=55`,
      { redirect: 'manual' }
    );

    if (appCheck.status === 302 || /login/i.test(appCheck.body)) {
      await log('Redirigido al login después de auth. Reintentando con follow...');
      const followApp = await this.client.get(
        `${SRI_BASE}/tuportal-internet/accederAplicacion.jspa?redireccion=57&idGrupo=55`,
        { redirect: 'follow' }
      );
      if (/login/i.test(followApp.body) && followApp.body.includes('password')) {
        await log('No se pudo establecer sesión en la app SRI.');
        return false;
      }
    }

    this.authenticated = true;
    await log('Login HTTP exitoso.');
    return true;
  }

  async ensureSession(): Promise<boolean> {
    if (this.authenticated) {
      try {
        const check = await this.client.get(`${SRI_BASE}/tuportal-internet/accederAplicacion.jspa?redireccion=57&idGrupo=55`, { redirect: 'manual' });
        if (check.status === 200 && !/login/i.test(check.body)) return true;
      } catch {}
    }
    this.authenticated = false;
    return false;
  }

  private async _ensureAuthenticated(): Promise<boolean> {
    if (this.authenticated && await this.ensureSession()) return true;
    if (this.ruc && this.clave) {
      await this.log('Sesión expirada. Re-autenticando...');
      this.authenticated = false;
      return this.login(this.ruc, this.clave, this.progressLog);
    }
    return false;
  }

  private async loadAppForm(): Promise<boolean> {
    const appUrl = `${SRI_BASE}/tuportal-internet/accederAplicacion.jspa?redireccion=57&idGrupo=55`;
    logDebug('Cargando app comprobantes...');
    const appPage = await this.client.get(appUrl, { redirect: 'follow' });
    logDebug(`URL final app: ${appPage.url}, Body length: ${appPage.body.length}`);

    if (/login/i.test(appPage.body) && appPage.body.includes('password')) {
      logDebug('Redirigido al login. Sesión expiró.');
      this.authenticated = false;
      if (this.ruc && this.clave) {
        logDebug('Re-autenticando...');
        await this._ensureAuthenticated();
        const retryPage = await this.client.get(appUrl, { redirect: 'follow' });
        if ((/login/i.test(retryPage.body) && retryPage.body.includes('password')) || !retryPage.body.includes('frmPrincipal')) {
          logDebug('No se pudo recuperar sesión.');
          return false;
        }
        return this._parseAppForm(retryPage);
      }
      return false;
    }

    return this._parseAppForm(appPage);
  }

  private _parseAppForm(appPage: { body: string; url: string }): boolean {
    const $ = cheerio.load(appPage.body);

    let formEl = $('form[id*="frmPrincipal"]');
    if (!formEl.length) formEl = $('form[id*="form"]');
    if (!formEl.length) formEl = $('form').first();

    if (!formEl.length) {
      logDebug('No se encontró formulario JSF.');
      return false;
    }

    const formAction = formEl.attr('action') || '';
    this.appFormAction = resolveUrl(appPage.url, formAction);

    const vsInput = formEl.find('input[name="javax.faces.ViewState"], input[name="javax.faces.Token"]');
    this.viewState = (vsInput.val() as string) || '';

    logDebug(`Form action: ${this.appFormAction}, ViewState: ${this.viewState.slice(0, 50)}...`);
    return true;
  }

  private buildSearchBody(
    year: string, month: string, day: string, typeCode: string,
    extraParams?: Record<string, string>
  ): URLSearchParams {
    const body = new URLSearchParams();
    const params: Record<string, string> = {
      'javax.faces.ViewState': this.viewState,
      'frmPrincipal:ano': year,
      'frmPrincipal:mes': month,
      'frmPrincipal:dia': day,
      'frmPrincipal:cmbTipoComprobante': typeCode,
      'frmPrincipal:btnBuscar': 'Consultar',
      'javax.faces.source': 'frmPrincipal:btnBuscar',
      'javax.faces.partial.event': 'click',
      'javax.faces.partial.execute': '@all',
      'javax.faces.partial.render': '@all',
      ...extraParams,
    };
    for (const [k, v] of Object.entries(params)) {
      body.set(k, v);
    }
    return body;
  }

  async searchComprobantes(opts: SearchOptions): Promise<ComprobanteRow[]> {
    const authed = await this._ensureAuthenticated();
    if (!authed) throw new Error('No autenticado.');

    const loaded = await this.loadAppForm();
    if (!loaded) return [];

    const typeCode = opts.typeCode || '1';
    const year = String(opts.year);
    const month = String(opts.month).padStart(2, '0');
    const day = String(opts.day).padStart(2, '0');

    logDebug(`Buscando: ${year}/${month}/${day} tipo=${typeCode}`);

    const captchaToken = await this.solveCaptcha('consulta_cel_recibidos');

    const body = this.buildSearchBody(year, month, day, typeCode);
    if (captchaToken) {
      body.set('g-recaptcha-response', captchaToken);
    }

    logDebug('Enviando POST búsqueda...');
    const searchRes = await this.client.post(this.appFormAction, body, {
      headers: {
        'Faces-Request': 'partial/ajax',
        'X-Requested-With': 'XMLHttpRequest',
      },
      redirect: 'follow',
      retry: 2,
      retryDelay: 3000,
    });
    logDebug(`POST status: ${searchRes.status}, length: ${searchRes.body.length}`);

    const allResults: ComprobanteRow[] = [];
    const isAjax = searchRes.body.trim().startsWith('<?xml') || searchRes.body.trim().startsWith('<partial-response>');

    if (isAjax) {
      const page1 = this.parseJsfAjaxResponse(searchRes.body, typeCode);
      allResults.push(...page1);
      this._tryExtractViewStateFromAjax(searchRes.body);
    } else {
      const page1 = this.parseFullPageResponse(searchRes.body, typeCode);
      allResults.push(...page1);
    }

    if (allResults.length > 0) {
      const remainingPages = await this._fetchRemainingPages(typeCode, year, month, day);
      allResults.push(...remainingPages);
    }

    return allResults;
  }

  private _tryExtractViewStateFromAjax(xmlBody: string): void {
    const vsMatch = xmlBody.match(/<update\s+id="[^"]*"[^>]*>([\s\S]*?)<\/update>/);
    if (vsMatch) {
      const inner = vsMatch[1].trim();
      if (inner.length > 10 && inner.length < 500) {
        this.viewState = inner;
        logDebug('ViewState actualizado desde AJAX.');
      }
    }
  }

  private async _fetchRemainingPages(
    typeCode: string, year: string, month: string, day: string
  ): Promise<ComprobanteRow[]> {
    const results: ComprobanteRow[] = [];
    let hasNext = true;
    let pageNum = 2;

    while (hasNext) {
      logDebug(`Solicitando página ${pageNum}...`);
      const body = new URLSearchParams();
      const params: Record<string, string> = {
        'javax.faces.ViewState': this.viewState,
        'frmPrincipal:ano': year,
        'frmPrincipal:mes': month,
        'frmPrincipal:dia': day,
        'frmPrincipal:cmbTipoComprobante': typeCode,
        'frmPrincipal:tablaCompRecibidos:ds:next': `ds_next_${pageNum}`,
        'frmPrincipal:tablaCompRecibidos:ds': `ds_${pageNum}`,
        'javax.faces.source': 'frmPrincipal:tablaCompRecibidos:ds',
        'javax.faces.partial.event': 'click',
        'javax.faces.partial.execute': 'frmPrincipal:tablaCompRecibidos:ds',
        'javax.faces.partial.render': 'frmPrincipal:tablaCompRecibidos',
        'frmPrincipal:tablaCompRecibidos:ds:page': String(pageNum),
      };
      for (const [k, v] of Object.entries(params)) {
        body.set(k, v);
      }

      const pageRes = await this.client.post(this.appFormAction, body, {
        headers: {
          'Faces-Request': 'partial/ajax',
          'X-Requested-With': 'XMLHttpRequest',
        },
        redirect: 'follow',
        retry: 1,
      });

      if (pageRes.body.trim().startsWith('<?xml') || pageRes.body.trim().startsWith('<partial-response>')) {
        const parsed = this.parseJsfAjaxResponse(pageRes.body, typeCode);
        if (parsed.length === 0) {
          hasNext = false;
        } else {
          results.push(...parsed);
          pageNum++;
          this._tryExtractViewStateFromAjax(pageRes.body);
        }
      } else {
        hasNext = false;
      }
    }

    return results;
  }

  async downloadListadoTxt(
    year: string, month: string, day: string, typeCode: string
  ): Promise<string | null> {
    const authed = await this._ensureAuthenticated();
    if (!authed) return null;

    const loaded = await this.loadAppForm();
    if (!loaded) return null;

    const captchaToken = await this.solveCaptcha('consulta_cel_recibidos');

    const body = this.buildSearchBody(year, month.padStart(2, '0'), day.padStart(2, '0'), typeCode);
    if (captchaToken) {
      body.set('g-recaptcha-response', captchaToken);
    }

    const searchRes = await this.client.post(this.appFormAction, body, {
      headers: {
        'Faces-Request': 'partial/ajax',
        'X-Requested-With': 'XMLHttpRequest',
      },
      redirect: 'follow',
    });

    if (searchRes.body.trim().startsWith('<?xml') || searchRes.body.trim().startsWith('<partial-response>')) {
      this._tryExtractViewStateFromAjax(searchRes.body);
    } else {
      const $ = cheerio.load(searchRes.body);
      const vs = $('input[name="javax.faces.ViewState"]').val() as string;
      if (vs) this.viewState = vs;
    }

    const txtBody = new URLSearchParams();
    const txtParams: Record<string, string> = {
      'javax.faces.ViewState': this.viewState,
      'frmPrincipal:ano': year,
      'frmPrincipal:mes': month.padStart(2, '0'),
      'frmPrincipal:dia': day.padStart(2, '0'),
      'frmPrincipal:cmbTipoComprobante': typeCode,
      'frmPrincipal:lnkTxtlistado': 'lnkTxtlistado',
      'javax.faces.source': 'frmPrincipal:lnkTxtlistado',
    };
    for (const [k, v] of Object.entries(txtParams)) {
      txtBody.set(k, v);
    }

    const txtRes = await this.client.post(this.appFormAction, txtBody, {
      redirect: 'follow',
    });

    if (txtRes.status === 200 && txtRes.body.length > 0 && txtRes.body.includes('|')) {
      return txtRes.body;
    }

    return null;
  }

  private parseJsfAjaxResponse(xmlBody: string, typeCode: string): ComprobanteRow[] {
    const results: ComprobanteRow[] = [];
    const updateMatches = xmlBody.match(/<update\s+id="([^"]*)"[^>]*>[\s\S]*?<!\[CDATA\[([\s\S]*?)\]\]>[\s\S]*?<\/update>/g);
    if (updateMatches) {
      for (const match of updateMatches) {
        const contentMatch = match.match(/<!\[CDATA\[([\s\S]*?)\]\]>/);
        if (!contentMatch) continue;
        const parsed = this.extractResultsFromHtml(contentMatch[1], typeCode);
        results.push(...parsed);
      }
    }
    return results;
  }

  private parseFullPageResponse(htmlBody: string, typeCode: string): ComprobanteRow[] {
    const $ = cheerio.load(htmlBody);
    const vs = $('input[name="javax.faces.ViewState"]').val() as string;
    if (vs) this.viewState = vs;

    if ($('body').text().includes('No se encontraron') || $('body').text().includes('No existen')) {
      logDebug('Sin resultados.');
      return [];
    }

    const tableSelectors = [
      'table[id*="tablaCompRecibidos"]',
      'table.rf-dt-bdy',
      'table.ui-datatable',
      'table[id*="frmPrincipal:tabla"]',
      'table',
    ];
    let tableHtml = '';
    for (const sel of tableSelectors) {
      const tbl = $(sel);
      if (tbl.length && tbl.find('tr').length > 1) {
        tableHtml = $.html(tbl);
        break;
      }
    }

    if (!tableHtml) {
      logDebug('No se encontró tabla de resultados.');
      return [];
    }

    return this.extractResultsFromHtml(tableHtml, typeCode);
  }

  private extractResultsFromHtml(html: string, typeCode: string): ComprobanteRow[] {
    const results: ComprobanteRow[] = [];
    const $ = cheerio.load(html);

    const headers = this._detectColumnHeaders($);
    const colIdx = headers ?? DEFAULT_COL_IDX;

    $('tr').each((_, tr) => {
      const cells = $(tr).find('td');
      if (cells.length === 0) return;

      const cellTexts: string[] = [];
      cells.each((_, td) => { cellTexts.push($(td).text().trim()); });
      const fullText = cellTexts.join(' ');
      const claveAcceso = extractClaveAcceso(fullText);
      if (!claveAcceso) return;

      const rucEmisor = colIdx.rucEmisor !== -1
        ? extractRuc(cellTexts[colIdx.rucEmisor])
        : extractRuc(claveAcceso);
      const razonSocial = colIdx.emisor !== -1
        ? cleanEmisorRazonSocial(cellTexts[colIdx.emisor])
        : null;
      const total = colIdx.total !== -1
        ? parseSriFloat(cellTexts[colIdx.total])
        : 0;
      const fechaAutorizacion = colIdx.fechaAutorizacion !== -1
        ? cellTexts[colIdx.fechaAutorizacion]
        : null;

      const allLinks = $(tr).find('a, input[type="image"]');
      let xmlUrl: string | undefined;
      let pdfUrl: string | undefined;
      allLinks.each((_, a) => {
        const href = $(a).attr('href') || $(a).attr('src') || '';
        const onclick = $(a).attr('onclick') || '';
        const title = $(a).attr('title') || '';
        const combined = (href + onclick + title).toLowerCase();
        if (combined.includes('xml') || combined.includes('comprobante')) xmlUrl = href || onclick;
        if (combined.includes('pdf') || combined.includes('ride')) pdfUrl = href || onclick;
      });

      results.push({
        claveAcceso,
        rucEmisor,
        razonSocial,
        total,
        tipo: mapHtmlTypeCode(typeCode),
        fechaAutorizacion,
        xmlUrl,
        pdfUrl,
      });
    });

    return results;
  }

  private _detectColumnHeaders($: cheerio.CheerioAPI): ColumnIndex | null {
    const headerSelectors = [
      'thead th',
      'tr.rf-dt-shdr th',
      'tr[id*="shdr"] th',
      'tr:first-child th',
    ];
    for (const sel of headerSelectors) {
      const ths = $(sel);
      if (ths.length < 3) continue;
      const texts = ths.map((_, th) => $(th).text().trim().toUpperCase()).get();
      const hasRuc = texts.some(t => t.includes('RUC'));
      const hasClave = texts.some(t => t.includes('CLAVE') || t.includes('ACCESO'));
      if (!hasRuc && !hasClave) continue;

      return {
        tipo: texts.findIndex(t => t.includes('TIPO') || t.includes('COMPROBANTE')),
        rucEmisor: texts.findIndex(t => t.includes('RUC')),
        emisor: texts.findIndex(t => t.includes('RAZON') || t.includes('RAZÓN') || t.includes('SOCIAL') || t.includes('NOMBRE')),
        clave: texts.findIndex(t => t.includes('CLAVE') || t.includes('ACCESO') || t.includes('AUTORIZA')),
        fechaAutorizacion: texts.findIndex(t => t.includes('FECHA') && (t.includes('AUTORIZA') || t.includes('HORA'))),
        total: texts.findIndex(t => t.includes('TOTAL') || t.includes('IMPORTE') || t.includes('VALOR')),
      };
    }
    return null;
  }

  async downloadFile(urlOrOnclick: string, outputPath: string): Promise<boolean> {
    try {
      let url = '';
      if (urlOrOnclick.startsWith('http://') || urlOrOnclick.startsWith('https://')) {
        url = urlOrOnclick;
      } else {
        const linkMatch = urlOrOnclick.match(/location\.href\s*=\s*['"]([^'"]+)['"]/);
        if (linkMatch) {
          url = resolveUrl(SRI_BASE, linkMatch[1]);
        } else if (urlOrOnclick.startsWith('/')) {
          url = resolveUrl(SRI_BASE, urlOrOnclick);
        } else {
          logDebug('No se pudo resolver URL de descarga:', urlOrOnclick.slice(0, 100));
          return false;
        }
      }

      const buf = await this.client.download(url);
      fs.mkdirSync(path.dirname(outputPath), { recursive: true });
      fs.writeFileSync(outputPath, buf);
      return true;
    } catch (err: any) {
      logDebug(`Error descargando: ${err.message}`);
      return false;
    }
  }

  isAuthenticated(): boolean {
    return this.authenticated;
  }

  reset(): void {
    this.authenticated = false;
    this.viewState = '';
    this.appFormAction = '';
    this.client.clearCookies();
  }
}

function mapHtmlTypeCode(code: string): string {
  const m: Record<string, string> = { '1': '01', '2': '03', '3': '04', '4': '05', '6': '07' };
  return m[code] || code;
}
