import * as cheerio from 'cheerio';
import fs from 'fs';
import path from 'path';

export interface HttpResponse {
  status: number;
  headers: Headers;
  body: string;
  url: string;
}

export interface HttpRequestOptions {
  body?: string;
  contentType?: string;
  redirect?: 'follow' | 'manual';
  headers?: Record<string, string>;
  retry?: number;
  retryDelay?: number;
}

const MAX_REDIRECTS = 15;
const DEFAULT_TIMEOUT = 90_000;
const DEFAULT_RETRIES = 3;
const DEFAULT_RETRY_DELAY = 3_000;

function isTlsError(err: any): boolean {
  const msg = err?.message || '';
  return (
    msg.includes('ECONNRESET') ||
    msg.includes('ETIMEDOUT') ||
    msg.includes('ECONNREFUSED') ||
    msg.includes('CERT_') ||
    msg.includes('SSL') ||
    msg.includes('TLS') ||
    msg.includes('socket hang up') ||
    msg.includes('network error') ||
    msg.includes('fetch failed') ||
    msg.includes('ERR_CONNECTION') ||
    msg.includes('ERR_TIMED_OUT') ||
    msg.includes('aborted') ||
    msg.includes('Client network socket')
  );
}

export class HttpClient {
  private cookies = new Map<string, string>();
  private defaultHeaders: Record<string, string>;
  private proxyUrl?: string;
  private proxyAgent?: any;
  private cookieJarPath?: string;
  private directFallback = false;

  constructor(opts?: {
    headers?: Record<string, string>;
    proxyUrl?: string;
    cookieJarPath?: string;
  }) {
    this.defaultHeaders = {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/149.0.0.0 Safari/537.36',
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      'Accept-Language': 'es-EC,es;q=0.9,en;q=0.8',
      'Accept-Encoding': 'gzip, deflate, br',
      'Sec-Fetch-Dest': 'document',
      'Sec-Fetch-Mode': 'navigate',
      'Sec-Fetch-Site': 'none',
      'Sec-Fetch-User': '?1',
      'Upgrade-Insecure-Requests': '1',
      'Sec-Ch-Ua': '"Google Chrome";v="149", "Chromium";v="149", "Not=A?Brand";v="24"',
      'Sec-Ch-Ua-Mobile': '?0',
      'Sec-Ch-Ua-Platform': '"Windows"',
      ...opts?.headers,
    };
    this.cookieJarPath = opts?.cookieJarPath;
    this.proxyUrl = opts?.proxyUrl;

    if (opts?.proxyUrl) {
      this.initProxy(opts.proxyUrl);
    }
  }

  private initProxy(proxyUrl: string): void {
    try {
      const { HttpsProxyAgent } = require('https-proxy-agent');
      this.proxyAgent = new HttpsProxyAgent(proxyUrl, {
        rejectUnauthorized: false,
        timeout: 30000,
      });
    } catch {
      console.warn('[HttpClient] https-proxy-agent no disponible, omitiendo proxy');
      this.proxyUrl = undefined;
    }
  }

  private fetchOptions(): RequestInit {
    const opts: RequestInit = {};
    if (this.proxyAgent && !this.directFallback) {
      (opts as any).agent = this.proxyAgent;
    }
    return opts;
  }

  loadCookiesFromDisk(): boolean {
    if (!this.cookieJarPath) return false;
    try {
      if (fs.existsSync(this.cookieJarPath)) {
        const raw = fs.readFileSync(this.cookieJarPath, 'utf-8');
        const data = JSON.parse(raw);
        if (typeof data === 'object' && data !== null) {
          for (const [k, v] of Object.entries(data)) {
            this.cookies.set(k, String(v));
          }
        }
        return true;
      }
    } catch {}
    return false;
  }

  saveCookiesToDisk(): boolean {
    if (!this.cookieJarPath) return false;
    try {
      fs.mkdirSync(path.dirname(this.cookieJarPath), { recursive: true });
      fs.writeFileSync(this.cookieJarPath, JSON.stringify(Object.fromEntries(this.cookies), null, 2), 'utf-8');
      return true;
    } catch {}
    return false;
  }

  private mergeCookies(setCookie: string[] | undefined): void {
    if (!setCookie) return;
    for (const h of setCookie) {
      const eq = h.indexOf('=');
      if (eq === -1) continue;
      const semi = h.indexOf(';', eq);
      const val = semi === -1 ? h.slice(eq + 1) : h.slice(eq + 1, semi);
      this.cookies.set(h.slice(0, eq).trim(), val);
    }
  }

  private cookieHeader(): string {
    return Array.from(this.cookies.entries())
      .map(([k, v]) => `${k}=${v}`)
      .join('; ');
  }

  private async request(
    method: string, url: string, opts: HttpRequestOptions = {}
  ): Promise<HttpResponse> {
    const retries = opts.retry ?? DEFAULT_RETRIES;
    const retryDelay = opts.retryDelay ?? DEFAULT_RETRY_DELAY;

    let lastError: Error | null = null;

    for (let attempt = 0; attempt <= retries; attempt++) {
      try {
        return await this._requestOnce(method, url, opts);
      } catch (err: any) {
        lastError = err;

        if (this.proxyUrl && isTlsError(err) && !this.directFallback) {
          console.warn(`[HttpClient] Proxy error, fallback a conexión directa: ${err.message?.substring(0, 80)}`);
          this.directFallback = true;
          try {
            return await this._requestOnce(method, url, opts);
          } catch (directErr: any) {
            console.warn(`[HttpClient] Fallback directo también falló: ${directErr.message?.substring(0, 80)}`);
            this.directFallback = false;
            lastError = directErr;
          }
        }

        if (attempt < retries) {
          const delay = retryDelay * Math.pow(2, attempt);
          await new Promise(r => setTimeout(r, delay));
        }
      }
    }

    throw lastError || new Error(`Request failed for ${url}`);
  }

  private async _requestOnce(
    method: string, url: string, opts: HttpRequestOptions = {}
  ): Promise<HttpResponse> {
    let currentUrl = url.startsWith('http://') ? url.replace('http://', 'https://') : url;
    for (let redirectCount = 0; redirectCount <= MAX_REDIRECTS; redirectCount++) {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), DEFAULT_TIMEOUT);
      try {
        const reqInit: RequestInit = {
          ...this.fetchOptions(),
          method,
          headers: {
            ...this.defaultHeaders,
            'Cookie': this.cookieHeader(),
            ...opts.headers,
            ...(opts.body ? { 'Content-Type': opts.contentType || 'application/x-www-form-urlencoded' } : {}),
          },
          body: opts.body,
          redirect: 'manual',
          signal: controller.signal,
        };
        const res = await fetch(currentUrl, reqInit);
        this.mergeCookies(res.headers.getSetCookie?.() as string[] | undefined);

        const isRedirect = res.status >= 300 && res.status < 400 && res.status !== 304;
        if (isRedirect && opts.redirect !== 'manual') {
          const location = res.headers.get('location');
          if (!location || redirectCount === MAX_REDIRECTS) {
            const body = await res.text().catch(() => '');
            return { status: res.status, headers: res.headers, body, url: currentUrl };
          }
          currentUrl = resolveUrl(currentUrl, location);
          continue;
        }

        const body = await res.text().catch(() => '');
        return { status: res.status, headers: res.headers, body, url: res.url };
      } finally {
        clearTimeout(timeout);
      }
    }
    throw new Error(`Too many redirects for ${url}`);
  }

  async get(url: string, opts?: Omit<HttpRequestOptions, 'body' | 'contentType'>): Promise<HttpResponse> {
    return this.request('GET', url, opts as HttpRequestOptions);
  }

  async post(url: string, body: string | URLSearchParams, opts?: Omit<HttpRequestOptions, 'body'>): Promise<HttpResponse> {
    const bodyStr = typeof body === 'string' ? body : body.toString();
    return this.request('POST', url, {
      ...opts,
      body: bodyStr,
    });
  }

  async download(url: string): Promise<Buffer> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 60000);
    try {
      const reqInit: RequestInit = {
        ...this.fetchOptions(),
        headers: {
          ...this.defaultHeaders,
          'Cookie': this.cookieHeader(),
        },
        signal: controller.signal,
      };
      const res = await fetch(url, reqInit);
      const buf = Buffer.from(await res.arrayBuffer());
      return buf;
    } finally {
      clearTimeout(timeout);
    }
  }

  getCookie(name: string): string | undefined {
    return this.cookies.get(name);
  }

  hasCookie(name: string): boolean {
    return this.cookies.has(name);
  }

  allCookies(): Record<string, string> {
    return Object.fromEntries(this.cookies.entries());
  }

  setCookie(name: string, value: string): void {
    this.cookies.set(name, value);
  }

  clearCookies(): void {
    this.cookies.clear();
  }

  setProxy(proxyUrl: string): void {
    this.initProxy(proxyUrl);
  }
}

export function parseForm($: cheerio.CheerioAPI, formSelector: string): { action: string; fields: Record<string, string> } {
  const form = $(formSelector);
  let action = form.attr('action') || '';
  const fields: Record<string, string> = {};

  form.find('input').each((_, el) => {
    const name = $(el).attr('name');
    if (!name) return;
    const type = $(el).attr('type') || 'text';
    if (type === 'submit' || type === 'button' || type === 'checkbox' || type === 'radio') return;
    fields[name] = $(el).attr('value') || '';
  });

  form.find('select').each((_, el) => {
    const name = $(el).attr('name');
    if (!name) return;
    const val = $(el).val() as string || '';
    fields[name] = val;
  });

  form.find('textarea').each((_, el) => {
    const name = $(el).attr('name');
    if (!name) return;
    fields[name] = $(el).text() || '';
  });

  return { action, fields };
}

export function resolveUrl(base: string, relative: string): string {
  if (relative.startsWith('http://') || relative.startsWith('https://')) return relative;
  if (relative.startsWith('/')) {
    const u = new URL(base);
    return `${u.protocol}//${u.host}${relative}`;
  }
  const u = new URL(relative, base);
  return u.toString();
}
