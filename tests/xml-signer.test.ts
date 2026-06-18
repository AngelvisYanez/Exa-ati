import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.hoisted(() => {
  process.env.JWT_SECRET = 'test-secret';
  process.env.ENCRYPTION_KEY = '00000000000000000000000000000000';
  process.env.ENCRYPTION_SALT = 'test-salt';
});

vi.mock('fs', () => ({
  existsSync: vi.fn(() => false),
  readFileSync: vi.fn(),
  readdirSync: vi.fn(() => []),
  promises: { readFile: vi.fn(), writeFile: vi.fn(), mkdir: vi.fn() },
}));

vi.mock('path', () => ({
  join: (...args: string[]) => args.join('/'),
}));

vi.mock('../src/lib/sri-api/db', () => ({
  db: {
    queryOne: vi.fn(() => Promise.resolve(null)),
  },
}));

describe('xml-signer', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('loadEmisorCertificate lanza error si no hay emisor', async () => {
    const { xmlSigner } = await import('../src/lib/sri-api/xml-signer');
    await expect(xmlSigner.loadEmisorCertificate('0999000000001')).rejects.toThrow(
      'no fue encontrado'
    );
  });

  it('signXmlForEmisor lanza error si el emisor no tiene certificado cargado', async () => {
    const { xmlSigner } = await import('../src/lib/sri-api/xml-signer');
    xmlSigner.clearEmisorCache('0999000000001');
    await expect(xmlSigner.signXmlForEmisor('<xml/>', '0999000000001')).rejects.toThrow();
  });

  it('clearAllCache no lanza error', async () => {
    const { xmlSigner } = await import('../src/lib/sri-api/xml-signer');
    expect(() => xmlSigner.clearAllCache()).not.toThrow();
  });
});
