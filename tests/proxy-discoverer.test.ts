import { describe, it, expect } from 'vitest';
import { buildSources, extractIpPortPairs, testProxyConnection } from '../src/lib/scraping/proxy-discoverer';

describe('buildSources', () => {
  it('construye 3 URLs para Ecuador', () => {
    const sources = buildSources('ec', 'ecuador');
    expect(sources).toHaveLength(3);
    expect(sources[0]).toContain('ecuador');
    expect(sources[1]).toContain('country-ec');
    expect(sources[2]).toContain('ec');
  });

  it('usa código y nombre correctamente', () => {
    const sources = buildSources('mx', 'mexico');
    expect(sources[0]).toContain('mexico');
    expect(sources[1]).toContain('country-mx');
    expect(sources[2]).toContain('mx');
  });
});

describe('extractIpPortPairs', () => {
  it('extrae IP:port de HTML', () => {
    const html = '192.168.1.1:8080 10.0.0.1:3128';
    const result = extractIpPortPairs(html);
    expect(result).toHaveLength(2);
    expect(result[0]).toEqual({ host: '192.168.1.1', port: 8080 });
    expect(result[1]).toEqual({ host: '10.0.0.1', port: 3128 });
  });

  it('deduplica entradas', () => {
    const html = '192.168.1.1:8080 192.168.1.1:8080';
    const result = extractIpPortPairs(html);
    expect(result).toHaveLength(1);
  });

  it('filtra puertos inválidos (0)', () => {
    const html = '192.168.1.1:0';
    const result = extractIpPortPairs(html);
    expect(result).toHaveLength(0);
  });

  it('retorna array vacío si no hay IPs', () => {
    expect(extractIpPortPairs('no proxies here')).toHaveLength(0);
  });

  it('respeta límite de puerto 65535', () => {
    const html = '192.168.1.1:65535 10.0.0.1:99999';
    const result = extractIpPortPairs(html);
    expect(result).toHaveLength(1);
    expect(result[0].port).toBe(65535);
  });
});
