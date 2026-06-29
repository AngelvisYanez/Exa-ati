import * as net from 'net';

const PROBE_TIMEOUT = 10000;
const FETCH_TIMEOUT = 15000;
const TEST_TIMEOUT = 20000;
const TEST_RETRIES = 2;

const COUNTRY_MAP: Record<string, { code: string; name: string }> = {
  ec: { code: 'ec', name: 'ecuador' },
  ar: { code: 'ar', name: 'argentina' },
  mx: { code: 'mx', name: 'mexico' },
  co: { code: 'co', name: 'colombia' },
  pe: { code: 'pe', name: 'peru' },
  cl: { code: 'cl', name: 'chile' },
  br: { code: 'br', name: 'brazil' },
  us: { code: 'us', name: 'united-states' },
  ca: { code: 'ca', name: 'canada' },
  es: { code: 'es', name: 'spain' },
  de: { code: 'de', name: 'germany' },
  fr: { code: 'fr', name: 'france' },
  it: { code: 'it', name: 'italy' },
  gb: { code: 'gb', name: 'united-kingdom' },
  ve: { code: 've', name: 'venezuela' },
  bo: { code: 'bo', name: 'bolivia' },
  py: { code: 'py', name: 'paraguay' },
  uy: { code: 'uy', name: 'uruguay' },
  cr: { code: 'cr', name: 'costa-rica' },
  pa: { code: 'pa', name: 'panama' },
  gt: { code: 'gt', name: 'guatemala' },
  cu: { code: 'cu', name: 'cuba' },
  do: { code: 'do', name: 'dominican-republic' },
};

function normalizeCountry(input: string): { code: string; name: string } {
  const lower = input.toLowerCase().trim();
  if (COUNTRY_MAP[lower]) return COUNTRY_MAP[lower];

  for (const entry of Object.values(COUNTRY_MAP)) {
    if (entry.name === lower || entry.name.replace('-', ' ') === lower) {
      return entry;
    }
  }
  return COUNTRY_MAP.ec;
}

function buildSources(code: string, name: string): string[] {
  return [
    `https://onlinecybertools.com/proxies/country/${name}`,
    `https://www.proxynova.com/proxy-server-list/country-${code}/`,
    `https://proxy-tools.com/proxy/${code}`,
  ];
}

function extractIpPortPairs(html: string): { host: string; port: number }[] {
  const ipRegex = /(\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}):(\d{2,5})/g;
  const seen = new Set<string>();
  const proxies: { host: string; port: number }[] = [];

  let match;
  while ((match = ipRegex.exec(html)) !== null) {
    const key = `${match[1]}:${match[2]}`;
    const port = parseInt(match[2], 10);
    if (!seen.has(key) && port > 0 && port <= 65535) {
      seen.add(key);
      proxies.push({ host: match[1], port });
    }
  }

  return proxies;
}

export async function testProxyConnection(
  host: string,
  port: number,
): Promise<{ alive: boolean; latency: number } | null> {
  const target = { host: 'srienlinea.sri.gob.ec', port: 443 };
  for (let attempt = 0; attempt < TEST_RETRIES; attempt++) {
    const result = await _testConnect(host, port, target.host, target.port);
    if (result) return result;
  }
  return null;
}

async function testProxy(
  host: string,
  port: number,
): Promise<{ alive: boolean; latency: number } | null> {
  const testHosts = [
    { host: 'srienlinea.sri.gob.ec', port: 443 },
    { host: 'cloudflare.com', port: 443 },
    { host: 'google.com', port: 443 },
  ];

  for (let attempt = 0; attempt < TEST_RETRIES; attempt++) {
    for (const target of testHosts) {
      const result = await _testConnect(host, port, target.host, target.port);
      if (result) return result;
    }
  }
  return null;
}

function _testConnect(
  proxyHost: string,
  proxyPort: number,
  targetHost: string,
  targetPort: number,
): Promise<{ alive: boolean; latency: number } | null> {
  return new Promise((resolve) => {
    const start = Date.now();
    const socket = new net.Socket();
    let resolved = false;

    const done = (result: { alive: boolean; latency: number } | null) => {
      if (!resolved) {
        resolved = true;
        socket.destroy();
        resolve(result);
      }
    };

    socket.setTimeout(PROBE_TIMEOUT);

    socket.on('connect', () => {
      socket.write(
        `CONNECT ${targetHost}:${targetPort} HTTP/1.1\r\nHost: ${targetHost}:${targetPort}\r\n\r\n`
      );
    });

    socket.on('data', (data) => {
      const response = data.toString();
      if (
        response.startsWith('HTTP/1.1 200') ||
        response.includes('200 Connection established')
      ) {
        done({ alive: true, latency: Date.now() - start });
      } else {
        done(null);
      }
    });

    socket.on('timeout', () => done(null));
    socket.on('error', () => done(null));
    socket.on('close', () => done(null));

    socket.connect(proxyPort, proxyHost);
  });
}

export interface DiscoverResult {
  total: number;
  alive: { host: string; port: number; latency: number }[];
  newCount: number;
  dead: number;
  errors: string[];
}

export async function discoverProxies(country?: string): Promise<{
  total: number;
  alive: { host: string; port: number; latency: number }[];
  dead: number;
  errors: string[];
  country: string;
}> {
  const { code, name } = normalizeCountry(country || 'EC');
  const errors: string[] = [];
  const allProxies = new Map<string, { host: string; port: number }>();
  const sources = buildSources(code, name);

  for (const source of sources) {
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT);
      const res = await fetch(source, {
        signal: controller.signal,
        headers: {
          'User-Agent':
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/149.0.0.0 Safari/537.36',
        },
      });
      clearTimeout(timeout);

      if (res.ok) {
        const html = await res.text();
        const found = extractIpPortPairs(html);
        for (const proxy of found) {
          const key = `${proxy.host}:${proxy.port}`;
          if (!allProxies.has(key)) {
            allProxies.set(key, proxy);
          }
        }
      }
    } catch (err: any) {
      errors.push(`Error fetching ${source}: ${err.message?.substring(0, 80)}`);
    }
  }

  const proxyList = Array.from(allProxies.values());
  const total = proxyList.length;

  const results = await Promise.all(
    proxyList.map((p) =>
      testProxy(p.host, p.port).then((r) => ({ ...p, result: r }))
    )
  );

  const alive = results
    .filter((r) => r.result !== null)
    .map((r) => ({ host: r.host, port: r.port, latency: r.result!.latency }))
    .sort((a, b) => a.latency - b.latency);

  const dead = results.filter((r) => r.result === null).length;

  return { total, alive, dead, errors, country: code.toUpperCase() };
}
