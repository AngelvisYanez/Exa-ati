import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockDb = vi.hoisted(() => ({
  queryAll: vi.fn(),
}));
vi.mock('../src/lib/sri-api/db', () => ({
  db: mockDb,
}));

describe('notifications-engine', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('construye notificaciones con alertas de auditoría', async () => {
    const { buildNotifications } = await import('../src/lib/sri-api/notifications-engine');
    mockDb.queryAll.mockResolvedValue([]);

    const notifs = await buildNotifications('0999000000001', 't1');
    expect(Array.isArray(notifs)).toBe(true);
  });

  it('incluye notificación de IVA pendiente si hay ventas > compras', async () => {
    const { buildNotifications } = await import('../src/lib/sri-api/notifications-engine');
    mockDb.queryAll.mockResolvedValue([
      {
        clave_acceso: '01',
        tipo: '01',
        emisor_ruc: '0999000000001',
        secuencial: '001',
        estado: 'AUTORIZADO',
        importe_total: 115,
        total_sin_impuesto: 100,
        subtotal_sin_impuesto: 100,
        total_iva: 15,
        emisor_razon_social: 'EMISOR S.A.',
        receptor_identificacion: '0999000000002',
      },
    ]);

    const notifs = await buildNotifications('0999000000001', 't1');
    const ivaNotif = notifs.find(n => n.type === 'vencimiento');
    expect(ivaNotif).toBeDefined();
    expect(ivaNotif!.title).toContain('IVA');
  });

  it('incluye notificación de certificado próximo a vencer si emisor tiene cert cerca', async () => {
    const { buildNotifications } = await import('../src/lib/sri-api/notifications-engine');
    mockDb.queryAll.mockResolvedValue([]);

    const emisor = {
      certificado_valido_hasta: new Date(Date.now() + 15 * 86400000).toISOString(),
    };

    const notifs = await buildNotifications('0999000000001', 't1', emisor);
    const certNotif = notifs.find(n => n.type === 'sri' && n.title?.includes('Firma'));
    expect(certNotif).toBeDefined();
    expect(certNotif!.body).toContain('15');
  });

  it('incluye notificación de comprobante autorizado automáticamente', async () => {
    const { buildNotifications } = await import('../src/lib/sri-api/notifications-engine');
    mockDb.queryAll.mockResolvedValue([]);
    mockDb.queryAll.mockResolvedValueOnce([]);
    mockDb.queryAll.mockResolvedValueOnce([
      {
        clave_acceso: '0101202501099000000000110010010000000011234567812',
        secuencial: '000000001',
        emisor_razon_social: 'EMISOR S.A.',
        updated_at: new Date().toISOString(),
      },
    ]);
    mockDb.queryAll.mockResolvedValueOnce([]);
    mockDb.queryAll.mockResolvedValueOnce([]);

    const notifs = await buildNotifications('0999000000001', 't1');
    const autoNotif = notifs.find(n => n.title?.includes('automáticamente'));
    expect(autoNotif).toBeDefined();
  });
});
