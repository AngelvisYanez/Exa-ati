import { describe, it, expect } from 'vitest';
import { formatProxyUrl } from '../src/lib/scraping/proxy-assigner';
import type { ProxyRecord } from '../src/lib/scraping/proxy-assigner';

describe('formatProxyUrl', () => {
  it('construye URL sin autenticación', () => {
    const proxy: ProxyRecord = {
      id: 1,
      proxy_host: '1.2.3.4',
      proxy_port: 8080,
      proxy_user: null,
      proxy_pass: null,
      pais: 'EC',
      activo: true,
      en_uso: false,
      asignado_a: null,
      ultimo_uso: null,
    };
    expect(formatProxyUrl(proxy)).toBe('http://1.2.3.4:8080');
  });

  it('construye URL con autenticación', () => {
    const proxy: ProxyRecord = {
      id: 2,
      proxy_host: '1.2.3.4',
      proxy_port: 3128,
      proxy_user: 'user',
      proxy_pass: 'pass',
      pais: 'EC',
      activo: true,
      en_uso: false,
      asignado_a: null,
      ultimo_uso: null,
    };
    expect(formatProxyUrl(proxy)).toBe('http://user:pass@1.2.3.4:3128');
  });

  it('construye URL con proxy_user vacío (cadena vacía no es auth)', () => {
    const proxy: ProxyRecord = {
      id: 3,
      proxy_host: '10.0.0.1',
      proxy_port: 8888,
      proxy_user: '',
      proxy_pass: '',
      pais: 'EC',
      activo: true,
      en_uso: false,
      asignado_a: null,
      ultimo_uso: null,
    };
    expect(formatProxyUrl(proxy)).toBe('http://10.0.0.1:8888');
  });
});
