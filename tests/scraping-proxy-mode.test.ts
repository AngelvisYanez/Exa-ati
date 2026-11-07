import { beforeEach, describe, expect, it, vi } from 'vitest';

const { queryOne, query } = vi.hoisted(() => ({ queryOne: vi.fn(), query: vi.fn() }));
vi.mock('../src/services/sri-api/db', () => ({ db: { queryOne, query } }));

import { getScrapingUseProxy, setScrapingUseProxy } from '../src/services/scraping/scraping-proxy-mode';

describe('modo de conexión de descargas SRI', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('mantiene el uso de proxy para empresas sin configuración', async () => {
    queryOne.mockResolvedValue(null);
    expect(await getScrapingUseProxy('empresa-a')).toBe(true);
    expect(queryOne).toHaveBeenCalledWith(expect.any(String), ['empresa-a']);
  });

  it('respeta el modo directo guardado para la empresa', async () => {
    queryOne.mockResolvedValue({ scraping_use_proxy: false });
    expect(await getScrapingUseProxy('empresa-b')).toBe(false);
  });

  it('guarda el cambio solo para la empresa seleccionada', async () => {
    queryOne.mockResolvedValue({ id: 1 });
    await setScrapingUseProxy('empresa-c', false);
    expect(query).toHaveBeenCalledWith(expect.stringContaining('UPDATE tenant_settings'), [false, 'empresa-c']);
  });
});
