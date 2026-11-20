import { afterEach, describe, expect, it } from 'vitest';
import { authenticateConnector, connectorTenantEnabled } from '../src/services/scraping/local-connector';

const tenant = '11111111-1111-4111-8111-111111111111';
const key = 'local-connector-test-key-1234567890abcdef';
const original = process.env.SRI_LOCAL_CONNECTOR_KEYS;

afterEach(() => {
  if (original === undefined) delete process.env.SRI_LOCAL_CONNECTOR_KEYS;
  else process.env.SRI_LOCAL_CONNECTOR_KEYS = original;
});

describe('autenticación del conector SRI', () => {
  it('solo habilita al tenant con clave suficientemente larga', () => {
    process.env.SRI_LOCAL_CONNECTOR_KEYS = `${tenant}=${key}`;
    expect(connectorTenantEnabled(tenant)).toBe(true);
    expect(connectorTenantEnabled('22222222-2222-4222-8222-222222222222')).toBe(false);
    expect(authenticateConnector(new Request('https://example.com', {
      headers: { 'x-sri-connector-key': key },
    }))).toBe(tenant);
  });

  it('rechaza claves equivocadas y configuración débil', () => {
    process.env.SRI_LOCAL_CONNECTOR_KEYS = `${tenant}=short`;
    expect(connectorTenantEnabled(tenant)).toBe(false);
    expect(authenticateConnector(new Request('https://example.com', {
      headers: { 'x-sri-connector-key': 'short' },
    }))).toBeNull();
    process.env.SRI_LOCAL_CONNECTOR_KEYS = `${tenant}=${key}`;
    expect(authenticateConnector(new Request('https://example.com', {
      headers: { 'x-sri-connector-key': `${key}x` },
    }))).toBeNull();
  });
});
