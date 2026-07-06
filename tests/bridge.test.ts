import { describe, it, expect } from 'vitest';
import { parseJobOptions, isDevMode } from '../src/lib/scraping/bridge';

describe('parseJobOptions', () => {
  it('parsea JSON string', () => {
    const result = parseJobOptions('{"connection_mode":"cdp","debug_screenshots":true}');
    expect(result.connection_mode).toBe('cdp');
    expect(result.debug_screenshots).toBe(true);
  });

  it('retorna objeto vacío para null', () => {
    expect(parseJobOptions(null)).toEqual({});
  });

  it('retorna objeto vacío para undefined', () => {
    expect(parseJobOptions(undefined)).toEqual({});
  });

  it('retorna objeto vacío para JSON inválido', () => {
    expect(parseJobOptions('not-json')).toEqual({});
  });

  it('parsea opciones con valores numéricos', () => {
    const result = parseJobOptions('{"parallel_days":3,"http_retry_count":5}');
    expect(result.parallel_days).toBe(3);
    expect(result.http_retry_count).toBe(5);
  });
});

describe('isDevMode', () => {
  const originalEnv = process.env.NODE_ENV;
  const originalDevMode = process.env.NEXT_PUBLIC_DEV_MODE;

  afterEach(() => {
    process.env.NODE_ENV = originalEnv;
    process.env.NEXT_PUBLIC_DEV_MODE = originalDevMode;
  });

  it('retorna true en desarrollo', () => {
    process.env.NODE_ENV = 'development';
    process.env.NEXT_PUBLIC_DEV_MODE = undefined;
    expect(isDevMode()).toBe(true);
  });

  it('retorna true si NEXT_PUBLIC_DEV_MODE es true', () => {
    process.env.NODE_ENV = 'production';
    process.env.NEXT_PUBLIC_DEV_MODE = 'true';
    expect(isDevMode()).toBe(true);
  });

  it('retorna false en producción sin flag', () => {
    process.env.NODE_ENV = 'production';
    process.env.NEXT_PUBLIC_DEV_MODE = undefined;
    expect(isDevMode()).toBe(false);
  });
});
