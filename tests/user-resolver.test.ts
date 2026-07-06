import { describe, it, expect } from 'vitest';

describe('user-resolver - isValidRuc', () => {
  it('valida RUC de 13 dígitos', async () => {
    const { isValidRuc } = await import('../src/lib/sri-api/user-resolver');
    expect(isValidRuc('0999000000001')).toBe(true);
    expect(isValidRuc('1790012344001')).toBe(true);
  });

  it('rechaza RUC con menos de 13 dígitos', async () => {
    const { isValidRuc } = await import('../src/lib/sri-api/user-resolver');
    expect(isValidRuc('12345')).toBe(false);
  });

  it('rechaza RUC con letras', async () => {
    const { isValidRuc } = await import('../src/lib/sri-api/user-resolver');
    expect(isValidRuc('0999000000a01')).toBe(false);
  });

  it('rechaza RUC vacío', async () => {
    const { isValidRuc } = await import('../src/lib/sri-api/user-resolver');
    expect(isValidRuc('')).toBe(false);
  });
});
