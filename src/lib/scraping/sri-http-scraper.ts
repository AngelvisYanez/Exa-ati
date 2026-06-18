import * as cheerio from 'cheerio';
import path from 'path';
import fs from 'fs';
// @ts-ignore
import ac from '@antiadmin/anticaptchaofficial';
import { HttpClient, parseForm, resolveUrl } from './http-client';

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

function logDebug(...args: any[]): void {
  console.log('[HTTP]', ...args);
}

export class SriHttpScraper {
  private client = new HttpClient();
  private authenticated = false;
  private viewState = '';
  private appFormAction = '';
  private captchaToken = '';

  private async solveCaptchaForAction(action: string): Promise<string> {
    const apiKey = process.env.ANTICAPTCHA_KEY;
    if (!apiKey) return '';
    try {
      ac.setAPIKey(apiKey);
      ac.setSoftId(0);
      logDebug(`Resolviendo CAPTCHA con Anti-Captcha (${action})...`);
      const token = await ac.solveRecaptchaV2EnterpriseProxyless(
        `${SRI_BASE}/comprobantes-electronicos-internet/pages/consultas/recibidos/comprobantesRecibidos.jsf`,
        RECAPTCHA_SITE_KEY,
        { s: action }
      );
      if (token) {
        logDebug('Token CAPTCHA obtenido.');
        return token;
      }
    } catch (err: any) {
      logDebug(`Error Anti-Captcha: ${err.message}`);
    }
    return '';
  }

  async login(ruc: string, clave: string, updateProgress?: (msg: string) => Promise<void>): Promise<boolean> {
    const log = updateProgress || ((m: string) => { logDebug(m); return Promise.resolve(); });
    await log('Iniciando sesión HTTP en el SRI...');

    try {
      const landing = await this.client.get(`${SRI_BASE}/sri-en-linea/contribuyente/perfil`, { redirect: 'manual' });
      const loginUrl = landing.headers.get('location');
      if (!loginUrl) {
        if (landing.status === 200 && !landing.body.includes('login') && !landing.body.includes('Login')) {
          this.authenticated = true;
          await log('Sesión HTTP ya activa.');
          return true;
        }
        await log('No se recibió redirect al login. Status: ' + landing.status);
        return false;
      }

      await log('Siguiendo redirect a Keycloak...');
      const authPage = await this.client.get(loginUrl, { redirect: 'follow' });
      const $ = cheerio.load(authPage.body);

      const forms: { action: string; fields: Record<string, string> }[] = [];
      $('form').each((_, el) => {
        const id = $(el).attr('id') || '';
        const action = $(el).attr('action') || '';
        if (!action) return;
        forms.push(parseForm($, `form#${id}`));
      });

      const loginForm = forms.find(f => f.fields['username'] !== undefined && f.fields['password'] !== undefined);
      if (!loginForm) {
        await log('No se encontró formulario de login Keycloak. Contenido: ' + authPage.body.slice(0, 500));
        return false;
      }

      const actionUrl = resolveUrl(authPage.url, loginForm.action);
      const formBody = new URLSearchParams(loginForm.fields);
      formBody.set('username', ruc);
      formBody.set('password', clave);

      await log('Enviando credenciales a Keycloak...');
      const postLogin = await this.client.post(actionUrl, formBody, { redirect: 'manual' });

      if (postLogin.status === 302 || postLogin.status === 303) {
        const redirectTarget = postLogin.headers.get('location');
        if (!redirectTarget) {
          await log('Redirect sin Location header.');
          return false;
        }
        const finalFollow = await this.client.get(redirectTarget, { redirect: 'follow' });
        const bodyLower = finalFollow.body.toLowerCase();
        if (bodyLower.includes('login') || bodyLower.includes('credencial') || bodyLower.includes('error')) {
          const $2 = cheerio.load(finalFollow.body);
          const errMsg = $2('.alert-error, .alert-danger, .kc-feedback-text').text().trim();
          await log(`Error en login: ${errMsg || 'credenciales inválidas'}`);
          return false;
        }
        this.authenticated = true;
        await log('Login HTTP exitoso.');
        return true;
      }

      if (postLogin.status === 200) {
        const bodyLower = postLogin.body.toLowerCase();
        if (bodyLower.includes('login') || bodyLower.includes('credencial')) {
          const $2 = cheerio.load(postLogin.body);
          const errMsg = $2('.alert-error, .alert-danger, .kc-feedback-text, .error').text().trim();
          await log(`Credenciales rechazadas: ${errMsg || 'revísalas'}`);
          return false;
        }
      }

      this.authenticated = true;
      await log('Login HTTP exitoso (status ' + postLogin.status + ').');
      return true;
    } catch (err: any) {
      await log(`Error en login HTTP: ${err.message}`);
      return false;
    }
  }

  async ensureSession(): Promise<boolean> {
    if (!this.authenticated) return false;
    try {
      const check = await this.client.get(`${SRI_BASE}/sri-en-linea/contribuyente/perfil`, { redirect: 'manual' });
      if (check.status === 200 && !check.body.includes('login') && !check.body.includes('Login')) return true;
      if (check.status === 302) return false;
      return check.status === 200;
    } catch {
      return false;
    }
  }

  private async loadAppForm(): Promise<boolean> {
    const appUrl = `${SRI_BASE}/tuportal-internet/accederAplicacion.jspa?redireccion=57&idGrupo=55`;
    logDebug('Cargando app comprobantes...');
    const appPage = await this.client.get(appUrl, { redirect: 'follow' });
    logDebug('URL final app: ' + appPage.url);
    logDebug('Body length: ' + appPage.body.length);

    if (appPage.body.includes('login') && appPage.body.includes('Login') && appPage.body.includes('password')) {
      logDebug('Redirigido al login. Sesión expiró.');
      this.authenticated = false;
      return false;
    }

    const $ = cheerio.load(appPage.body);
    const formSelectors = ['form[id*="frmPrincipal"]', 'form[id*="form"]', 'form[id*="Form"]', 'form[enctype]', 'form'];
    let formData: { action: string; fields: Record<string, string> } | null = null;

    for (const sel of formSelectors) {
      const f = parseForm($, sel);
      if (f.fields['javax.faces.ViewState'] || f.fields['javax.faces.Token'] || Object.keys(f.fields).length > 3) {
        formData = f;
        break;
      }
    }

    if (!formData) {
      logDebug('No se encontró formulario JSF.');
      logDebug('Primeros 2000 chars:', appPage.body.slice(0, 2000));
      return false;
    }

    this.viewState = formData.fields['javax.faces.ViewState'] || formData.fields['javax.faces.Token'] || '';
    this.appFormAction = resolveUrl(appPage.url, formData.action);
    logDebug('Form action: ' + this.appFormAction);
    logDebug('ViewState: ' + this.viewState.slice(0, 50) + '...');
    return true;
  }

  async searchComprobantes(opts: SearchOptions): Promise<ComprobanteRow[]> {
    if (!this.authenticated) throw new Error('No autenticado.');

    const loaded = await this.loadAppForm();
    if (!loaded) return [];

    const typeCode = opts.typeCode || '1';
    const year = String(opts.year);
    const month = String(opts.month).padStart(2, '0');
    const day = String(opts.day).padStart(2, '0');

    logDebug(`Buscando: ${year}/${month}/${day} tipo=${typeCode}`);

    // Pre-resolver CAPTCHA si hay AntiCaptcha configurado
    this.captchaToken = await this.solveCaptchaForAction('consulta_cel_recibidos');

    const body = new URLSearchParams();
    const knownParams: Record<string, string> = {
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
    };

    if (this.captchaToken) {
      body.set('g-recaptcha-response', this.captchaToken);
    }

    for (const [k, v] of Object.entries(knownParams)) {
      body.set(k, v);
    }

    logDebug('Enviando POST búsqueda...');
    const searchRes = await this.client.post(this.appFormAction, body, {
      headers: {
        'Faces-Request': 'partial/ajax',
        'X-Requested-With': 'XMLHttpRequest',
      },
      redirect: 'follow',
    });
    logDebug('POST status: ' + searchRes.status);
    logDebug('Response length: ' + searchRes.body.length);
    logDebug('Response starts: ' + searchRes.body.slice(0, 300));

    if (searchRes.body.trim().startsWith('<?xml') || searchRes.body.trim().startsWith('<partial-response>')) {
      return this.parseJsfAjaxResponse(searchRes.body, typeCode);
    }

    return this.parseFullPageResponse(searchRes.body, typeCode);
  }

  private parseJsfAjaxResponse(xmlBody: string, typeCode: string): ComprobanteRow[] {
    logDebug('Parseando respuesta JSF AJAX...');
    const results: ComprobanteRow[] = [];

    const updateMatches = xmlBody.match(/<update\s+id="([^"]*)"[^>]*>[\s\S]*?<!\[CDATA\[([\s\S]*?)\]\]>[\s\S]*?<\/update>/g);
    if (updateMatches) {
      for (const match of updateMatches) {
        const contentMatch = match.match(/<!\[CDATA\[([\s\S]*?)\]\]>/);
        if (!contentMatch) continue;
        const html = contentMatch[1];
        const parsed = this.extractResultsFromHtml(html, typeCode);
        results.push(...parsed);
      }
    }

    if (results.length === 0) {
      const viewStateMatch = xmlBody.match(/<update\s+id="[^"]*"[^>]*>([\s\S]*?)<\/update>/);
      if (viewStateMatch) {
        const vsInner = viewStateMatch[1].trim();
        if (vsInner.length > 10 && vsInner.length < 500) {
          this.viewState = vsInner;
          logDebug('ViewState actualizado desde AJAX.');
        }
      }
    }

    logDebug(`Resultados AJAX: ${results.length}`);
    return results;
  }

  private parseFullPageResponse(htmlBody: string, typeCode: string): ComprobanteRow[] {
    logDebug('Parseando respuesta HTML completa...');
    const $ = cheerio.load(htmlBody);
    const vs = $('input[name="javax.faces.ViewState"]').val() as string;
    if (vs) {
      this.viewState = vs;
      logDebug('ViewState actualizado desde HTML.');
    }

    const hasNoResults = $('body').text().includes('No se encontraron') || $('body').text().includes('No existen');
    if (hasNoResults) {
      logDebug('Sin resultados.');
      return [];
    }

    const tableSelectors = ['table[id*="tablaCompRecibidos"]', 'table.rf-dt-bdy', 'table.ui-datatable', 'table[id*="frmPrincipal:tabla"]'];
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
      logDebug('Body snippets con "No se encontraron": ' + htmlBody.includes('No se encontraron'));
      return [];
    }

    return this.extractResultsFromHtml(tableHtml, typeCode);
  }

  private extractResultsFromHtml(html: string, typeCode: string): ComprobanteRow[] {
    const results: ComprobanteRow[] = [];
    const $ = cheerio.load(html);

    $('tr').each((_, tr) => {
      const cells = $(tr).find('td');
      if (cells.length === 0) return;

      const cellTexts: string[] = [];
      cells.each((_, td) => { cellTexts.push($(td).text().trim()); });
      const fullText = cellTexts.join(' ');

      const claveMatch = fullText.match(/\d{49}/);
      if (!claveMatch) return;

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
        claveAcceso: claveMatch[0],
        rucEmisor: null,
        razonSocial: null,
        total: 0,
        tipo: typeCode,
        fechaAutorizacion: null,
        xmlUrl,
        pdfUrl,
      });
    });

    return results;
  }

  async downloadFile(urlOrOnclick: string, outputPath: string): Promise<boolean> {
    try {
      if (urlOrOnclick.startsWith('http://') || urlOrOnclick.startsWith('https://')) {
        const buf = await this.client.download(urlOrOnclick);
        fs.mkdirSync(path.dirname(outputPath), { recursive: true });
        fs.writeFileSync(outputPath, buf);
        return true;
      }
      const linkMatch = urlOrOnclick.match(/location\.href\s*=\s*['"]([^'"]+)['"]/);
      if (linkMatch) {
        const url = resolveUrl(SRI_BASE, linkMatch[1]);
        const buf = await this.client.download(url);
        fs.mkdirSync(path.dirname(outputPath), { recursive: true });
        fs.writeFileSync(outputPath, buf);
        return true;
      }
      logDebug('No se pudo resolver URL de descarga:', urlOrOnclick.slice(0, 100));
      return false;
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
  }
}
