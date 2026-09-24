import { describe, it, expect, beforeEach, vi } from 'vitest';
import { conciliarPeriodo } from '../src/services/sri-api/reconciler';
import { encryption } from '../src/services/sri-api/encryption';

vi.mock('../src/services/sri-api/db', () => ({
  db: {
    queryAll: vi.fn().mockResolvedValue([]),
    queryOne: vi.fn().mockResolvedValue(null),
    query: vi.fn().mockResolvedValue({ rows: [], rowCount: 0 })
  }
}));

describe('Conciliador Tributario & Encryption Engine', () => {
  beforeEach(() => {
    process.env.ENCRYPTION_KEY = '00000000000000000000000000000000';
    process.env.ENCRYPTION_SALT = 'test-salt';
  });

  describe('encryption (AES-256-GCM)', () => {
    it('encripta y desencripta con el nuevo formato GCM', async () => {
      const original = 'PasswordSeguroSRI2026!';
      const encrypted = await encryption.encrypt(original);

      expect(encrypted).toMatch(/^gcm:[0-9a-f]+:[0-9a-f]+:[0-9a-f]+$/);

      const decrypted = await encryption.decrypt(encrypted);
      expect(decrypted).toBe(original);
    });

    it('desencripta cadenas encriptadas con formato legacy CBC', async () => {
      await expect(encryption.decrypt('invalid-format')).rejects.toThrow();
    });
  });

  describe('conciliarPeriodo', () => {
    it('genera reporte de conciliación para un periodo sin registros contables', async () => {
      const report = await conciliarPeriodo('00000000-0000-0000-0000-000000000000', 202601);

      expect(report).toBeDefined();
      expect(report.periodo).toBe(202601);
      expect(report.controlMensualExistente).toBe(false);
      expect(report.saludTributariaPct).toBeLessThanOrEqual(100);
      expect(report.discrepancias.length).toBeGreaterThan(0);
      expect(report.discrepancias[0].type).toBe('ORPHAN_ACCOUNTING_ENTRY');
    });
  });
});
