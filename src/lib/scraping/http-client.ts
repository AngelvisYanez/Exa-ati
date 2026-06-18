import * as cheerio from 'cheerio';

export interface HttpResponse {
  status: number;
  headers: Headers;
  body: string;
  url: string;
}

export class HttpClient {
  private cookies = new Map<string, string>();
  private defaultHeaders: Record<string, string>;

  constructor(headers?: Record<string, string>) {
    this.defaultHeaders = {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/149.0.0.0 Safari/537.36',
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      'Accept-Language': 'es-EC,es;q=0.9,en;q=0.8',
      ...headers,
    };
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
    method: string, url: string, opts: {
      body?: string;
      contentType?: string;
      redirect?: 'follow' | 'manual';
      headers?: Record<string, string>;
    } = {}
  ): Promise<HttpResponse> {
    const maxRedirects = 15;
    let currentUrl = url;
    for (let redirectCount = 0; redirectCount <= maxRedirects; redirectCount++) {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 60000);
      try {
        const res = await fetch(currentUrl, {
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
        });
        this.mergeCookies(res.headers.getSetCookie?.() as string[] | undefined);

        const isRedirect = res.status >= 300 && res.status < 400 && res.status !== 304;
        if (isRedirect && opts.redirect !== 'manual') {
          const location = res.headers.get('location');
          if (!location || redirectCount === maxRedirects) {
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

  async get(url: string, opts?: { redirect?: 'follow' | 'manual'; headers?: Record<string, string> }): Promise<HttpResponse> {
    return this.request('GET', url, {
      headers: opts?.headers,
      redirect: opts?.redirect,
    });
  }

  async post(url: string, body: string | URLSearchParams, opts?: { contentType?: string; redirect?: 'follow' | 'manual'; headers?: Record<string, string> }): Promise<HttpResponse> {
    const bodyStr = typeof body === 'string' ? body : body.toString();
    return this.request('POST', url, {
      body: bodyStr,
      contentType: opts?.contentType,
      headers: opts?.headers,
      redirect: opts?.redirect,
    });
  }

  async download(url: string): Promise<Buffer> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 60000);
    try {
      const res = await fetch(url, {
        headers: {
          ...this.defaultHeaders,
          'Cookie': this.cookieHeader(),
        },
        signal: controller.signal,
      });
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
