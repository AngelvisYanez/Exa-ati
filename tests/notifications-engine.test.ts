import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockDb = vi.hoisted(() => ({
  queryAll: vi.fn(),
  queryOne: vi.fn(),
  query: vi.fn(),
}));
vi.mock('../src/services/sri-api/db', () => ({
  db: mockDb,
}));
vi.mock('../src/services/sri-api/whatsapp-service', () => ({
  sendWhatsAppAlert: vi.fn().mockResolvedValue(false),
}));

describe('notifications-engine', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockDb.queryAll.mockResolvedValue([]);
    mockDb.queryOne.mockResolvedValue(null);
    mockDb.query.mockResolvedValue({ rows: [], rowCount: 0 });
  });

  it('construye notificaciones con alertas de auditoría', async () => {
    const { buildNotifications } = await import('../src/services/sri-api/notifications-engine');
    mockDb.queryAll.mockResolvedValue([]);

    const notifs = await buildNotifications('0999000000001', 't1');
    expect(Array.isArray(notifs)).toBe(true);
  });

  it('incluye notificación de IVA pendiente si hay ventas > compras', async () => {
    const { buildNotifications } = await import('../src/services/sri-api/notifications-engine');
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
    const { buildNotifications } = await import('../src/services/sri-api/notifications-engine');
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
    const { buildNotifications } = await import('../src/services/sri-api/notifications-engine');
    // 1) comprobantes del tenant (fetchTenantComprobantes)
    mockDb.queryAll.mockResolvedValueOnce([]);
    // 2) autorizados recientes (cron)
    mockDb.queryAll.mockResolvedValueOnce([
      {
        clave_acceso: '0101202501099000000000110010010000000011234567812',
        secuencial: '000000001',
        emisor_razon_social: 'EMISOR S.A.',
        updated_at: new Date().toISOString(),
      },
    ]);
    // 3) timeouts
    mockDb.queryAll.mockResolvedValueOnce([]);
    // 4) scraping jobs
    mockDb.queryAll.mockResolvedValueOnce([]);

    const notifs = await buildNotifications('0999000000001', 't1');
    const autoNotif = notifs.find(n => n.title?.includes('automáticamente'));
    expect(autoNotif).toBeDefined();
  });

  it('persiste y lista notificaciones desde BD', async () => {
    const { syncAndListNotifications } = await import('../src/services/sri-api/notifications-engine');

    mockDb.queryAll
      .mockResolvedValueOnce([]) // fetchTenantComprobantes
      .mockResolvedValueOnce([]) // autorizados recientes
      .mockResolvedValueOnce([]) // timeouts
      .mockResolvedValueOnce([]) // scraping
      .mockResolvedValueOnce([
        {
          id: 'n1',
          type: 'recordatorio',
          title: 'Comprobantes pendientes',
          body: 'Hay pendientes',
          channel: 'App',
          unread: true,
          action_label: 'Ver',
          action_href: '/documentos',
          event_at: new Date().toISOString(),
        },
      ]);

    mockDb.queryOne.mockResolvedValue(null);

    const result = await syncAndListNotifications('0999000000001', 't1', {
      notif_documentos: true,
      notif_generacion: false,
      notif_email: false,
    });

    expect(result.notifications).toHaveLength(1);
    expect(result.notifications[0].id).toBe('n1');
    expect(result.channelsActive).toBe(1);
  });

  it('marca notificaciones como leídas en BD', async () => {
    const { markNotificationsRead } = await import('../src/services/sri-api/notifications-engine');
    mockDb.query.mockResolvedValue({ rows: [], rowCount: 2 });

    const updated = await markNotificationsRead('t1', { ids: ['a', 'b'] });
    expect(updated).toBe(2);
    expect(mockDb.query).toHaveBeenCalled();
  });
});
