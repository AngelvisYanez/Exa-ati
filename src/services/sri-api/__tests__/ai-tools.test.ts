/**
 * Tests unitarios de las herramientas accionables del Chat IA.
 *
 * Estrategia: se mockea la capa de base de datos (../db), los servicios de
 * cuentas/RAG/fiscal y el fetch global, y se verifica que cada herramienta
 * ejecute su proceso correctamente (consultas SQL correctas, payloads HTTP,
 * respuestas al usuario y manejo de errores).
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// ─────────────────────────────────────────────────────────────────────────────
// MOCKS DE MÓDULOS
// ─────────────────────────────────────────────────────────────────────────────

vi.mock('../db', () => ({
  db: {
    query: vi.fn(async () => ({ rows: [], rowCount: 0 })),
    queryOne: vi.fn(async () => null),
    queryAll: vi.fn(async () => []),
    insert: vi.fn(async () => ({ id: 'nuevo-id' })),
    update: vi.fn(async () => []),
    // El client de transacción expone el driver crudo (mysql2): query devuelve [rows, fields]
    transaction: vi.fn(async (cb: any) =>
      cb({
        query: vi.fn(async () => [[{ ultimo_secuencial: 7 }]]),
      })
    ),
  },
}));

vi.mock('../cuentas', () => ({
  marcarVencidas: vi.fn(async () => ({ cobrar: 0, pagar: 0 })),
  obtenerResumenCuentas: vi.fn(async () => ({
    porCobrar: { saldoPorCobrar: 0, saldoVencido: 0, pendientes: 0, totalCuentas: 0 },
    porPagar: { saldoPorPagar: 0, saldoVencido: 0, pendientes: 0, totalCuentas: 0 },
  })),
  listarCuentasPorCobrar: vi.fn(async () => ({ rows: [], total: 0 })),
  listarCuentasPorPagar: vi.fn(async () => ({ rows: [], total: 0 })),
  registrarPagoCobrar: vi.fn(),
  registrarPagoPagar: vi.fn(),
  resumenAging: vi.fn(async () => ({
    '0-30': { count: 0, monto: 0 },
    '31-60': { count: 0, monto: 0 },
    '61-90': { count: 0, monto: 0 },
    '90+': { count: 0, monto: 0 },
  })),
}));

vi.mock('../embeddings', () => ({
  getConfig: vi.fn(() => ({ enabled: false })),
  queryRag: vi.fn(),
}));

vi.mock('../tax-calculator', () => ({
  buildFiscalProjection: vi.fn(),
  formatFiscalProjectionHtml: vi.fn(() => ({ html: '<strong>Proyección fiscal</strong>', text: 'Proyección fiscal' })),
}));

vi.mock('../audit-engine', () => ({
  fetchTenantComprobantes: vi.fn(async () => []),
}));

// ─────────────────────────────────────────────────────────────────────────────
// IMPORTS (después de los mocks)
// ─────────────────────────────────────────────────────────────────────────────

import { db } from '../db';
import {
  AI_TOOL_NAMES,
  MUTATING_TOOLS,
  descripcionTipoComprobante,
  formatoFechaEspanol,
  handleAiTool,
  isMutatingTool,
  normalizeIsoDate,
  type AiToolContext,
} from '../ai-tools';
import {
  listarCuentasPorCobrar,
  listarCuentasPorPagar,
  marcarVencidas,
  obtenerResumenCuentas,
  registrarPagoCobrar,
  registrarPagoPagar,
  resumenAging,
} from '../cuentas';

const ctx: AiToolContext = {
  tenantId: 'tenant-1',
  userRuc: '0991234567001',
  token: 'token-test',
  baseUrl: 'http://test.local',
};

/** Devuelve (url, init) de la primera llamada al fetch mockeado, validando que exista. */
function primeraLlamadaFetch(mock: {
  mock: { calls: any[][] }
}): { url: string; init: { headers: Record<string, string>; body: string } } {
  expect(mock.mock.calls.length).toBe(1);
  const [url, init] = mock.mock.calls[0] as [string, { headers: Record<string, string>; body: string }];
  return { url, init };
}

const jsonResponse = (data: any, ok = true, status = 200) =>
  new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json' } });

/** Configura db.queryOne para responder según el SQL recibido. */
function mockQueryOneBySql(map: Array<{ match: RegExp; result: any }>) {
  vi.mocked(db.queryOne).mockImplementation(async (sql: string) => {
    for (const m of map) {
      if (m.match.test(sql)) return m.result;
    }
    return null;
  });
}

const EMISOR_ROW = {
  id: 'emisor-1',
  establecimiento: '001',
  punto_emision: '001',
  obligado_contabilidad: 'SI',
};

const CONTACTO_ROW = {
  tipo_identificacion: '04',
  identificacion: '0998765432001',
  razon_social: 'IMPORTADORA ANDINA S.A.',
  email: 'compras@andina.ec',
  direccion: 'Av. Principal 123',
};

const PRODUCTO_ROW = {
  codigo: 'P001',
  nombre: 'Cable USB 2m',
  precio_unitario: 100,
  iva_porcentaje: 15,
  stock: 50,
};

const AGING_CERO = {
  '0-30': { count: 0, monto: 0 },
  '31-60': { count: 0, monto: 0 },
  '61-90': { count: 0, monto: 0 },
  '90+': { count: 0, monto: 0 },
};

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(db.queryOne).mockResolvedValue(null);
  vi.mocked(db.queryAll).mockResolvedValue([]);
  vi.mocked(db.insert).mockResolvedValue({ id: 'nuevo-id' } as any);
  // Defaults explícitos para evitar fugas de implementaciones entre tests
  vi.mocked(resumenAging).mockResolvedValue({ ...AGING_CERO } as any);
  vi.mocked(marcarVencidas).mockResolvedValue({ cobrar: 0, pagar: 0 } as any);
  vi.mocked(registrarPagoCobrar).mockResolvedValue({ montoAplicado: 0, saldoPendiente: 0, estado: 'PAGADO' } as any);
  vi.mocked(registrarPagoPagar).mockResolvedValue({ montoAplicado: 0, saldoPendiente: 0, estado: 'PAGADO' } as any);
  vi.stubGlobal(
    'fetch',
    vi.fn(async () => jsonResponse({ success: true }))
  );
});

afterEach(() => {
  vi.unstubAllGlobals();
});

// ─────────────────────────────────────────────────────────────────────────────
// HELPERS EXPORTADOS
// ─────────────────────────────────────────────────────────────────────────────

describe('helpers exportados', () => {
  it('normalizeIsoDate acepta ISO, DD/MM/YYYY y mes YYYY-MM (expande a último día)', () => {
    expect(normalizeIsoDate('2026-08-01')).toBe('2026-08-01');
    expect(normalizeIsoDate('2026-08-01T12:00:00Z')).toBe('2026-08-01');
    expect(normalizeIsoDate('01/08/2026')).toBe('2026-08-01');
    expect(normalizeIsoDate('1/8/2026')).toBe('2026-08-01');
    expect(normalizeIsoDate('2026-02')).toBe('2026-02-28');
    expect(normalizeIsoDate('2024-02')).toBe('2024-02-29'); // bisiesto
    expect(normalizeIsoDate(null)).toBeNull();
    expect(normalizeIsoDate('')).toBeNull();
    expect(normalizeIsoDate('no-es-fecha')).toBeNull();
  });

  it('descripcionTipoComprobante traduce códigos SRI', () => {
    expect(descripcionTipoComprobante('1')).toBe('Facturas');
    expect(descripcionTipoComprobante('6')).toBe('Comprobantes de Retención');
    expect(descripcionTipoComprobante('todos')).toBe('Comprobantes');
    expect(descripcionTipoComprobante('99')).toBe('Comprobantes');
  });

  it('formatoFechaEspanol formatea en español y devuelve el original si es inválida', () => {
    expect(formatoFechaEspanol('2026-08-01')).toContain('2026');
    expect(formatoFechaEspanol('fecha-mala')).toBe('fecha-mala');
  });

  it('registra todas las herramientas y marca las mutantes', () => {
    for (const esperada of [
      'extraer_documentos_sri',
      'emitir_factura',
      'emitir_nota_credito',
      'crear_producto',
      'listar_productos',
      'crear_contacto',
      'buscar_contactos',
      'registrar_pago',
      'consultar_cuentas',
      'consultar_vencimientos',
      'consultar_estado_descarga',
      'verificar_comprobante',
      'proyeccion_fiscal',
    ]) {
      expect(AI_TOOL_NAMES).toContain(esperada);
    }
    expect(isMutatingTool('emitir_factura')).toBe(true);
    expect(isMutatingTool('emitir_nota_credito')).toBe(true);
    expect(isMutatingTool('registrar_pago')).toBe(true);
    expect(isMutatingTool('consultar_cuentas')).toBe(false);
    expect(isMutatingTool('consultar_estado_descarga')).toBe(false);
    expect(MUTATING_TOOLS).not.toContain('consultar_vencimientos');
  });

  it('dispatch de herramienta desconocida devuelve mensaje claro', async () => {
    const res = await handleAiTool('herramienta_inexistente', {}, ctx);
    expect(res.html).toContain('No conozco la herramienta');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// PRODUCTOS
// ─────────────────────────────────────────────────────────────────────────────

describe('crear_producto', () => {
  it('rechaza si faltan código, nombre o precio (sin insertar)', async () => {
    const res = await handleAiTool('crear_producto', { codigo: 'P1' }, ctx);
    expect(res.html).toContain('Faltan datos del producto');
    expect(db.insert).not.toHaveBeenCalled();
  });

  it('crea el producto con los datos correctos', async () => {
    mockQueryOneBySql([{ match: /FROM productos/i, result: null }]);

    const res = await handleAiTool(
      'crear_producto',
      { codigo: 'P002', nombre: 'Mouse inalámbrico', precio: 25.5, iva: 15, stock: 10 },
      ctx
    );

    expect(db.insert).toHaveBeenCalledTimes(1);
    const [tabla, datos] = vi.mocked(db.insert).mock.calls[0];
    expect(tabla).toBe('productos');
    expect(datos.codigo).toBe('P002');
    expect(datos.precio_unitario).toBe(25.5);
    expect(datos.stock).toBe(10);
    expect(res.html).toContain('Producto creado');
    expect(res.html).toContain('$25.50');
  });

  it('detecta duplicado por código y no inserta', async () => {
    mockQueryOneBySql([{ match: /FROM productos/i, result: { id: 'existente' } }]);

    const res = await handleAiTool('crear_producto', { codigo: 'P001', nombre: 'X', precio: 5 }, ctx);

    expect(res.html).toContain('ya existe');
    expect(db.insert).not.toHaveBeenCalled();
  });
});

describe('listar_productos', () => {
  it('lista los productos con precio y stock', async () => {
    vi.mocked(db.queryAll).mockResolvedValue([
      { codigo: 'P001', nombre: 'Cable USB', precio_unitario: 10, iva_porcentaje: 15, stock: 3 },
    ] as any);

    const res = await handleAiTool('listar_productos', {}, ctx);

    expect(db.queryAll).toHaveBeenCalledWith(expect.stringContaining('FROM productos'), ['tenant-1']);
    expect(res.html).toContain('Cable USB');
    expect(res.html).toContain('$10.00');
    expect(res.text).toContain('1 producto(s)');
  });

  it('avisa cuando no hay resultados y sugiere crear uno', async () => {
    const res = await handleAiTool('listar_productos', { termino: 'zzz' }, ctx);
    expect(res.html).toContain('No hay productos');
    expect(res.html).toContain('zzz');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// CONTACTOS
// ─────────────────────────────────────────────────────────────────────────────

describe('crear_contacto', () => {
  it('rechaza sin identificación o razón social', async () => {
    const res = await handleAiTool('crear_contacto', { identificacion: '099' }, ctx);
    expect(res.html).toContain('Faltan datos del contacto');
    expect(db.insert).not.toHaveBeenCalled();
  });

  it('crea el contacto como cliente por defecto', async () => {
    mockQueryOneBySql([{ match: /FROM contactos/i, result: null }]);

    const res = await handleAiTool(
      'crear_contacto',
      { identificacion: '0912345678', razonSocial: 'Juan Pérez', email: 'jp@mail.ec' },
      ctx
    );

    const [tabla, datos] = vi.mocked(db.insert).mock.calls[0];
    expect(tabla).toBe('contactos');
    expect(datos.identificacion).toBe('0912345678');
    expect(datos.es_cliente).toBe(true);
    expect(datos.es_proveedor).toBe(false);
    expect(res.html).toContain('Contacto creado');
  });

  it('detecta contacto duplicado', async () => {
    mockQueryOneBySql([{ match: /FROM contactos/i, result: { id: 'c1', razon_social: 'Juan Pérez' } }]);

    const res = await handleAiTool('crear_contacto', { identificacion: '0912345678', razonSocial: 'Juan Pérez' }, ctx);
    expect(res.html).toContain('ya existe');
    expect(db.insert).not.toHaveBeenCalled();
  });
});

describe('buscar_contactos', () => {
  it('busca por término con filtro de proveedor y muestra resultados', async () => {
    vi.mocked(db.queryAll).mockResolvedValue([
      {
        tipo_identificacion: '04',
        identificacion: '0998765432001',
        razon_social: 'IMPORTADORA ANDINA S.A.',
        email: 'compras@andina.ec',
        telefono: '046000000',
        es_cliente: false,
        es_proveedor: true,
      },
    ] as any);

    const res = await handleAiTool('buscar_contactos', { termino: 'andina', tipo: 'PROVEEDOR' }, ctx);

    const [sql, params] = vi.mocked(db.queryAll).mock.calls[0];
    expect(sql).toContain('es_proveedor = true');
    expect(params).toEqual(['tenant-1', '%andina%']);
    expect(res.html).toContain('IMPORTADORA ANDINA S.A.');
    expect(res.html).toContain('proveedor');
  });

  it('responde guiando al usuario cuando no encuentra nada', async () => {
    const res = await handleAiTool('buscar_contactos', { termino: 'nadie' }, ctx);
    expect(res.html).toContain('No encontré contactos');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// EMITIR FACTURA
// ─────────────────────────────────────────────────────────────────────────────

describe('emitir_factura', () => {
  function configurarFlujoFeliz() {
    mockQueryOneBySql([
      { match: /FROM emisores/i, result: EMISOR_ROW },
      { match: /FROM contactos/i, result: CONTACTO_ROW },
      { match: /FROM productos/i, result: PRODUCTO_ROW },
    ]);
  }

  it('emite la factura resolviendo cliente desde contactos e ítems desde inventario', async () => {
    configurarFlujoFeliz();
    const fetchMock = vi.fn(async () =>
      jsonResponse({
        success: true,
        claveAcceso: 'CLAVE123',
        estado: 'AUTORIZADO',
        numeroAutorizacion: 'NA-999',
      })
    );
    vi.stubGlobal('fetch', fetchMock);

    const res = await handleAiTool(
      'emitir_factura',
      {
        cliente: { identificacion: '0998765432001' }, // solo ID → completa desde contactos
        items: [{ codigo: 'P001', cantidad: 2 }], // precio/IVA desde inventario
        plazo: 15,
      },
      ctx
    );

    // Llamada HTTP correcta
    const { url, init } = primeraLlamadaFetch(fetchMock);
    expect(url).toBe('http://test.local/api/sri/emitir');
    expect(init.headers!.Authorization).toBe(`Bearer ${ctx.token}`);

    const body = JSON.parse(init.body);
    expect(body.tipo).toBe('01');
    expect(body.emisorRuc).toBe(ctx.userRuc);

    // Secuencial generado en transacción
    expect(body.datos.secuencial).toBe('000000007');
    expect(body.datos.obligadoContabilidad).toBe('SI');

    // Cliente completado desde contactos
    expect(body.datos.identificacionComprador).toBe('0998765432001');
    expect(body.datos.razonSocialComprador).toBe('IMPORTADORA ANDINA S.A.');

    // Totales: 2 × $100 = $200 + IVA 15% = $230
    expect(body.datos.totalSinImpuestos).toBe(200);
    expect(body.datos.importeTotal).toBe(230);
    expect(body.datos.totalConImpuestos[0].valor).toBe(30);
    expect(body.datos.pagos[0].formaPago).toBe('15'); // crédito
    expect(body.datos.detalles).toHaveLength(1);

    // Respuesta al usuario
    expect(res.html).toContain('¡Factura emitida!');
    expect(res.html).toContain('001-001-000000007');
    expect(res.html).toContain('$230.00');
    expect(res.html).toContain('Crédito a <strong>15</strong> días');
  });

  it('pide los datos del comprador si no puede resolverlos', async () => {
    mockQueryOneBySql([{ match: /FROM emisores/i, result: EMISOR_ROW }]);

    const res = await handleAiTool(
      'emitir_factura',
      { cliente: {}, items: [{ descripcion: 'X', precioUnitario: 5 }] },
      ctx
    );

    expect(res.html).toContain('Faltan datos del comprador');
    expect(fetch).not.toHaveBeenCalled();
  });

  it('avisa cuando un producto no está en inventario ni tiene precio', async () => {
    mockQueryOneBySql([
      { match: /FROM emisores/i, result: EMISOR_ROW },
      { match: /FROM contactos/i, result: CONTACTO_ROW },
      { match: /FROM productos/i, result: null },
    ]);

    const res = await handleAiTool(
      'emitir_factura',
      { cliente: { identificacion: '0998765432001' }, items: [{ descripcion: 'Producto fantasma' }] },
      ctx
    );

    expect(res.html).toContain('No encontré el producto');
    expect(fetch).not.toHaveBeenCalled();
  });

  it('propaga el error del endpoint de emisión con mensaje claro', async () => {
    configurarFlujoFeliz();
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => jsonResponse({ message: 'El emisor no tiene firma digital .p12 configurada.' }, false, 400))
    );

    const res = await handleAiTool(
      'emitir_factura',
      { cliente: { identificacion: '0998765432001' }, items: [{ codigo: 'P001' }] },
      ctx
    );

    expect(res.html).toContain('No se pudo emitir la factura');
    expect(res.html).toContain('firma digital');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// EMITIR NOTA DE CRÉDITO
// ─────────────────────────────────────────────────────────────────────────────

describe('emitir_nota_credito', () => {
  // Cliente e ítems completos inline: la resolución de cliente/ítems ocurre
  // ANTES de las validaciones de docModificado/motivo, así estos tests no
  // dependen del DB.
  const argsBase = {
    cliente: { tipoIdentificacion: '04', identificacion: '0998765432001', razonSocial: 'IMPORTADORA ANDINA S.A.' },
    items: [{ codigo: 'P001', descripcion: 'Cable USB 2m', cantidad: 1, precioUnitario: 100, ivaPorcentaje: 15 }],
  };

  it('exige número y fecha del documento modificado antes de llamar al endpoint', async () => {
    const res = await handleAiTool('emitir_nota_credito', { ...argsBase, motivo: 'Devolución' }, ctx);

    expect(res.html).toContain('documento a modificar');
    expect(fetch).not.toHaveBeenCalled();
  });

  it('exige el motivo de la nota de crédito', async () => {
    const res = await handleAiTool(
      'emitir_nota_credito',
      {
        ...argsBase,
        docModificado: { numero: '001-001-000000012', fecha: '10/08/2026' },
      },
      ctx
    );

    expect(res.html).toContain('motivo');
    expect(fetch).not.toHaveBeenCalled();
  });

  it('envía el DTO correcto a /api/sri/emitir/nota-credito y reporta éxito', async () => {
    const fetchMock = vi.fn(async () =>
      jsonResponse({
        success: true,
        claveAcceso: 'NC-CLAVE-1',
        estado: 'AUTORIZADO',
        numeroAutorizacion: 'NA-NC-1',
      })
    );
    vi.stubGlobal('fetch', fetchMock);

    const res = await handleAiTool(
      'emitir_nota_credito',
      {
        ...argsBase,
        docModificado: { numero: '001-001-000000012', fecha: '10/08/2026' },
        motivo: 'Devolución total',
      },
      ctx
    );

    const { url, init } = primeraLlamadaFetch(fetchMock);
    expect(url).toBe('http://test.local/api/sri/emitir/nota-credito');

    const dto = JSON.parse(init.body);
    expect(dto.emisor.ruc).toBe(ctx.userRuc);
    expect(dto.comprador.identificacion).toBe('0998765432001');
    expect(dto.comprador.razonSocial).toBe('IMPORTADORA ANDINA S.A.');
    expect(dto.docModificado).toEqual({ tipo: '01', numero: '001-001-000000012', fecha: '2026-08-10' });
    expect(dto.motivo).toBe('Devolución total');
    // Total: 1 × $100 + IVA 15%
    expect(dto.detalles).toHaveLength(1);
    expect(dto.detalles[0].precioTotalSinImpuesto).toBe(100);
    expect(dto.detalles[0].impuestos[0].valor).toBe(15);

    expect(res.html).toContain('¡Nota de crédito emitida!');
    expect(res.html).toContain('001-001-000000012');
    expect(res.html).toContain('Devolución total');
    expect(res.html).toContain('$115.00');
  });

  it('propaga errores del endpoint (ej. sin firma digital)', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => jsonResponse({ message: 'El emisor con RUC X no tiene firma digital .p12 configurada.' }, false, 400))
    );

    const res = await handleAiTool(
      'emitir_nota_credito',
      {
        ...argsBase,
        docModificado: { numero: '001-001-000000012', fecha: '2026-08-10' },
        motivo: 'Error de precio',
      },
      ctx
    );

    expect(res.html).toContain('No se pudo emitir la nota de crédito');
    expect(res.html).toContain('firma digital');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// REGISTRAR PAGO
// ─────────────────────────────────────────────────────────────────────────────

describe('registrar_pago', () => {
  it('pide el monto si no es válido', async () => {
    const res = await handleAiTool('registrar_pago', { tipoCuenta: 'COBRAR', monto: 0 }, ctx);
    expect(res.html).toContain('monto del pago');
  });

  it('localiza la cuenta por número de documento y registra el pago', async () => {
    mockQueryOneBySql([
      {
        match: /FROM cuentas_por_cobrar[\s\S]*numero_documento/i,
        result: {
          id: 'cuenta-1',
          numero_documento: '001-001-000000009',
          cliente_nombre: 'ACME CIA LTDA',
          saldo_pendiente: 50,
        },
      },
    ]);
    vi.mocked(registrarPagoCobrar).mockResolvedValue({
      montoAplicado: 50,
      saldoPendiente: 0,
      estado: 'PAGADO',
    } as any);

    const res = await handleAiTool(
      'registrar_pago',
      { tipoCuenta: 'COBRAR', monto: 50, numeroDocumento: '001-001-000000009', metodoPago: 'TRANSFERENCIA' },
      ctx
    );

    expect(registrarPagoCobrar).toHaveBeenCalledWith('tenant-1', 'cuenta-1', expect.objectContaining({ monto: 50 }));
    expect(res.html).toContain('Pago registrado');
    expect(res.html).toContain('ACME CIA LTDA');
    expect(res.html).toContain('$50.00');
    expect(res.html).toContain('PAGADO');
  });

  it('detecta cuenta ya pagada sin registrar nada', async () => {
    mockQueryOneBySql([
      {
        match: /FROM cuentas_por_cobrar[\s\S]*numero_documento/i,
        result: { id: 'cuenta-2', numero_documento: 'F-2', saldo_pendiente: 0, cliente_nombre: 'ACME' },
      },
    ]);

    const res = await handleAiTool(
      'registrar_pago',
      { tipoCuenta: 'COBRAR', monto: 10, numeroDocumento: 'F-2' },
      ctx
    );

    expect(res.html).toContain('ya está pagada');
    expect(registrarPagoCobrar).not.toHaveBeenCalled();
  });

  it('informa cuando no encuentra ninguna cuenta', async () => {
    const res = await handleAiTool(
      'registrar_pago',
      { tipoCuenta: 'PAGAR', monto: 30, identificacion: '0999999999001' },
      ctx
    );
    expect(res.html).toContain('No encontré una cuenta');
  });

  it('usa registrarPagoPagar para cuentas por pagar', async () => {
    mockQueryOneBySql([
      {
        match: /FROM cuentas_por_pagar[\s\S]*proveedor_identificacion/i,
        result: { id: 'cxp-1', numero_documento: 'COMP-1', proveedor_nombre: 'PROVEEDOR XYZ', saldo_pendiente: 80 },
      },
    ]);
    vi.mocked(registrarPagoPagar).mockResolvedValue({ montoAplicado: 30, saldoPendiente: 50, estado: 'PARCIAL' } as any);

    const res = await handleAiTool(
      'registrar_pago',
      { tipoCuenta: 'PAGAR', monto: 30, identificacion: '0999999999001' },
      ctx
    );

    expect(registrarPagoPagar).toHaveBeenCalled();
    expect(res.html).toContain('por pagar');
    expect(res.html).toContain('$50.00');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// CONSULTAR CUENTAS
// ─────────────────────────────────────────────────────────────────────────────

describe('consultar_cuentas', () => {
  function configurarResumen() {
    vi.mocked(obtenerResumenCuentas).mockResolvedValue({
      porCobrar: { saldoPorCobrar: 500, saldoVencido: 120, pendientes: 3, totalCuentas: 5 },
      porPagar: { saldoPorPagar: 300, saldoVencido: 0, pendientes: 2, totalCuentas: 4 },
    } as any);
    vi.mocked(listarCuentasPorCobrar).mockResolvedValue({
      rows: [
        { cliente_nombre: 'ACME CIA LTDA', numero_documento: 'F-1', saldo_pendiente: 120, fecha_vencimiento: '2026-07-01' },
      ],
      total: 1,
    } as any);
    vi.mocked(listarCuentasPorPagar).mockResolvedValue({ rows: [], total: 0 } as any);
  }

  it('muestra resumen de ambas cuentas con vencidas y próximas', async () => {
    configurarResumen();

    const res = await handleAiTool('consultar_cuentas', {}, ctx);

    expect(marcarVencidas).toHaveBeenCalledWith('tenant-1');
    expect(res.html).toContain('Cuentas por Cobrar');
    expect(res.html).toContain('$500.00');
    expect(res.html).toContain('ACME CIA LTDA');
    expect(res.html).toContain('Cuentas por Pagar');
    expect(listarCuentasPorCobrar).toHaveBeenCalled();
    expect(listarCuentasPorPagar).toHaveBeenCalled();
  });

  it('con tipo=COBRAR consulta solo CxC', async () => {
    configurarResumen();

    await handleAiTool('consultar_cuentas', { tipo: 'COBRAR' }, ctx);

    expect(listarCuentasPorCobrar).toHaveBeenCalled();
    expect(listarCuentasPorPagar).not.toHaveBeenCalled();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// CONSULTAR VENCIMIENTOS (aging)
// ─────────────────────────────────────────────────────────────────────────────

describe('consultar_vencimientos', () => {
  it('marca vencidas, muestra buckets de aging y lista las más antiguas', async () => {
    vi.mocked(resumenAging).mockImplementation(async (_t: string, tipo: any) =>
      tipo === 'COBRAR'
        ? {
            '0-30': { count: 1, monto: 100 },
            '31-60': { count: 0, monto: 0 },
            '61-90': { count: 1, monto: 250 },
            '90+': { count: 0, monto: 0 },
          }
        : {
            '0-30': { count: 0, monto: 0 },
            '31-60': { count: 0, monto: 0 },
            '61-90': { count: 0, monto: 0 },
            '90+': { count: 0, monto: 0 },
          }
    );
    vi.mocked(db.queryAll).mockResolvedValue([
      {
        numero_documento: 'F-9',
        nombre: 'CLIENTE ANTIGUO',
        saldo_pendiente: 250,
        fecha_vencimiento: '2026-05-01',
        tipo: 'COBRAR',
      },
    ] as any);

    const res = await handleAiTool('consultar_vencimientos', {}, ctx);

    expect(marcarVencidas).toHaveBeenCalledWith('tenant-1');
    expect(resumenAging).toHaveBeenCalledWith('tenant-1', 'COBRAR');
    expect(resumenAging).toHaveBeenCalledWith('tenant-1', 'PAGAR');
    expect(res.html).toContain('0–30 días');
    expect(res.html).toContain('$100.00');
    expect(res.html).toContain('61–90 días');
    expect(res.html).toContain('$250.00');
    expect(res.html).toContain('Vencidas');
    expect(res.html).toContain('CLIENTE ANTIGUO');
    expect(res.html).toContain('Cuentas por cobrar</a>');
  });

  it('reporta sin saldos cuando todo está en cero', async () => {
    const res = await handleAiTool('consultar_vencimientos', { tipo: 'COBRAR' }, ctx);
    expect(res.html).toContain('sin saldos pendientes');
    expect(resumenAging).toHaveBeenCalledTimes(1);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// CONSULTAR ESTADO DE DESCARGA SRI
// ─────────────────────────────────────────────────────────────────────────────

describe('consultar_estado_descarga', () => {
  it('lista las últimas descargas con estados traducidos', async () => {
    vi.mocked(db.queryAll).mockResolvedValue([
      {
        id: 12,
        status: 'PROCESSING',
        fecha_desde: '2026-08-01',
        fecha_hasta: '2026-08-31',
        tipo_comprobante: '1',
        created_at: new Date().toISOString(),
      },
      {
        id: 11,
        status: 'COMPLETED',
        fecha_desde: '2026-07-01',
        fecha_hasta: '2026-07-31',
        tipo_comprobante: '6',
        created_at: new Date().toISOString(),
      },
    ] as any);

    const res = await handleAiTool('consultar_estado_descarga', {}, ctx);

    const [sql, params] = vi.mocked(db.queryAll).mock.calls[0];
    expect(sql).toContain('FROM scraping_jobs');
    expect(sql).toContain('tenant_id = $1');
    expect(params).toEqual(['tenant-1']);
    expect(res.html).toContain('#12');
    expect(res.html).toContain('En proceso');
    expect(res.html).toContain('Completada');
    expect(res.html).toContain('Historial de descargas');
    expect(res.text).toContain('#12');
  });

  it('consulta una tarea específica con sus últimos logs', async () => {
    mockQueryOneBySql([
      {
        match: /FROM scraping_jobs WHERE id = \$1 AND tenant_id = \$2/i,
        result: {
          id: 7,
          status: 'COMPLETED',
          fecha_desde: '2026-08-01',
          fecha_hasta: '2026-08-31',
          tipo_comprobante: '1',
        },
      },
    ]);
    vi.mocked(db.queryAll).mockResolvedValue([
      { level: 'info', message: 'Descarga finalizada' },
      { level: 'info', message: 'Login SRI exitoso' },
    ] as any);

    const res = await handleAiTool('consultar_estado_descarga', { jobId: '7' }, ctx);

    expect(res.html).toContain('Descarga #7');
    expect(res.html).toContain('Completada');
    expect(res.html).toContain('Últimos pasos');
    expect(res.html).toContain('Login SRI exitoso');
  });

  it('avisa si el jobId no existe o pertenece a otro tenant', async () => {
    const res = await handleAiTool('consultar_estado_descarga', { jobId: '999' }, ctx);
    expect(res.html).toContain('No encontré la tarea de descarga #999');
  });

  it('guía al usuario cuando no hay descargas registradas', async () => {
    const res = await handleAiTool('consultar_estado_descarga', {}, ctx);
    expect(res.html).toContain('No tienes descargas');
    expect(res.html).toContain('descarga mis facturas');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// VERIFICAR COMPROBANTE EN EL SRI
// ─────────────────────────────────────────────────────────────────────────────

describe('verificar_comprobante', () => {
  const CLAVE = '0101202601099123456700110010010000000011234567816';

  it('pide la clave de acceso si no viene (sin llamar al endpoint)', async () => {
    const res = await handleAiTool('verificar_comprobante', {}, ctx);
    expect(res.html).toContain('clave de acceso');
    expect(fetch).not.toHaveBeenCalled();
  });

  it('rechaza claves que no tienen 49 dígitos', async () => {
    const res = await handleAiTool('verificar_comprobante', { claveAcceso: '12345' }, ctx);
    expect(res.html).toContain('49 dígitos');
    expect(fetch).not.toHaveBeenCalled();
  });

  it('reporta AUTORIZADO con número y fecha de autorización', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () =>
        jsonResponse({
          claveAcceso: CLAVE,
          existeEnSri: true,
          estado: 'AUTORIZADO',
          fechaAutorizacion: '2026-08-10T14:23:45-05:00',
          numeroAutorizacion: '1001202601099123456700110010010000000011234567816',
          sincronizado: true,
        })
      )
    );

    const res = await handleAiTool('verificar_comprobante', { claveAcceso: CLAVE }, ctx);

    const { url, init } = primeraLlamadaFetch(fetch as any);
    expect(url).toBe(`http://test.local/api/sri/verificar/${CLAVE}`);
    expect(init.headers.Authorization).toBe(`Bearer ${ctx.token}`);

    expect(res.html).toContain('AUTORIZADO');
    expect(res.html).toContain('2026-08-10T14:23:45');
    expect(res.html).toContain('sincronizado');
  });

  it('avisa cuando el SRI no tiene registro y el sistema local sí', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () =>
        jsonResponse({
          claveAcceso: CLAVE,
          existeEnSri: false,
          estado: 'NO EXISTE',
          estadoLocal: 'RECIBIDO',
          sincronizado: false,
        })
      )
    );

    const res = await handleAiTool('verificar_comprobante', { claveAcceso: CLAVE }, ctx);

    expect(res.html).toContain('no tiene registro');
    expect(res.html).toContain('RECIBIDO');
  });

  it('muestra los mensajes del SRI cuando NO AUTORIZADO', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () =>
        jsonResponse({
          claveAcceso: CLAVE,
          existeEnSri: true,
          estado: 'NO AUTORIZADO',
          mensajes: ['[ERROR] 43: El documento que modifica no existe'],
        })
      )
    );

    const res = await handleAiTool('verificar_comprobante', { claveAcceso: CLAVE }, ctx);

    expect(res.html).toContain('NO AUTORIZADO');
    expect(res.html).toContain('El documento que modifica no existe');
  });

  it('propaga errores del endpoint de verificación', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => jsonResponse({ message: 'Error interno del servidor' }, false, 500))
    );

    const res = await handleAiTool('verificar_comprobante', { claveAcceso: CLAVE }, ctx);
    expect(res.html).toContain('No se pudo verificar en el SRI');
    expect(res.html).toContain('Error interno del servidor');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// EMITIR RETENCIÓN
// ─────────────────────────────────────────────────────────────────────────────

describe('emitir_retencion', () => {
  const argsBase = {
    sujetoRetenido: {
      tipoIdentificacion: '04',
      identificacion: '0998765432001',
      razonSocial: 'IMPORTADORA ANDINA S.A.',
    },
    periodoFiscal: '2026-08',
    impuestos: [
      {
        baseImponible: 100,
        valorRetenido: 30,
        numDocSustento: '001-001-000000012',
        fechaEmisionDocSustento: '10/08/2026',
      },
    ],
  };

  it('pide los datos del sujeto retenido si no puede resolverlos', async () => {
    const res = await handleAiTool('emitir_retencion', { periodoFiscal: '2026-08', impuestos: argsBase.impuestos }, ctx);
    expect(res.html).toContain('sujeto retenido');
    expect(fetch).not.toHaveBeenCalled();
  });

  it('exige el período fiscal en formato YYYY-MM', async () => {
    const res = await handleAiTool(
      'emitir_retencion',
      { ...argsBase, periodoFiscal: 'agosto' },
      ctx
    );
    expect(res.html).toContain('período fiscal');
    expect(fetch).not.toHaveBeenCalled();
  });

  it('normaliza período YYYYMM a YYYY-MM y exige documento sustento completo', async () => {
    const res = await handleAiTool(
      'emitir_retencion',
      {
        ...argsBase,
        periodoFiscal: '202608',
        impuestos: [{ baseImponible: 100, valorRetenido: 30 }],
      },
      ctx
    );
    expect(res.html).toContain('#1');
    expect(fetch).not.toHaveBeenCalled();
  });

  it('envía el DTO correcto a /api/sri/emitir/retencion y reporta éxito', async () => {
    const fetchMock = vi.fn(async () =>
      jsonResponse({
        success: true,
        claveAcceso: 'RET-CLAVE-1',
        estado: 'AUTORIZADO',
        fechaAutorizacion: '2026-08-21T10:00:00-05:00',
        numeroAutorizacion: 'NA-RET-1',
      })
    );
    vi.stubGlobal('fetch', fetchMock);

    const res = await handleAiTool('emitir_retencion', argsBase, ctx);

    const { url, init } = primeraLlamadaFetch(fetchMock);
    expect(url).toBe('http://test.local/api/sri/emitir/retencion');

    const dto = JSON.parse(init.body);
    expect(dto.emisor.ruc).toBe(ctx.userRuc);
    expect(dto.sujetoRetenido.identificacion).toBe('0998765432001');
    expect(dto.periodoFiscal).toBe('2026-08');

    const imp = dto.impuestos[0];
    expect(imp.codigo).toBe('2'); // IVA por defecto
    expect(imp.codDocSustento).toBe('01'); // factura por defecto
    expect(imp.fechaEmisionDocSustento).toBe('2026-08-10'); // normalizada
    expect(imp.porcentajeRetener).toBe(30); // calculado 30/100
    expect(imp.numDocSustento).toBe('001-001-000000012');

    expect(res.html).toContain('¡Comprobante de retención emitido!');
    expect(res.html).toContain('$30.00');
    expect(res.html).toContain('2026-08');
    expect(res.html).toContain('AUTORIZADO');
  });

  it('propaga errores del endpoint (ej. sin firma digital)', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => jsonResponse({ message: 'El emisor con RUC X no tiene firma digital .p12 configurada.' }, false, 400))
    );

    const res = await handleAiTool('emitir_retencion', argsBase, ctx);
    expect(res.html).toContain('No se pudo emitir el comprobante de retención');
    expect(res.html).toContain('firma digital');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// GENERAR GUÍA DE REMISIÓN
// ─────────────────────────────────────────────────────────────────────────────

describe('generar_guia_remision', () => {
  const EMISOR_GUIA = {
    id: 'emisor-1',
    ruc: '0991234567001',
    razon_social: 'MI EMPRESA S.A.',
    obligado_contabilidad: 'SI',
    dir_matriz: 'Av. Matriz 456',
  };

  function configurarGuia() {
    mockQueryOneBySql([
      { match: /FROM emisores/i, result: EMISOR_GUIA },
      { match: /FROM productos/i, result: PRODUCTO_ROW },
      { match: /FROM contactos/i, result: CONTACTO_ROW },
    ]);
  }

  const argsBase = {
    destinatario: { identificacion: '0912345678', razonSocial: 'Juan Pérez' },
    placa: 'GSC-1234',
    transportistaRuc: '0999999999001',
    transportistaRazonSocial: 'TRANSPORTES RÁPIDOS S.A.',
    motivoTraslado: 'VENTA',
    direccionLlegada: 'Calle Destino 789',
    items: [{ codigo: 'P001', cantidad: 5 }],
  };

  it('avisa cuando el emisor no existe', async () => {
    const res = await handleAiTool('generar_guia_remision', argsBase, ctx);
    expect(res.html).toContain('No encontré el emisor');
    expect(fetch).not.toHaveBeenCalled();
  });

  it('exige placa y RUC del transportista', async () => {
    configurarGuia();
    const res = await handleAiTool(
      'generar_guia_remision',
      { ...argsBase, placa: '', transportistaRuc: '' },
      ctx
    );
    expect(res.html).toContain('datos del transporte');
    expect(fetch).not.toHaveBeenCalled();
  });

  it('resuelve la razón social del transportista desde contactos o la pide', async () => {
    // Sin razón social y sin contacto registrado → lo pide
    mockQueryOneBySql([
      { match: /FROM emisores/i, result: EMISOR_GUIA },
      { match: /FROM productos/i, result: PRODUCTO_ROW },
      { match: /FROM contactos/i, result: null },
    ]);
    const res1 = await handleAiTool(
      'generar_guia_remision',
      { ...argsBase, transportistaRazonSocial: '', transportistaRuc: '9999999999999' },
      ctx
    );
    expect(res1.html).toContain('razón social del transportista');

    // Con contacto registrado → continúa hasta el fetch
    mockQueryOneBySql([
      { match: /FROM emisores/i, result: EMISOR_GUIA },
      { match: /FROM productos/i, result: PRODUCTO_ROW },
      { match: /FROM contactos[\s\S]*identificacion = \$2/i, result: { razon_social: 'TRANSPORTES DEL NORTE' } },
    ]);
    await handleAiTool(
      'generar_guia_remision',
      { ...argsBase, transportistaRazonSocial: '', transportistaRuc: '0999999999001' },
      ctx
    );
    const [url] = (fetch as any).mock.calls[0];
    expect(url).toBe('http://test.local/api/sri/guia-remision');
  });

  it('envía el payload correcto a /api/sri/guia-remision y reporta éxito', async () => {
    configurarGuia();
    const fetchMock = vi.fn(async () =>
      jsonResponse({ success: true, claveAcceso: 'GR-CLAVE-1', numeroAutorizacion: 'NA-GR-1' })
    );
    vi.stubGlobal('fetch', fetchMock);

    const res = await handleAiTool('generar_guia_remision', argsBase, ctx);

    const { url, init } = primeraLlamadaFetch(fetchMock);
    expect(url).toBe('http://test.local/api/sri/guia-remision');

    const body = JSON.parse(init.body);
    expect(body.emisor.ruc).toBe('0991234567001');
    expect(body.emisor.razonSocial).toBe('MI EMPRESA S.A.');
    expect(body.emisor.direccionEstablecimiento).toBe('Av. Matriz 456'); // partida por defecto
    expect(body.destinatario.razonSocial).toBe('Juan Pérez');
    expect(body.transporte).toEqual({
      placa: 'GSC-1234',
      transportistaRuc: '0999999999001',
      transportistaRazonSocial: 'TRANSPORTES RÁPIDOS S.A.',
    });
    expect(body.motivoTraslado).toBe('VENTA');
    expect(body.direccionPartida).toBe('Av. Matriz 456');
    expect(body.direccionLlegada).toBe('Calle Destino 789');
    // Ítem completado desde inventario
    expect(body.detalle[0]).toEqual({ codigo: 'P001', descripcion: 'Cable USB 2m', cantidad: 5 });

    expect(res.html).toContain('¡Guía de remisión generada!');
    expect(res.html).toContain('GSC-1234');
    expect(res.html).toContain('GR-CLAVE-1');
  });

  it('propaga errores del endpoint', async () => {
    configurarGuia();
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => jsonResponse({ message: 'Error al firmar XML: certificado vencido' }, false, 500))
    );

    const res = await handleAiTool('generar_guia_remision', argsBase, ctx);
    expect(res.html).toContain('No se pudo generar la guía de remisión');
    expect(res.html).toContain('certificado vencido');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// REENVIAR COMPROBANTE AL SRI
// ─────────────────────────────────────────────────────────────────────────────

describe('reenviar_comprobante_sri', () => {
  const CLAVE = '0101202601099123456700110010010000000011234567816';

  it('exige la clave de acceso de 49 dígitos', async () => {
    const res = await handleAiTool('reenviar_comprobante_sri', { claveAcceso: '123' }, ctx);
    expect(res.html).toContain('49 dígitos');
    expect(fetch).not.toHaveBeenCalled();
  });

  it('informa polling automático cuando está EN_PROCESO (409)', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => jsonResponse({ message: 'El comprobante está en procesamiento', requierePolling: true }, false, 409))
    );

    const res = await handleAiTool('reenviar_comprobante_sri', { claveAcceso: CLAVE }, ctx);
    expect(res.html).toContain('EN PROCESO');
    expect(res.html).toContain('verificar_comprobante');
  });

  it('reporta autorización tras el reenvío', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () =>
        jsonResponse({
          success: true,
          estado: 'AUTORIZADO',
          numeroAutorizacion: 'NA-RE-1',
          fechaAutorizacion: '2026-08-21T11:00:00-05:00',
          reenviado: true,
        })
      )
    );

    const res = await handleAiTool('reenviar_comprobante_sri', { claveAcceso: CLAVE }, ctx);

    const [url] = (fetch as any).mock.calls[0];
    expect(url).toBe(`http://test.local/api/sri/comprobantes/${CLAVE}/reenviar`);
    expect(res.html).toContain('¡Comprobante AUTORIZADO por el SRI!');
  });

  it('muestra mensajes del SRI cuando sigue DEVUELTA', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () =>
        jsonResponse({
          success: false,
          estado: 'DEVUELTA',
          mensajes: [{ tipo: 'ERROR', identificador: '45', mensaje: 'Archivo no cumple estructura' }],
          error: { tipo: 'ESTRUCTURA', accion: 'Corrige el XML y vuelve a emitir', mensaje: 'Estructura inválida' },
        })
      )
    );

    const res = await handleAiTool('reenviar_comprobante_sri', { claveAcceso: CLAVE }, ctx);
    expect(res.html).toContain('Estado SRI: DEVUELTA');
    expect(res.html).toContain('Archivo no cumple estructura');
    expect(res.html).toContain('Corrige el XML y vuelve a emitir');
  });

  it('propaga errores del endpoint', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => jsonResponse({ message: 'Comprobante no encontrado' }, false, 404))
    );

    const res = await handleAiTool('reenviar_comprobante_sri', { claveAcceso: CLAVE }, ctx);
    expect(res.html).toContain('No se pudo reenviar al SRI');
    expect(res.html).toContain('Comprobante no encontrado');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// AJUSTAR INVENTARIO
// ─────────────────────────────────────────────────────────────────────────────

describe('ajustar_inventario', () => {
  function configurarProducto() {
    mockQueryOneBySql([
      {
        match: /FROM productos/i,
        result: { id: 'prod-1', codigo: 'P001', nombre: 'Cable USB 2m', stock: 50 },
      },
    ]);
  }

  it('pide producto, tipo válido y cantidad positiva', async () => {
    const r1 = await handleAiTool('ajustar_inventario', {}, ctx);
    expect(r1.html).toContain('Indícame el producto');

    const r2 = await handleAiTool('ajustar_inventario', { producto: 'P001', tipo: 'SUMAR', cantidad: 5 }, ctx);
    expect(r2.html).toContain('Tipo de movimiento inválido');

    const r3 = await handleAiTool('ajustar_inventario', { producto: 'P001', tipo: 'ENTRADA', cantidad: 0 }, ctx);
    expect(r3.html).toContain('cantidad');
  });

  it('avisa si el producto no existe', async () => {
    const res = await handleAiTool('ajustar_inventario', { producto: 'zzz', tipo: 'ENTRADA', cantidad: 5 }, ctx);
    expect(res.html).toContain('No encontré el producto');
    expect(fetch).not.toHaveBeenCalled();
  });

  it('registra una ENTRADA y muestra el stock antes → después', async () => {
    configurarProducto();
    const fetchMock = vi.fn(async () =>
      jsonResponse({ data: { stock_antes: 50, stock_despues: 60, motivo: 'Compra proveedor' } }, true, 201)
    );
    vi.stubGlobal('fetch', fetchMock);

    const res = await handleAiTool(
      'ajustar_inventario',
      { producto: 'P001', tipo: 'ENTRADA', cantidad: 10, motivo: 'Compra proveedor' },
      ctx
    );

    const { url, init } = primeraLlamadaFetch(fetchMock);
    expect(url).toBe('http://test.local/api/inventario/movimientos');

    const body = JSON.parse(init.body);
    expect(body.productoId).toBe('prod-1');
    expect(body.tipo).toBe('ENTRADA');
    expect(body.cantidad).toBe(10);
    expect(body.motivo).toBe('Compra proveedor');

    expect(res.html).toContain('Stock actualizado');
    expect(res.html).toContain('50 → <strong>60</strong>');
  });

  it('propaga el error de stock insuficiente en SALIDAS', async () => {
    configurarProducto();
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => jsonResponse({ message: 'Stock insuficiente (disponible: 50)' }, false, 400))
    );

    const res = await handleAiTool('ajustar_inventario', { producto: 'P001', tipo: 'SALIDA', cantidad: 99 }, ctx);
    expect(res.html).toContain('Stock insuficiente');
    expect(res.html).toContain('50)');
  });

  it('usa AJUSTE para fijar el stock exacto', async () => {
    configurarProducto();
    const fetchMock = vi.fn(async () =>
      jsonResponse({ data: { stock_antes: 50, stock_despues: 42, motivo: 'Conteo físico' } }, true, 201)
    );
    vi.stubGlobal('fetch', fetchMock);

    const res = await handleAiTool('ajustar_inventario', { producto: 'cable', tipo: 'AJUSTE', cantidad: 42 }, ctx);

    const [, init] = (fetch as any).mock.calls[0];
    expect(JSON.parse(init.body).tipo).toBe('AJUSTE');
    expect(res.text).toContain('42');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// RAG Y PROYECCIÓN FISCAL
// ─────────────────────────────────────────────────────────────────────────────

describe('consultar_sistema_rag', () => {
  it('redirige consultas tributarias al contexto del chat (defensa anti-RAG)', async () => {
    const res = await handleAiTool('consultar_sistema_rag', { pregunta: 'cuánto IVA debo pagar' }, ctx);
    expect(res.html).toContain('tributaria');
  });

  it('informa que el RAG no está habilitado cuando falta OLLAMA', async () => {
    const res = await handleAiTool('consultar_sistema_rag', { pregunta: '¿Qué es la cuenta 1.1.01?' }, ctx);
    expect(res.html).toContain('Búsqueda semántica no disponible');
  });

  it('pide la pregunta si viene vacía', async () => {
    const res = await handleAiTool('consultar_sistema_rag', {}, ctx);
    expect(res.html).toContain('Indica la pregunta');
  });
});

describe('proyeccion_fiscal', () => {
  it('avisa cuando no hay comprobantes históricos', async () => {
    const res = await handleAiTool('proyeccion_fiscal', { meses: 3 }, ctx);
    expect(res.html).toContain('Sin comprobantes para proyectar');
  });
});
