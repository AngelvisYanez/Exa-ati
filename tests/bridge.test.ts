import { describe, it, expect, afterEach } from 'vitest';
import { parseJobOptions, isDevMode } from '../src/services/scraping/bridge';

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
  const env = process.env as Record<string, string | undefined>;
  const originalEnv = env.NODE_ENV;
  const originalDevMode = env.NEXT_PUBLIC_DEV_MODE;

  afterEach(() => {
    env.NODE_ENV = originalEnv;
    env.NEXT_PUBLIC_DEV_MODE = originalDevMode;
  });

  it('retorna true en desarrollo', () => {
    env.NODE_ENV = 'development';
    env.NEXT_PUBLIC_DEV_MODE = undefined;
    expect(isDevMode()).toBe(true);
  });

  it('retorna true si NEXT_PUBLIC_DEV_MODE es true', () => {
    env.NODE_ENV = 'production';
    env.NEXT_PUBLIC_DEV_MODE = 'true';
    expect(isDevMode()).toBe(true);
  });

  it('retorna false en producción sin flag', () => {
    env.NODE_ENV = 'production';
    env.NEXT_PUBLIC_DEV_MODE = undefined;
    expect(isDevMode()).toBe(false);
  });
});
