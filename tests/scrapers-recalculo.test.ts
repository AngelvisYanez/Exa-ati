import { describe, it, expect, vi, beforeEach } from 'vitest';

process.env.ENCRYPTION_KEY = '00000000000000000000000000000000';
process.env.ENCRYPTION_SALT = 'test-salt';

import { recalcularPeriodoDesdeComprobantes } from '../src/services/control-tributario/services/mensual.service';
import { POST as scrapearPOST } from '../src/app/api/control-tributario/scrapear/route';
import { NextRequest } from 'next/server';

vi.mock('../src/services/sri-api/auth-helper', () => ({
  verifyAuth: vi.fn().mockResolvedValue({
    sub: 'user-123',
    email: 'test@exa.ec',
    rol: 'ADMIN',
    tenantId: 'tenant-123'
  }),
  requireTenantId: vi.fn().mockReturnValue('tenant-123')
}));

vi.mock('../src/services/scraping/iess-scraper', () => ({
  scrapePlanillaIESS: vi.fn().mockResolvedValue([
    { cedula: '1712345678', nombre: 'Juan Pérez', sueldo: 500, diasTrabajados: 30 }
  ])
}));

const mockRunMassDownload = vi.fn().mockResolvedValue(undefined);
const mockLogin = vi.fn().mockResolvedValue(true);
const mockGetPage = vi.fn().mockReturnValue({} as any);
const mockClose = vi.fn().mockResolvedValue(undefined);
const mockInit = vi.fn().mockResolvedValue(undefined);

vi.mock('../src/services/scraping/sri-playwright-scraper', () => ({
  SriPlaywrightScraper: vi.fn().mockImplementation(function (this: any) {
    this.init = mockInit;
    this.login = mockLogin;
    this.runMassDownload = mockRunMassDownload;
    this.getPage = mockGetPage;
    this.close = mockClose;
  }),
}));

vi.mock('../src/services/scraping/sri-playwright-declaraciones', () => ({
  scrapeDeclaracionesPresentadas: vi.fn().mockResolvedValue([{ formulario: '104', periodo: '202501' }]),
}));

vi.mock('../src/services/sri-api/encryption', () => ({
  encryption: {
    decrypt: vi.fn().mockResolvedValue('clave-test'),
  },
}));

const mockDocs = [
  {
    tipo: '01',
    emisor_ruc: '1790000000001',
    total_sin_impuesto: 1000,
    total_iva: 150,
    importe_total: 1150,
    fecha_emision: new Date('2025-01-15T10:00:00Z'),
    estado: 'AUTORIZADO'
  },
  {
    tipo: '01',
    emisor_ruc: '0999999999001',
    total_sin_impuesto: 400,
    total_iva: 60,
    importe_total: 460,
    fecha_emision: new Date('2025-01-20T10:00:00Z'),
    estado: 'AUTORIZADO'
  },
  {
    tipo: '07',
    emisor_ruc: '1790000000001',
    total_sin_impuesto: 50,
    total_iva: 20,
    importe_total: 50,
    fecha_emision: new Date('2025-01-25T10:00:00Z'),
    estado: 'AUTORIZADO'
  }
];

let dbInserted: any = null;

vi.mock('../src/services/sri-api/db', () => ({
  db: {
    queryAll: vi.fn().mockImplementation((sql: string) => {
      if (sql.includes('comprobantes')) {
        return Promise.resolve(mockDocs);
      }
      return Promise.resolve([]);
    }),
    queryOne: vi.fn().mockImplementation((sql: string) => {
      if (sql.includes('clave_sri_encrypted')) {
        return Promise.resolve({ clave_sri_encrypted: 'enc' });
      }
      return Promise.resolve(null);
    }),
    query: vi.fn().mockResolvedValue({ rowCount: 0 }),
    insert: vi.fn().mockImplementation((table: string, payload: any) => {
      dbInserted = { table, payload };
      return Promise.resolve({ id: 'inserted-id', ...payload });
    }),
    update: vi.fn().mockImplementation((table: string, payload: any) => {
      dbInserted = { table, payload };
      return Promise.resolve({ id: 'updated-id', ...payload });
    })
  }
}));

describe('Pruebas de Scrapers y Recálculo en Tabla Maestra', () => {
  beforeEach(() => {
    dbInserted = null;
    mockRunMassDownload.mockClear();
    mockLogin.mockClear();
  });

  it('recalcularPeriodoDesdeComprobantes procesa comprobantes y actualiza la tabla maestra control_tributario_mensual', async () => {
    const res = await recalcularPeriodoDesdeComprobantes('tenant-123', '1790000000001', 202501);

    expect(res).toBeDefined();
    expect(dbInserted).not.toBeNull();
    expect(dbInserted.table).toBe('control_tributario_mensual');
    expect(dbInserted.payload.tenant_id).toBe('tenant-123');
    expect(dbInserted.payload.ruc).toBe('1790000000001');
    expect(dbInserted.payload.periodo).toBe(202501);
    expect(dbInserted.payload.ventas_iva).toBe(1000);
    expect(dbInserted.payload.compras_15).toBe(400);
    expect(dbInserted.payload.ret_iva_recibida).toBe(20);
  });

  it('el endpoint /api/control-tributario/scrapear usa Playwright (retenciones + declaraciones)', async () => {
    const req = new NextRequest('http://localhost:3000/api/control-tributario/scrapear', {
      method: 'POST',
      body: JSON.stringify({
        fuente: 'SRI',
        periodo: 202501,
        ruc: '1790000000001',
        usuario: '1790000000001',
        password: 'pass',
        retencionesRecibidas: true,
        retencionesEmitidas: true
      })
    });

    const response = await scrapearPOST(req);
    expect(response.status).toBe(200);

    const data = await response.json();
    expect(data.success).toBe(true);
    expect(data.results.some((r: any) => r.tipo === 'RETENCIONES')).toBe(true);
    expect(data.results.some((r: any) => r.tipo === 'DECLARACIONES')).toBe(true);
    expect(mockLogin).toHaveBeenCalled();
    expect(mockRunMassDownload).toHaveBeenCalled();
    expect(dbInserted).not.toBeNull();
    expect(dbInserted.table).toBe('control_tributario_mensual');
  });

  it('scraping IESS exige cédula/RUC y contraseña', async () => {
    const sinClave = new NextRequest('http://localhost:3000/api/control-tributario/scrapear', {
      method: 'POST',
      body: JSON.stringify({ fuente: 'IESS', periodo: 202501, ruc: '1712345678' }),
    });
    const resSinClave = await scrapearPOST(sinClave);
    expect(resSinClave.status).toBe(400);
    const bodySinClave = await resSinClave.json();
    expect(bodySinClave.message).toMatch(/contraseña/i);

    const ok = new NextRequest('http://localhost:3000/api/control-tributario/scrapear', {
      method: 'POST',
      body: JSON.stringify({
        fuente: 'IESS',
        periodo: 202501,
        ruc: '1712345678',
        password: 'clave-iess',
      }),
    });
    const resOk = await scrapearPOST(ok);
    expect(resOk.status).toBe(200);
    const bodyOk = await resOk.json();
    expect(bodyOk.success).toBe(true);
    expect(bodyOk.results?.[0]?.tipo).toBe('IESS');
    expect(bodyOk.results?.[0]?.registros).toBe(1);
  });
});
