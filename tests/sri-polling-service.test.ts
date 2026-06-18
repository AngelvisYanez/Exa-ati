import { describe, it, expect, vi, beforeEach } from 'vitest';

const { mockDb, mockAutorizar } = vi.hoisted(() => ({
  mockDb: { queryAll: vi.fn(), query: vi.fn() },
  mockAutorizar: vi.fn(),
}));

vi.mock('../src/lib/sri-api/db', () => ({
  db: mockDb,
}));

vi.mock('../src/lib/sri-api/sri-soap-client', () => ({
  sriSoapClient: {
    autorizarComprobante: (...args: any[]) => mockAutorizar(...args),
  },
}));

vi.mock('../src/lib/sri-api/sri-error-handler', () => ({
  classifySriError: vi.fn(() => null),
}));

describe('checkPendingAutorizaciones', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('retorna vacío si no hay pendientes', async () => {
    const { checkPendingAutorizaciones } = await import('../src/lib/sri-api/sri-polling-service');
    mockDb.queryAll.mockResolvedValue([]);
    const result = await checkPendingAutorizaciones(50, 24);
    expect(result.procesados).toBe(0);
    expect(result.autorizados).toBe(0);
    expect(result.resultados).toHaveLength(0);
  });

  it('marca TIMEOUT_SRI si excede maxWaitHours', async () => {
    const { checkPendingAutorizaciones } = await import('../src/lib/sri-api/sri-polling-service');
    const oldDate = new Date(Date.now() - 25 * 60 * 60 * 1000);
    mockDb.queryAll.mockResolvedValue([
      {
        id: '1', claveAcceso: '0101202501099000000000110010010000000011234567812',
        tenantId: 't1', emisorRuc: '0999000000001',
        estado: 'EN_PROCESO', createdAt: oldDate, updatedAt: oldDate,
      },
    ]);
    mockDb.query.mockResolvedValue(undefined);

    const result = await checkPendingAutorizaciones(50, 24);
    expect(result.procesados).toBe(1);
    expect(result.timeouts).toBe(1);
    expect(mockDb.query).toHaveBeenCalledWith(
      expect.stringContaining('TIMEOUT_SRI'),
      expect.any(Array)
    );
  });

  it('consulta autorización y actualiza si AUTORIZADO', async () => {
    const { checkPendingAutorizaciones } = await import('../src/lib/sri-api/sri-polling-service');
    const recent = new Date(Date.now() - 60 * 60 * 1000);
    mockDb.queryAll.mockResolvedValue([
      {
        id: '2', claveAcceso: '0101202501099000000000110010010000000011234567813',
        tenantId: 't1', emisorRuc: '0999000000001',
        estado: 'EN_PROCESO', createdAt: recent, updatedAt: recent,
      },
    ]);
    mockAutorizar.mockResolvedValue({
      autorizaciones: {
        autorizacion: {
          estado: 'AUTORIZADO',
          numeroAutorizacion: '1234567890',
          fechaAutorizacion: new Date().toISOString(),
          comprobante: '<xml>autorizado</xml>',
        },
      },
    });
    mockDb.query.mockResolvedValue(undefined);

    const result = await checkPendingAutorizaciones(50, 24);
    expect(result.procesados).toBe(1);
    expect(result.autorizados).toBe(1);
    expect(mockAutorizar).toHaveBeenCalledWith(
      '0101202501099000000000110010010000000011234567813'
    );
  });

  it('consulta autorización y actualiza si NO AUTORIZADO', async () => {
    const { checkPendingAutorizaciones } = await import('../src/lib/sri-api/sri-polling-service');
    const recent = new Date(Date.now() - 60 * 60 * 1000);
    mockDb.queryAll.mockResolvedValue([
      {
        id: '3', claveAcceso: '0101202501099000000000110010010000000011234567814',
        tenantId: 't1', emisorRuc: '0999000000001',
        estado: 'EN_PROCESO', createdAt: recent, updatedAt: recent,
      },
    ]);
    mockAutorizar.mockResolvedValue({
      autorizaciones: {
        autorizacion: {
          estado: 'NO AUTORIZADO',
          mensajes: { mensaje: { identificador: '35', mensaje: 'Documento inválido', tipo: 'ERROR' } },
        },
      },
    });
    mockDb.query.mockResolvedValue(undefined);

    const result = await checkPendingAutorizaciones(50, 24);
    expect(result.procesados).toBe(1);
    expect(result.rechazados).toBe(1);
  });

  it('maneja error en procesarUnaClave como enProceso', async () => {
    const { checkPendingAutorizaciones } = await import('../src/lib/sri-api/sri-polling-service');
    const recent = new Date(Date.now() - 60 * 60 * 1000);
    mockDb.queryAll.mockResolvedValue([
      {
        id: '5', claveAcceso: '0101202501099000000000110010010000000011234567816',
        tenantId: 't1', emisorRuc: '0999000000001',
        estado: 'EN_PROCESO', createdAt: recent, updatedAt: recent,
      },
    ]);
    mockAutorizar.mockRejectedValue(new Error('SOAP error'));

    const result = await checkPendingAutorizaciones(50, 24);
    expect(result.procesados).toBe(1);
    expect(result.enProceso).toBe(1);
  });
});
