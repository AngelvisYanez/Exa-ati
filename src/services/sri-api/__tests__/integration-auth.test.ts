import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { parseIntegrationApiKeys } from '../auth-helper';

describe('parseIntegrationApiKeys', () => {
  const prev = { ...process.env };

  afterEach(() => {
    process.env = { ...prev };
  });

  beforeEach(() => {
    delete process.env.EXA_INTEGRATION_API_KEYS;
    delete process.env.EXA_INTEGRATION_API_KEY;
    delete process.env.EXA_INTEGRATION_TENANT_ID;
  });

  it('parsea pares key=tenant', () => {
    process.env.EXA_INTEGRATION_API_KEYS = 'sk_a=tenant-1;sk_b=tenant-2';
    const keys = parseIntegrationApiKeys();
    expect(keys).toHaveLength(2);
    expect(keys[0]).toMatchObject({ key: 'sk_a', tenantId: 'tenant-1' });
  });

  it('usa clave única + tenant', () => {
    process.env.EXA_INTEGRATION_API_KEY = 'sk_only';
    process.env.EXA_INTEGRATION_TENANT_ID = 'tenant-x';
    const keys = parseIntegrationApiKeys();
    expect(keys).toEqual([{ key: 'sk_only', tenantId: 'tenant-x', rol: 'ADMIN' }]);
  });

  it('parsea JSON', () => {
    process.env.EXA_INTEGRATION_API_KEYS = JSON.stringify([
      { key: 'sk_json', tenantId: 't1', rol: 'ADMIN' },
    ]);
    expect(parseIntegrationApiKeys()[0].key).toBe('sk_json');
  });
});
