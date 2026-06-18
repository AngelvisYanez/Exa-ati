import { describe, it, expect, vi } from 'vitest';

vi.hoisted(() => {
  process.env.JWT_SECRET = 'test-secret';
  process.env.ENCRYPTION_KEY = '00000000000000000000000000000000';
  process.env.ENCRYPTION_SALT = 'test-salt';
  process.env.NEXT_PUBLIC_SRI_AMBIENTE = '1';
});

describe('API routes', () => {
  it('reenvio route exporta POST', async () => {
    const mod = await import('../src/app/api/sri/comprobantes/[claveAcceso]/reenviar/route');
    expect(typeof mod.POST).toBe('function');
  });

  it('validar-xsd route exporta POST y GET', async () => {
    const mod = await import('../src/app/api/sri/validar-xsd/route');
    expect(typeof mod.POST).toBe('function');
    expect(typeof mod.GET).toBe('function');
  });

  it('cron sri-check route exporta GET', async () => {
    const mod = await import('../src/app/api/cron/sri-check/route');
    expect(typeof mod.GET).toBe('function');
  });
});
