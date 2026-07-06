import { describe, it, expect, vi, beforeEach } from 'vitest';

describe('sri-portal-validator - validateSriPortalCredentials', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('fetch mocked')));
  });

  it('rechaza RUC vacío', async () => {
    const { validateSriPortalCredentials } = await import('../src/lib/sri-api/sri-portal-validator');
    const result = await validateSriPortalCredentials('', 'password123');
    expect(result.valid).toBe(false);
    expect(result.message).toContain('RUC inválido');
  });

  it('rechaza RUC con formato incorrecto', async () => {
    const { validateSriPortalCredentials } = await import('../src/lib/sri-api/sri-portal-validator');
    const result = await validateSriPortalCredentials('12345', 'password123');
    expect(result.valid).toBe(false);
    expect(result.message).toContain('RUC inválido');
  });

  it('rechaza password demasiado corta', async () => {
    const { validateSriPortalCredentials } = await import('../src/lib/sri-api/sri-portal-validator');
    const result = await validateSriPortalCredentials('0999000000001', 'ab');
    expect(result.valid).toBe(false);
    expect(result.message).toContain('contraseña');
  });

  it('rechaza password vacía', async () => {
    const { validateSriPortalCredentials } = await import('../src/lib/sri-api/sri-portal-validator');
    const result = await validateSriPortalCredentials('0999000000001', '');
    expect(result.valid).toBe(false);
  });

  it('acepta credenciales con formato válido (HTTP mockeado)', async () => {
    const { validateSriPortalCredentials } = await import('../src/lib/sri-api/sri-portal-validator');
    const result = await validateSriPortalCredentials('0999000000001', 'password123');
    expect(result.valid).toBe(true);
    expect(result.skipped).toBe(true);
  });
});
