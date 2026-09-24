import { describe, it, expect, vi, beforeEach } from 'vitest';

process.env.ENCRYPTION_KEY = '00000000000000000000000000000000';
process.env.ENCRYPTION_SALT = 'test-salt';

import { POST } from '../src/app/api/admin/test-payload/route';
import { NextRequest } from 'next/server';

vi.mock('../src/services/sri-api/auth-helper', () => ({
  verifyAuth: vi.fn().mockResolvedValue({
    sub: 'admin-123',
    email: 'admin@exa.ec',
    rol: 'ADMIN',
    tenantId: '00000000-0000-0000-0000-000000000000'
  })
}));

vi.mock('../src/services/sri-api/db', () => ({
  db: {
    queryOne: vi.fn().mockResolvedValue({ total: 5, active: 5 }),
    queryAll: vi.fn().mockResolvedValue([]),
    query: vi.fn().mockResolvedValue({ rows: [], rowCount: 0 })
  }
}));

vi.mock('../src/services/sri-api/sri-soap-client', () => ({
  sriSoapClient: {
    testConnection: vi.fn().mockResolvedValue({
      success: true,
      recepcion: true,
      autorizacion: true,
    }),
    autorizarComprobanteRapido: vi.fn().mockResolvedValue({
      autorizaciones: {
        autorizacion: {
          estado: 'AUTORIZADO',
          numeroAutorizacion: '123',
          fechaAutorizacion: '2026-08-01',
          comprobante: '<factura>' + 'x'.repeat(80) + '</factura>',
          mensajes: { mensaje: [] },
        },
      },
    }),
  },
}));

vi.mock('../src/services/sri-api/reconciler', () => ({
  conciliarPeriodo: vi.fn().mockResolvedValue({
    periodo: 202607,
    saludTributariaPct: 100,
    totalComprobantesSri: 0,
    discrepancias: [],
  }),
}));

describe('Admin Test Payload Route (/api/admin/test-payload)', () => {
  beforeEach(() => {
    process.env.ENCRYPTION_KEY = '00000000000000000000000000000000';
    process.env.ENCRYPTION_SALT = 'test-salt';
  });

  it('ejecuta pruebas de diagnóstico integrales para todos los módulos', async () => {
    const req = new NextRequest('http://localhost:3000/api/admin/test-payload', {
      method: 'POST',
      body: JSON.stringify({ module: 'ALL' })
    });

    const res = await POST(req);
    expect(res.status).toBe(200);

    const json = await res.json();
    expect(json.success).toBe(true);
    expect(json.executedBy).toBe('admin@exa.ec');
    expect(json.results).toBeDefined();
    expect(json.results.encryption.status).toBe('PASSED');
    expect(json.results.comprobantes.status).toBe('PASSED');
    expect(json.results.reconciliacion.status).toBe('PASSED');
    expect(json.results.soapPing.status).toBe('PASSED');
  });

  it('SOAP_AUTORIZAR consulta por clave 49 sin tocar descarga masiva', async () => {
    const clave = '1234567890123456789012345678901234567890123456789';
    const req = new NextRequest('http://localhost:3000/api/admin/test-payload', {
      method: 'POST',
      body: JSON.stringify({ module: 'SOAP_AUTORIZAR', claveAcceso: clave }),
    });

    const res = await POST(req);
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.success).toBe(true);
    expect(json.results.soapAutorizar.status).toBe('PASSED');
    expect(json.results.soapAutorizar.details.claveAcceso).toBe(clave);
  });
});
