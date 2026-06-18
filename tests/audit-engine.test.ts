import { describe, it, expect, vi } from 'vitest';

describe('audit-engine', () => {
  describe('buildAuditAlerts', () => {
    it('retorna array vacío si no hay comprobantes', async () => {
      const { buildAuditAlerts } = await import('../src/lib/sri-api/audit-engine');
      const alerts = buildAuditAlerts([], '0999000000001', 365);
      expect(alerts).toHaveLength(0);
    });

    it('detecta clave duplicada', async () => {
      const { buildAuditAlerts } = await import('../src/lib/sri-api/audit-engine');
      const docs = [
        {
          clave_acceso: '0101202501099000000000110010010000000011234567812',
          emisor_ruc: '0999000000001',
          secuencial: '000000001',
          tipo: '01',
          estado: 'AUTORIZADO',
          importe_total: 100,
          subtotal_sin_impuesto: 100,
          total_sin_impuesto: 100,
          total_iva: 15,
          emisor_razon_social: 'EMISOR S.A.',
          receptor_identificacion: '0999000000002',
        },
        {
          clave_acceso: '0101202501099000000000110010010000000011234567812',
          emisor_ruc: '0999000000001',
          secuencial: '000000002',
          tipo: '01',
          estado: 'AUTORIZADO',
          importe_total: 200,
          subtotal_sin_impuesto: 200,
          total_sin_impuesto: 200,
          total_iva: 30,
          emisor_razon_social: 'EMISOR S.A.',
          receptor_identificacion: '0999000000003',
        },
      ];
      const alerts = buildAuditAlerts(docs, '0999000000001', 365);
      const titles = alerts.map(a => a.title);
      expect(titles).toContain('Clave de acceso duplicada');
    });

    it('detecta IVA inconsistente (no 15%)', async () => {
      const { buildAuditAlerts } = await import('../src/lib/sri-api/audit-engine');
      const docs = [
        {
          clave_acceso: '0101202501099000000000110010010000000011234567812',
          emisor_ruc: '0999000000001',
          secuencial: '000000001',
          tipo: '01',
          estado: 'AUTORIZADO',
          importe_total: 110,
          subtotal_sin_impuesto: 100,
          total_sin_impuesto: 100,
          total_iva: 5,
          emisor_razon_social: 'EMISOR S.A.',
          receptor_identificacion: '0999000000002',
        },
      ];
      const alerts = buildAuditAlerts(docs, '0999000000001', 365);
      const ivaAlert = alerts.find(a => a.title?.toLowerCase().includes('iva'));
      expect(ivaAlert).toBeDefined();
    });

    it('detecta comprobantes no autorizados', async () => {
      const { buildAuditAlerts } = await import('../src/lib/sri-api/audit-engine');
      const docs = [
        {
          clave_acceso: '0101202501099000000000110010010000000011234567812',
          emisor_ruc: '0999000000001',
          secuencial: '000000001',
          tipo: '01',
          estado: 'PENDIENTE',
          importe_total: 100,
          subtotal_sin_impuesto: 100,
          total_sin_impuesto: 100,
          total_iva: 15,
          emisor_razon_social: 'EMISOR S.A.',
          receptor_identificacion: '0999000000002',
        },
      ];
      const alerts = buildAuditAlerts(docs, '0999000000001', 365);
      expect(alerts.some(a => a.risk === 'Alto')).toBe(true);
    });

    it('detecta certificado próximo a vencer', async () => {
      const { buildAuditAlerts } = await import('../src/lib/sri-api/audit-engine');
      const alerts = buildAuditAlerts([], '0999000000001', 15);
      const certAlert = alerts.find(a => a.title?.toLowerCase().includes('firma'));
      expect(certAlert).toBeDefined();
    });
  });
});
