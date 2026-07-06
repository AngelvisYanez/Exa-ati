import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

vi.hoisted(() => {
  process.env.JWT_SECRET = 'test-secret';
  process.env.ENCRYPTION_KEY = '00000000000000000000000000000000';
  process.env.ENCRYPTION_SALT = 'test-salt';
});

const mockDb = vi.hoisted(() => {
  const queryAll = vi.fn();
  const queryOne = vi.fn();
  const query = vi.fn();
  const insert = vi.fn();
  const update = vi.fn();
  const transaction = vi.fn();
  return { queryAll, queryOne, query, insert, update, transaction };
});

vi.mock('../src/lib/sri-api/db', () => ({
  db: mockDb,
}));

const mockXmlBuilder = vi.hoisted(() => ({
  buildGuiaRemision: vi.fn(),
  buildFactura: vi.fn(),
  parseXml: vi.fn(),
}));

vi.mock('../src/lib/sri-api/xml-builder', () => ({
  xmlBuilder: mockXmlBuilder,
}));

vi.mock('../src/lib/sri-api/xml-signer', () => ({
  xmlSigner: { signXmlForEmisor: vi.fn(() => Promise.resolve('<xml>firmado</xml>')) },
}));

vi.mock('../src/lib/sri-api/xml-storage', () => ({
  xmlStorage: {
    saveXml: vi.fn(),
    saveAllXmls: vi.fn(),
    getFullPath: vi.fn(),
  },
}));

vi.mock('../src/lib/sri-api/sri-soap-client', () => ({
  sriSoapClient: {
    enviarYAutorizar: vi.fn(() => Promise.resolve({ success: true, estado: 'AUTORIZADO', numeroAutorizacion: '1234567890', xmlAutorizado: '<xml>ok</xml>' })),
    autorizarComprobante: vi.fn(),
  },
}));

vi.mock('../src/lib/sri-api/clave-acceso', () => ({
  claveAccesoService: {
    generate: vi.fn(() => '0101202501099000000000110010010000000011234567812'),
    validate: vi.fn(() => true),
  },
  Ambiente: { PRUEBAS: '1', PRODUCCION: '2' },
  TipoEmision: { NORMAL: '1' },
}));

// Valid cédula: 1710034065 (Pichincha, check digit verified)
// Valid RUC PN: 1710034065001
// Valid RUC Sociedad: 1790012345001 (check: 1*4+7*3+9*2+0*7+0*6+0*5+1*4+2*3+3*2 = 4+21+18+0+0+0+4+6+6=59, 59%11=4, 11-4=7, 10th digit 4? No, 1790012345001 has 10th digit 5 which is wrong)
// Let me compute: 1790012345001
// digits: [1,7,9,0,0,1,2,3,4,5,0,0,1]
// Third digit (idx 2) = 9 → sociedad
// Coefficients [4,3,2,7,6,5,4,3,2]
// 1*4 + 7*3 + 9*2 + 0*7 + 0*6 + 1*5 + 2*4 + 3*3 + 4*2
// = 4 + 21 + 18 + 0 + 0 + 5 + 8 + 9 + 8 = 73
// 73 % 11 = 7, 11 - 7 = 4
// digit[9] = 5 ≠ 4 → INVALID
// Need a valid RUC Sociedad.

// Let me just use values the validator accepts.
// For cédula: province 01-24, third digit <= 6
// Using cédula 1712345678 - let me verify:
// [1,7,1,2,3,4,5,6,7,8]
// [2,1,2,1,2,1,2,1,2]
// 1*2=2, 7*1=7, 1*2=2, 2*1=2, 3*2=6, 4*1=4, 5*2=10→1, 6*1=6, 7*2=14→5
// Sum = 2+7+2+2+6+4+1+6+5 = 35
// 35%10 = 5, 10-5 = 5
// Last digit is 8, not 5 → INVALID

// Using 1710034065:
// [1,7,1,0,0,3,4,0,6,5]
// 1*2=2, 7*1=7, 1*2=2, 0*1=0, 0*2=0, 3*1=3, 4*2=8, 0*1=0, 6*2=12→3
// Sum = 2+7+2+0+0+3+8+0+3 = 25
// 25%10 = 5, 10-5 = 5
// Last digit (idx 9) = 5 → VALID ✓
// So cédula 1710034065 is valid.
// RUC PN = 1710034065001

// For RUC Sociedad (third digit = 9):
// 1790012346?001
// Using 1790012346001:
// [1,7,9,0,0,1,2,3,4,6,0,0,1]
// Coefficients [4,3,2,7,6,5,4,3,2]
// 1*4=4, 7*3=21, 9*2=18, 0*7=0, 0*6=0, 1*5=5, 2*4=8, 3*3=9, 4*2=8
// Sum = 4+21+18+0+0+5+8+9+8 = 73
// 73%11 = 7, 11-7 = 4
// digit[9] = 6 ≠ 4 → INVALID

// 1790012344001:
// 1*4=4, 7*3=21, 9*2=18, 0*7=0, 0*6=0, 1*5=5, 2*4=8, 3*3=9, 4*2=8
// Sum = 73, same. digit[9]=4 → VALID ✓
// So RUC sociedad 1790012344001 is valid.

// For RUC Extranjero (third digit = 8):
// 0890... Coefficients [3,2,7,6,5,4,3,2] for first 8 digits
// 0890000000001:
// [0,8,9,0,0,0,0,0,0,0,0,0,1]
// 0*3=0, 8*2=16, 9*7=63, 0*6=0, 0*5=0, 0*4=0, 0*3=0, 0*2=0
// Sum = 79, 79%11=2, 11-2=9
// digit[8]=0 ≠ 9 → INVALID

// Need to find one. Let me try 0890123456001:
// [0,8,9,0,1,2,3,4,5,6,0,0,1]
// 0*3=0, 8*2=16, 9*7=63, 0*6=0, 1*5=5, 2*4=8, 3*3=9, 4*2=8
// Sum = 0+16+63+0+5+8+9+8 = 109
// 109%11 = 10, 11-10 = 1
// digit[8]=5 ≠ 1 → INVALID

// Let me try 0890000000001 with digit[8] = 9:
// 0890000009001:
// [0,8,9,0,0,0,0,0,0,9,0,0,1]
// Same sum 79, 79%11=2, 11-2=9, digit[8]=0... wait.
// Let me recalculate  0890000009001:
// First 8: [0,8,9,0,0,0,0,0]
// 0*3=0, 8*2=16, 9*7=63, 0*6=0, 0*5=0, 0*4=0, 0*3=0, 0*2=0
// Sum = 79, 79%11=2, 11-2=9
// digit[8]=0 → no wait, digits are:
// [0,8,9,0,0,0,0,0,0,9,0,0,1] 
// digit[8]=0, and sum check is based on first 8 digits (indices 0-7).
// check = 11 - (79 % 11) = 11 - 2 = 9
// So digit[8] should be 9, not 0. So 0890000009001:
// digits [0,8,9,0,0,0,0,0,9,9,0,0,1]
// digit[8]=9 = check ✓. But does it have '001' suffix? Yes.
// Wait, let me re-check. The RUC extranjero has 13 digits.
// 0890000009001:
// [0][8][9][0][0][0][0][0][9][0][0][0][1] NO, I wrote 9 at pos 8 but also need ends with 001.
// 0890000009001:
// pos 0: 0
// pos 1: 8
// pos 2: 9 (third digit = 8→extranjero)
// pos 3: 0
// pos 4: 0
// pos 5: 0
// pos 6: 0
// pos 7: 0
// pos 8: 9 (check digit from first 8: 79%11=2, 11-2=9 ✓)
// pos 9: 0
// pos 10: 0
// pos 11: 0
// pos 12: 1
// Last 3: 001 ✓
// So 0890000009001 should be valid.

// But actually I don't need actual valid RUCs for the tests, I just need the validator to accept them.
// Let me make sure the test inputs pass the actual validation function.

const CEDULA_VALIDA = '1710034065';        // verified valid
const RUC_PN_VALIDO = '1710034065001';     // cédula + 001
const RUC_SOCIEDAD_VALIDO = '1790012344001'; // verified valid sociedad RUC


describe('Módulo 1: Plan de Cuentas', () => {
  const TENANT = 'tenant-1';
  const MOCK_CUENTA = { id: 1, tenant_id: TENANT, codigo: '1.01.01', nombre: 'Caja', nivel: 3, tipo: 'ACTIVO', es_auxiliar: false, permite_movimiento: true, cuenta_padre_id: null, activo: true };
  const MOCK_CUENTAS = [
    { id: 1, tenant_id: TENANT, codigo: '1', nombre: 'Activo', nivel: 1, tipo: 'ACTIVO', es_auxiliar: false, permite_movimiento: false, cuenta_padre_id: null, activo: true },
    { id: 2, tenant_id: TENANT, codigo: '1.01', nombre: 'Activo Corriente', nivel: 2, tipo: 'ACTIVO', es_auxiliar: false, permite_movimiento: false, cuenta_padre_id: 1, activo: true },
    { id: 3, tenant_id: TENANT, codigo: '1.01.01', nombre: 'Caja', nivel: 3, tipo: 'ACTIVO', es_auxiliar: false, permite_movimiento: true, cuenta_padre_id: 2, activo: true },
  ];

  beforeEach(() => { vi.clearAllMocks(); });

  it('getAll filtra por tenant', async () => {
    mockDb.queryAll.mockResolvedValue(MOCK_CUENTAS);
    const { getAll } = await import('../src/lib/sri-api/plan-cuentas');
    const result = await getAll(TENANT);
    expect(result).toHaveLength(3);
    expect(mockDb.queryAll).toHaveBeenCalledWith(
      expect.stringContaining('WHERE tenant_id = $1'),
      [TENANT]
    );
  });

  it('getAll filtra por tipo y activo', async () => {
    mockDb.queryAll.mockResolvedValue([MOCK_CUENTAS[0]]);
    const { getAll } = await import('../src/lib/sri-api/plan-cuentas');
    await getAll(TENANT, { tipo: 'ACTIVO', activo: true });
    expect(mockDb.queryAll).toHaveBeenCalledWith(
      expect.stringContaining("tipo = $2 AND activo = $3"),
      [TENANT, 'ACTIVO', true]
    );
  });

  it('getById lanza error si no existe', async () => {
    mockDb.queryOne.mockResolvedValue(null);
    const { getById } = await import('../src/lib/sri-api/plan-cuentas');
    await expect(getById(999)).rejects.toThrow('no encontrado');
  });

  it('getById retorna cuenta', async () => {
    mockDb.queryOne.mockResolvedValue(MOCK_CUENTA);
    const { getById } = await import('../src/lib/sri-api/plan-cuentas');
    const result = await getById(1);
    expect(result.codigo).toBe('1.01.01');
  });

  it('create rechaza código duplicado', async () => {
    mockDb.queryOne.mockResolvedValue({ id: 99 });
    const { create } = await import('../src/lib/sri-api/plan-cuentas');
    await expect(create({ tenantId: TENANT, codigo: '1.01.01', nombre: 'Test', nivel: 1, tipo: 'ACTIVO' }))
      .rejects.toThrow('Ya existe una cuenta con el código 1.01.01');
  });

  it('create valida nivel 1 sin padre', async () => {
    mockDb.queryOne.mockResolvedValue(null);
    const { create } = await import('../src/lib/sri-api/plan-cuentas');
    await create({ tenantId: TENANT, codigo: '1', nombre: 'Activo', nivel: 1, tipo: 'ACTIVO' });
    expect(mockDb.insert).toHaveBeenCalledWith('plan_cuentas', expect.objectContaining({ codigo: '1', nivel: 1 }));
  });

  it('create rechaza nivel >1 sin padre', async () => {
    mockDb.queryOne.mockResolvedValue(null);
    const { create } = await import('../src/lib/sri-api/plan-cuentas');
    await expect(create({ tenantId: TENANT, codigo: '1.01', nombre: 'Sub', nivel: 2, tipo: 'ACTIVO' }))
      .rejects.toThrow('Una cuenta sin padre debe tener nivel 1');
  });

  it('create valida nivel de cuenta padre', async () => {
    mockDb.queryOne.mockResolvedValueOnce(null).mockResolvedValueOnce({ id: 1, nivel: 1 });
    const { create } = await import('../src/lib/sri-api/plan-cuentas');
    await expect(create({ tenantId: TENANT, codigo: '1.01', nombre: 'Sub', nivel: 3, tipo: 'ACTIVO', cuentaPadreId: 1 }))
      .rejects.toThrow('El nivel debe ser 2');
  });

  it('remove desactiva cuenta', async () => {
    mockDb.queryOne.mockResolvedValue(MOCK_CUENTA);
    const { remove } = await import('../src/lib/sri-api/plan-cuentas');
    await remove(1);
    expect(mockDb.update).toHaveBeenCalledWith('plan_cuentas', { activo: false }, 'id = $1', [1]);
  });

  it('update lanza error si cuenta no existe', async () => {
    mockDb.queryOne.mockResolvedValue(null);
    const { update, remove } = await import('../src/lib/sri-api/plan-cuentas');
    await expect(update(999, { nombre: 'Test' })).rejects.toThrow('no encontrado');
    await expect(remove(999)).rejects.toThrow('no encontrado');
  });

  it('getArbol construye jerarquía', async () => {
    mockDb.queryAll.mockResolvedValue(MOCK_CUENTAS);
    const { getArbol } = await import('../src/lib/sri-api/plan-cuentas');
    const arbol = await getArbol(TENANT);
    expect(arbol).toHaveLength(1);
    expect(arbol[0].subcuentas).toHaveLength(1);
    expect(arbol[0].subcuentas[0].subcuentas).toHaveLength(1);
  });

  it('getHijas retorna subcuentas', async () => {
    mockDb.queryOne.mockResolvedValue(MOCK_CUENTAS[1]);
    mockDb.queryAll.mockResolvedValue([MOCK_CUENTAS[2]]);
    const { getHijas } = await import('../src/lib/sri-api/plan-cuentas');
    const hijas = await getHijas(2);
    expect(hijas).toHaveLength(1);
    expect(hijas[0].codigo).toBe('1.01.01');
  });

  it('getByCodigo retorna cuenta por código', async () => {
    mockDb.queryOne.mockResolvedValue(MOCK_CUENTA);
    const { getByCodigo } = await import('../src/lib/sri-api/plan-cuentas');
    const result = await getByCodigo(TENANT, '1.01.01');
    expect(result.nombre).toBe('Caja');
  });
});

describe('Módulo 2: Impuestos', () => {
  const TENANT = 'tenant-1';
  const IMP_IVA = { id: 1, tenant_id: TENANT, codigo: '2', codigo_porcentaje: '2', nombre: 'IVA 12%', porcentaje: 12, tarifa: 12, tipo_impuesto: 'IVA', activo: true };
  const IMP_RET = { id: 2, tenant_id: TENANT, codigo: '2', codigo_porcentaje: '9', nombre: 'Ret. IVA 30%', porcentaje: 30, tarifa: 30, tipo_impuesto: 'IVA_RET', activo: true };

  beforeEach(() => { vi.clearAllMocks(); });

  it('getAll filtra por tenant', async () => {
    mockDb.queryAll.mockResolvedValue([IMP_IVA]);
    const { getAll } = await import('../src/lib/sri-api/impuestos');
    const result = await getAll(TENANT);
    expect(result).toHaveLength(1);
  });

  it('getById lanza error si no existe', async () => {
    mockDb.queryOne.mockResolvedValue(null);
    const { getById } = await import('../src/lib/sri-api/impuestos');
    await expect(getById(999)).rejects.toThrow('no encontrado');
  });

  it('create rechaza duplicado por codigo+codigoPorcentaje', async () => {
    mockDb.queryOne.mockResolvedValue({ id: 1 });
    const { create } = await import('../src/lib/sri-api/impuestos');
    await expect(create({ tenantId: TENANT, codigo: '2', codigoPorcentaje: '2', nombre: 'IVA 12%', porcentaje: 12, tarifa: 12, tipoImpuesto: 'IVA' }))
      .rejects.toThrow('Ya existe un impuesto con código 2-2');
  });

  it('create inserta impuesto válido', async () => {
    mockDb.queryOne.mockResolvedValue(null);
    const { create } = await import('../src/lib/sri-api/impuestos');
    await create({ tenantId: TENANT, codigo: '2', codigoPorcentaje: '0', nombre: 'IVA 0%', porcentaje: 0, tarifa: 0, tipoImpuesto: 'IVA' });
    expect(mockDb.insert).toHaveBeenCalledWith('impuestos', expect.objectContaining({ codigo: '2', codigo_porcentaje: '0' }));
  });

  it('getRetencionesIVA filtra por tipo_impuesto', async () => {
    mockDb.queryAll.mockResolvedValue([IMP_RET]);
    const { getRetencionesIVA } = await import('../src/lib/sri-api/impuestos');
    const result = await getRetencionesIVA(TENANT);
    expect(result).toHaveLength(1);
    expect(mockDb.queryAll).toHaveBeenCalledWith(
      expect.stringContaining("tipo_impuesto = $2"),
      [TENANT, 'IVA_RET']
    );
  });

  it('getRetencionesRenta filtra por tipo_impuesto', async () => {
    mockDb.queryAll.mockResolvedValue([]);
    const { getRetencionesRenta } = await import('../src/lib/sri-api/impuestos');
    const result = await getRetencionesRenta(TENANT);
    expect(result).toHaveLength(0);
  });

  it('getByTipo filtra por tipo', async () => {
    mockDb.queryAll.mockResolvedValue([IMP_IVA]);
    const { getByTipo } = await import('../src/lib/sri-api/impuestos');
    const result = await getByTipo(TENANT, 'IVA');
    expect(result).toHaveLength(1);
  });

  it('remove desactiva impuesto', async () => {
    mockDb.queryOne.mockResolvedValue(IMP_IVA);
    const { remove } = await import('../src/lib/sri-api/impuestos');
    await remove(1);
    expect(mockDb.update).toHaveBeenCalledWith('impuestos', { activo: false }, 'id = $1', [1]);
  });
});

describe('Módulo 3: Tipos Documento SRI', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('getAll retorna tipos activos', async () => {
    mockDb.queryAll.mockResolvedValue([{ codigo: '01', nombre: 'Factura' }, { codigo: '04', nombre: 'Nota de Crédito' }]);
    const { getAll } = await import('../src/lib/sri-api/tipos-documento');
    const result = await getAll();
    expect(result).toHaveLength(2);
    expect(mockDb.queryAll).toHaveBeenCalledWith(
      expect.stringContaining('activo = true')
    );
  });

  it('getByCodigo retorna tipo', async () => {
    mockDb.queryOne.mockResolvedValue({ codigo: '01', nombre: 'Factura' });
    const { getByCodigo } = await import('../src/lib/sri-api/tipos-documento');
    const result = await getByCodigo('01');
    expect(result.nombre).toBe('Factura');
  });

  it('getByCodigo lanza error si no existe', async () => {
    mockDb.queryOne.mockResolvedValue(null);
    const { getByCodigo } = await import('../src/lib/sri-api/tipos-documento');
    await expect(getByCodigo('99')).rejects.toThrow('no encontrado');
  });
});

describe('Módulo 4: Tipos Sustento Tributario', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('getAll retorna tipos activos', async () => {
    mockDb.queryAll.mockResolvedValue([{ codigo: '01', nombre: 'Sustento normal' }]);
    const { getAll } = await import('../src/lib/sri-api/tipos-sustento');
    const result = await getAll();
    expect(result).toHaveLength(1);
  });

  it('getByCodigo retorna tipo', async () => {
    mockDb.queryOne.mockResolvedValue({ codigo: '01', nombre: 'Sustento normal' });
    const { getByCodigo } = await import('../src/lib/sri-api/tipos-sustento');
    const result = await getByCodigo('01');
    expect(result.nombre).toBe('Sustento normal');
  });
});

describe('Módulo 5: Posiciones Fiscales', () => {
  const TENANT = 'tenant-1';
  const POSICION = { id: 1, tenant_id: TENANT, nombre: 'General', tipo_contribuyente: 'PERSONA_NATURAL', activo: true };

  beforeEach(() => { vi.clearAllMocks(); });

  it('getAll retorna posiciones activas', async () => {
    mockDb.queryAll.mockResolvedValue([POSICION]);
    const { getAll } = await import('../src/lib/sri-api/posiciones-fiscales');
    const result = await getAll(TENANT);
    expect(result).toHaveLength(1);
  });

  it('create inserta posición fiscal', async () => {
    const { create } = await import('../src/lib/sri-api/posiciones-fiscales');
    await create({ tenantId: TENANT, nombre: 'General', tipoContribuyente: 'PERSONA_NATURAL' });
    expect(mockDb.insert).toHaveBeenCalledWith('posiciones_fiscales', expect.objectContaining({ nombre: 'General' }));
  });

  it('getWithLines retorna posición con líneas', async () => {
    mockDb.queryOne.mockResolvedValue(POSICION);
    mockDb.queryAll.mockResolvedValue([{ id: 1, impuesto_id: 1, tipo_operacion: 'VENTA', codigo: '2', nombre: 'IVA 12%' }]);
    const { getWithLines } = await import('../src/lib/sri-api/posiciones-fiscales');
    const result = await getWithLines(1);
    expect(result.lineas).toHaveLength(1);
  });

  it('addLinea valida posición e impuesto', async () => {
    mockDb.queryOne.mockResolvedValueOnce(POSICION).mockResolvedValueOnce({ id: 1, codigo: '2' });
    const { addLinea } = await import('../src/lib/sri-api/posiciones-fiscales');
    await addLinea(1, { impuestoId: 1, tipoOperacion: 'VENTA' });
    expect(mockDb.insert).toHaveBeenCalledWith('posiciones_fiscales_lineas', expect.objectContaining({ posicion_fiscal_id: 1, impuesto_id: 1 }));
  });

  it('addLinea rechaza impuesto inexistente', async () => {
    mockDb.queryOne.mockResolvedValueOnce(POSICION).mockResolvedValueOnce(null);
    const { addLinea } = await import('../src/lib/sri-api/posiciones-fiscales');
    await expect(addLinea(1, { impuestoId: 999, tipoOperacion: 'VENTA' })).rejects.toThrow('no encontrado');
  });

  it('removeLinea elimina línea', async () => {
    mockDb.queryOne.mockResolvedValue({ id: 1, posicion_fiscal_id: 1 });
    const { removeLinea } = await import('../src/lib/sri-api/posiciones-fiscales');
    await removeLinea(1);
    expect(mockDb.query).toHaveBeenCalledWith('DELETE FROM posiciones_fiscales_lineas WHERE id = $1', [1]);
  });

  it('findByTipoContribuyente filtra y carga líneas', async () => {
    mockDb.queryAll.mockResolvedValueOnce([POSICION]);
    mockDb.queryAll.mockResolvedValueOnce([{ id: 1, impuesto_id: 1 }]);
    const { findByTipoContribuyente } = await import('../src/lib/sri-api/posiciones-fiscales');
    const result = await findByTipoContribuyente(TENANT, 'PERSONA_NATURAL');
    expect(result).toHaveLength(1);
    expect(result[0].lineas).toHaveLength(1);
  });
});

describe('Módulo 6: Contactos SRI — validarIdentificacion', () => {
  it('valida cédula correcta', async () => {
    const { validarIdentificacion } = await import('../src/lib/sri-api/contactos');
    expect(validarIdentificacion('05', CEDULA_VALIDA).valido).toBe(true);
  });

  it('rechaza cédula con dígito incorrecto', async () => {
    const { validarIdentificacion } = await import('../src/lib/sri-api/contactos');
    expect(validarIdentificacion('05', '1710034064').valido).toBe(false);
  });

  it('rechaza cédula con menos de 10 dígitos', async () => {
    const { validarIdentificacion } = await import('../src/lib/sri-api/contactos');
    expect(validarIdentificacion('05', '12345').valido).toBe(false);
  });

  it('rechaza cédula con tercer dígito > 6', async () => {
    const { validarIdentificacion } = await import('../src/lib/sri-api/contactos');
    expect(validarIdentificacion('05', '1780034065').valido).toBe(false);
  });

  it('valida RUC persona natural', async () => {
    const { validarIdentificacion } = await import('../src/lib/sri-api/contactos');
    expect(validarIdentificacion('04', RUC_PN_VALIDO).valido).toBe(true);
  });

  it('valida RUC sociedad', async () => {
    const { validarIdentificacion } = await import('../src/lib/sri-api/contactos');
    expect(validarIdentificacion('04', RUC_SOCIEDAD_VALIDO).valido).toBe(true);
  });

  it('valida RUC extranjero', async () => {
    // Extranjero RUC: third digit = 8
    // Coefficients [3,2,7,6,5,4,3,2] for first 8 digits
    // 0880000005001:
    // 0*3+8*2+8*7+0*6+0*5+0*4+0*3+0*2 = 0+16+56+0+0+0+0+0 = 72
    // 72%11 = 6, 11-6 = 5 → digit[8] = 5 ✓
    const RUC_EXT = '0880000050001';
    const { validarIdentificacion } = await import('../src/lib/sri-api/contactos');
    expect(validarIdentificacion('04', RUC_EXT).valido).toBe(true);
  });

  it('rechaza RUC sin final 001', async () => {
    const { validarIdentificacion } = await import('../src/lib/sri-api/contactos');
    expect(validarIdentificacion('04', RUC_PN_VALIDO.substring(0, 10) + '002').valido).toBe(false);
  });

  it('valida pasaporte', async () => {
    const { validarIdentificacion } = await import('../src/lib/sri-api/contactos');
    expect(validarIdentificacion('06', 'AB123456').valido).toBe(true);
  });

  it('valida consumidor final', async () => {
    const { validarIdentificacion } = await import('../src/lib/sri-api/contactos');
    expect(validarIdentificacion('07', '9999999999999').valido).toBe(true);
  });

  it('rechaza consumidor final incorrecto', async () => {
    const { validarIdentificacion } = await import('../src/lib/sri-api/contactos');
    expect(validarIdentificacion('07', '1234567890').valido).toBe(false);
  });

  it('rechaza tipo de identificación no reconocido', async () => {
    const { validarIdentificacion } = await import('../src/lib/sri-api/contactos');
    expect(validarIdentificacion('99', '12345').valido).toBe(false);
  });

  it('valida identificación del exterior', async () => {
    const { validarIdentificacion } = await import('../src/lib/sri-api/contactos');
    expect(validarIdentificacion('08', 'ABC12345').valido).toBe(true);
  });

  it('rechaza identificación exterior muy corta', async () => {
    const { validarIdentificacion } = await import('../src/lib/sri-api/contactos');
    expect(validarIdentificacion('08', 'AB').valido).toBe(false);
  });
});

describe('Módulo 6b: Contactos SRI — CRUD con mocks', () => {
  const TENANT = 'tenant-1';
  const RUC_SOC = RUC_SOCIEDAD_VALIDO;
  const CONTACTO = { id: 'uuid-1', tenant_id: TENANT, tipo_identificacion: '04', identificacion: RUC_SOC, razon_social: 'Test S.A.', es_cliente: true, es_proveedor: false, activo: true };

  beforeEach(() => {
    vi.clearAllMocks();
    // Default mock implementations
    mockDb.queryAll.mockResolvedValue([CONTACTO]);
    mockDb.queryOne.mockResolvedValue(CONTACTO);
    mockDb.query.mockResolvedValue(undefined);
    mockDb.insert.mockResolvedValue({ id: 'new-uuid' });
    mockDb.update.mockResolvedValue(undefined);
  });

  it('getAll filtra por tenant y opciones', async () => {
    const { getAll } = await import('../src/lib/sri-api/contactos');
    const result = await getAll(TENANT, { esCliente: true, search: 'Test' });
    expect(result).toHaveLength(1);
    expect(mockDb.queryAll).toHaveBeenCalledWith(
      expect.stringContaining('es_cliente'),
      expect.arrayContaining([TENANT, true, expect.any(String)])
    );
  });

  it('create valída identificación antes de insertar', async () => {
    const { create } = await import('../src/lib/sri-api/contactos');
    await expect(create({ tenantId: TENANT, tipoIdentificacion: '05', identificacion: 'invalid', razonSocial: 'Test' }))
      .rejects.toThrow();
  });

  it('create rechaza duplicado por identificación', async () => {
    const { create } = await import('../src/lib/sri-api/contactos');
    await expect(create({ tenantId: TENANT, tipoIdentificacion: '04', identificacion: RUC_SOC, razonSocial: 'Test S.A.' }))
      .rejects.toThrow('Ya existe un contacto con');
  });

  it('create inserta contacto válido', async () => {
    mockDb.queryOne.mockResolvedValue(null);
    const { create } = await import('../src/lib/sri-api/contactos');
    await create({ tenantId: TENANT, tipoIdentificacion: '04', identificacion: RUC_SOC, razonSocial: 'Test S.A.', esCliente: true, esProveedor: false });
    expect(mockDb.insert).toHaveBeenCalledWith('contactos', expect.objectContaining({ identificacion: RUC_SOC, razon_social: 'Test S.A.' }));
  });

  it('getById retorna contacto', async () => {
    const { getById } = await import('../src/lib/sri-api/contactos');
    const result = await getById('uuid-1');
    expect(result.razon_social).toBe('Test S.A.');
  });

  it('getById lanza error si no existe', async () => {
    mockDb.queryOne.mockResolvedValue(null);
    const { getById } = await import('../src/lib/sri-api/contactos');
    await expect(getById('nonexistent')).rejects.toThrow('no encontrado');
  });

  it('getByIdentificacion busca por tipo y número', async () => {
    const { getByIdentificacion } = await import('../src/lib/sri-api/contactos');
    const result = await getByIdentificacion(TENANT, '04', RUC_SOC);
    expect(result).toBeTruthy();
  });

  it('update modifica campos', async () => {
    const { update } = await import('../src/lib/sri-api/contactos');
    await update('uuid-1', { razonSocial: 'New Name', esCliente: false });
    expect(mockDb.update).toHaveBeenCalledWith('contactos', expect.objectContaining({ razon_social: 'New Name', es_cliente: false }), 'id = $1', ['uuid-1']);
  });

  it('remove desactiva contacto', async () => {
    const { remove } = await import('../src/lib/sri-api/contactos');
    await remove('uuid-1');
    expect(mockDb.update).toHaveBeenCalledWith('contactos', { activo: false }, 'id = $1', ['uuid-1']);
  });
});

describe('Módulo 6c: Contactos SRI — buscarEnSri', () => {
  it('retorna error para identificación que falla validación básica', async () => {
    const { buscarEnSri } = await import('../src/lib/sri-api/contactos');
    const result = await buscarEnSri('AB');
    expect(result.error).toBeTruthy();
  });
});

describe('Módulo 7: Reportes Fiscales (103/104)', () => {
  const TENANT = 'tenant-1';

  beforeEach(() => { vi.clearAllMocks(); });

  it('generate103 lanza error sin emisor', async () => {
    mockDb.queryOne.mockResolvedValue(null);
    const { generate103 } = await import('../src/lib/sri-api/reportes-fiscales');
    await expect(generate103(TENANT, 202601)).rejects.toThrow('No hay un emisor configurado');
  });

  it('generate103 calcula valores correctamente', async () => {
    const emisor = { ruc: '0990000000001', activo: true };
    const comprobantes = [
      { tipo: '01', emisor_ruc: '0990000000001', total_iva: 12.00, subtotal_sin_impuesto: 100.00, importe_total: 112.00 },
      { tipo: '01', emisor_ruc: '0990000000001', total_iva: 0.00, subtotal_sin_impuesto: 50.00, importe_total: 50.00 },
      { tipo: '01', emisor_ruc: '1790012345001', total_iva: 11.76, subtotal_sin_impuesto: 98.00, importe_total: 109.76 },
      { tipo: '07', emisor_ruc: '1790012345001', total_iva: 3.60, categoria: 'Bienes' },
    ];

    mockDb.queryOne.mockResolvedValueOnce(emisor);
    mockDb.queryAll.mockResolvedValue(comprobantes);

    const { generate103 } = await import('../src/lib/sri-api/reportes-fiscales');
    const result = await generate103(TENANT, 202601);

    expect(result.ivaVentas12).toBeCloseTo(12.00, 1);
    expect(result.ivaVentas0).toBeCloseTo(50.00, 1);
    expect(result.totalVentasNetas).toBeCloseTo(150.00, 1);
    expect(result.retencionIvaBienes).toBeCloseTo(3.60, 1);
  });

  it('generate104 lanza error sin emisor', async () => {
    mockDb.queryOne.mockResolvedValue(null);
    const { generate104 } = await import('../src/lib/sri-api/reportes-fiscales');
    await expect(generate104(TENANT, 202601)).rejects.toThrow('No hay un emisor configurado');
  });

  it('generate104 calcula ingresos y costos', async () => {
    const emisor = { ruc: '0990000000001', activo: true };
    const comprobantes = [
      { tipo: '01', emisor_ruc: '0990000000001', importe_total: 1000.00, total_iva: 120.00 },
      { tipo: '01', emisor_ruc: '0990000000001', importe_total: 500.00, total_iva: 60.00, categoria: 'Servicio' },
      { tipo: '01', emisor_ruc: '1790012345001', importe_total: 300.00, total_iva: 36.00 },
      { tipo: '07', emisor_ruc: '1790012345001', total_iva: 2.50 },
    ];

    mockDb.queryOne.mockResolvedValueOnce(emisor);
    mockDb.queryAll.mockResolvedValue(comprobantes);

    const { generate104 } = await import('../src/lib/sri-api/reportes-fiscales');
    const result = await generate104(TENANT, 202601);

    // ingresosVentas: all non-exportacion (both 1000 and 500 match)
    expect(result.ingresosVentas).toBe(1500.00);
    expect(result.ingresosServicios).toBe(500.00);
    expect(result.costosCompras).toBe(300.00);
  });

  it('saveReporte upserts en reportes_fiscales', async () => {
    mockDb.query.mockResolvedValue(undefined);
    mockDb.queryOne.mockResolvedValue({ id: 1, tipo: '103', periodo: 202601, estado: 'GENERADO' });
    const { saveReporte } = await import('../src/lib/sri-api/reportes-fiscales');
    const result = await saveReporte(TENANT, '103', 202601, {
      periodo: 202601, ivaVentas12: 100, ivaVentas14: 0, ivaVentas15: 0, ivaVentas0: 50,
      exportacionesNetas: 0, totalVentasNetas: 150, ivaCompras12: 20, ivaCompras14: 0, ivaCompras15: 0,
      ivaCompras0: 30, totalComprasNetas: 50, retencionIvaBienes: 5, retencionIvaServicios: 0,
      retencionIvaServiciosProfesionales: 0, retencionRentaBienes: 0, retencionRentaServicios: 0,
      retencionRentaHonorarios: 0, totalRetenciones: 5, saldoFavorIva: 0, saldoFavorRenta: 0,
    });
    expect(result.estado).toBe('GENERADO');
  });

  it('updateEstado cambia estado a PRESENTADO', async () => {
    mockDb.queryOne.mockResolvedValue({ id: 1, estado: 'GENERADO' });
    const { updateEstado } = await import('../src/lib/sri-api/reportes-fiscales');
    await updateEstado(1, 'PRESENTADO');
    expect(mockDb.update).toHaveBeenCalledWith('reportes_fiscales', expect.objectContaining({ estado: 'PRESENTADO' }), 'id = $1', [1]);
  });

  it('getResumen retorna estadísticas del período', async () => {
    const emisor = { ruc: '0990000000001', activo: true };
    const comprobantes = [
      { tipo: '01', emisor_ruc: '0990000000001', importe_total: 200, total_iva: 24 },
      { tipo: '01', emisor_ruc: '1790012345001', importe_total: 100, total_iva: 12 },
      { tipo: '04', emisor_ruc: '0990000000001', importe_total: 50, total_iva: 0 },
      { tipo: '07', emisor_ruc: '1790012345001', total_iva: 3 },
    ];

    mockDb.queryOne.mockResolvedValueOnce(emisor);
    mockDb.queryAll.mockResolvedValueOnce(comprobantes);
    mockDb.queryAll.mockResolvedValueOnce([]);

    const { getResumen } = await import('../src/lib/sri-api/reportes-fiscales');
    const result = await getResumen(TENANT, 202601);
    expect(result.totalFacturasEmitidas).toBe(1);
    expect(result.totalFacturasRecibidas).toBe(1);
    expect(result.totalNotasCredito).toBe(1);
    expect(result.totalRetenciones).toBe(1);
    expect(result.totalComprobantes).toBe(4);
  });
});

describe('Módulo 8: ATS', () => {
  const TENANT = 'tenant-1';

  beforeEach(() => { vi.clearAllMocks(); });

  it('getAtsData lanza error sin emisor', async () => {
    mockDb.queryOne.mockResolvedValue(null);
    const { getAtsData } = await import('../src/lib/sri-api/ats');
    await expect(getAtsData(TENANT, 202601)).rejects.toThrow('No hay un emisor configurado');
  });

  it('getAtsData agrupa ventas y compras por cliente', async () => {
    const emisor = { ruc: '0990000000001', razon_social: 'Test S.A.', establecimiento: '001', activo: true };
    const comprobantes = [
      { tipo: '01', emisor_ruc: '0990000000001', receptor_tipo_id: '05', receptor_identificacion: CEDULA_VALIDA, receptor_razon_social: 'Juan Perez', total_sin_impuesto: 100, total_iva: 12, total_descuento: 0, estado: 'AUTORIZADO' },
      { tipo: '01', emisor_ruc: '0990000000001', receptor_tipo_id: '05', receptor_identificacion: CEDULA_VALIDA, receptor_razon_social: 'Juan Perez', total_sin_impuesto: 50, total_iva: 6, total_descuento: 0, estado: 'AUTORIZADO' },
      { tipo: '01', emisor_ruc: '1790012345001', receptor_tipo_id: '04', receptor_identificacion: '0990000000001', receptor_razon_social: 'Proveedor S.A.', total_sin_impuesto: 200, total_iva: 24, total_descuento: 0, estado: 'AUTORIZADO' },
      { tipo: '07', emisor_ruc: '1790012345001', total_sin_impuesto: 100, total_iva: 3, estado: 'AUTORIZADO' },
    ];

    mockDb.queryOne.mockResolvedValueOnce(emisor);
    mockDb.queryAll.mockResolvedValue(comprobantes);

    const { getAtsData } = await import('../src/lib/sri-api/ats');
    const data = await getAtsData(TENANT, 202601);

    expect(data.ventas).toHaveLength(1);
    expect(data.ventas[0].numeroComprobantes).toBe(2);
    expect(data.ventas[0].baseImponible).toBeCloseTo(150, 1);
    expect(data.compras).toHaveLength(1);
    expect(data.compras[0].baseImponible).toBeCloseTo(200, 1);
    expect(data.retenciones).toHaveLength(1);
  });

  it('validateAts valida datos correctos', async () => {
    const { validateAts } = await import('../src/lib/sri-api/ats');
    const result = validateAts({
      periodo: 202601, razonSocial: 'Test S.A.', ruc: '0990000000001',
      establecimientos: [{ codigo: '001', direccion: 'Quito' }],
      ventas: [{ tpIdCliente: '05', idCliente: CEDULA_VALIDA, razonSocial: 'Juan', tipoComprobante: 'FACTURA', numeroComprobantes: 1, baseImponible: 100, baseNoGraIva: 0, montoIva: 12, valorRetenidoIva: 0, valorRetenidoRenta: 0 }],
      compras: [], retenciones: [], anulados: [], totalVentas: 100, totalCompras: 0, totalRetenciones: 0,
    });
    expect(result.valido).toBe(true);
  });

  it('validateAts detecta errores', async () => {
    const { validateAts } = await import('../src/lib/sri-api/ats');
    const result = validateAts({
      periodo: 201912, razonSocial: '', ruc: '123',
      establecimientos: [],
      ventas: [{ tpIdCliente: '05', idCliente: '', razonSocial: '', tipoComprobante: 'FACTURA', numeroComprobantes: 1, baseImponible: -10, baseNoGraIva: 0, montoIva: 0, valorRetenidoIva: 0, valorRetenidoRenta: 0 }],
      compras: [{ tpIdProveedor: '04', idProveedor: '', razonSocial: '', tipoComprobante: 'FACTURA', numeroComprobantes: 1, baseImponible: -5, baseNoGraIva: 0, montoIva: 0, valorRetenidoIva: 0, valorRetenidoRenta: 0 }],
      retenciones: [], anulados: [], totalVentas: 0, totalCompras: 0, totalRetenciones: 0,
    });
    expect(result.valido).toBe(false);
    expect(result.errores.length).toBeGreaterThanOrEqual(5);
  });

  it('exportAtsXml genera XML', async () => {
    const emisor = { ruc: '0990000000001', razon_social: 'Test S.A.', establecimiento: '001', direccion_matriz: 'Quito', activo: true };
    mockDb.queryOne.mockResolvedValueOnce(emisor);
    mockDb.queryAll.mockResolvedValue([]);
    const { exportAtsXml } = await import('../src/lib/sri-api/ats');
    const xml = await exportAtsXml(TENANT, 202601);
    expect(xml).toContain('<?xml version="1.0"');
  });

  it('generateAts upserts y retorna datos', async () => {
    const emisor = { ruc: '0990000000001', razon_social: 'Test S.A.', establecimiento: '001', activo: true };
    mockDb.queryOne.mockResolvedValueOnce(emisor);
    mockDb.queryAll.mockResolvedValue([]);
    mockDb.query.mockResolvedValue(undefined);
    const { generateAts } = await import('../src/lib/sri-api/ats');
    const data = await generateAts(TENANT, 202601);
    expect(data.ruc).toBe('0990000000001');
    expect(data.ventas).toHaveLength(0);
  });
});

describe('Módulo 9: POS - calcularPosTotals', () => {
  it('calcula totales con IVA 12% y 0%', async () => {
    const { calcularPosTotals } = await import('../src/lib/sri-api/pos');
    const result = calcularPosTotals([
      { codigo: '001', descripcion: 'Producto A', cantidad: 2, precioUnitario: 10, ivaPorcentaje: 12 },
      { codigo: '002', descripcion: 'Producto B', cantidad: 1, precioUnitario: 5, ivaPorcentaje: 0 },
    ]);
    expect(result.subtotalSinImpuesto).toBe(25.00);
    expect(result.totalIVA).toBe(2.40);
    expect(result.total).toBe(27.40);
    expect(result.ivaDesglosado).toHaveLength(2);
  });

  it('aplica descuento global y propina', async () => {
    const { calcularPosTotals } = await import('../src/lib/sri-api/pos');
    const result = calcularPosTotals([
      { codigo: '001', descripcion: 'Item', cantidad: 1, precioUnitario: 100, ivaPorcentaje: 12 },
    ], 10, 5);
    expect(result.totalSinImpuesto).toBe(90.00);
    expect(result.totalIVA).toBe(12.00);
    expect(result.total).toBe(107.00);
  });

  it('maneja items con descuento por item', async () => {
    const { calcularPosTotals } = await import('../src/lib/sri-api/pos');
    const result = calcularPosTotals([
      { codigo: '001', descripcion: 'Item', cantidad: 1, precioUnitario: 100, ivaPorcentaje: 12, descuento: 15 },
    ]);
    expect(result.subtotalSinImpuesto).toBe(85.00);
    expect(result.totalDescuento).toBe(15.00);
  });

  it('agrupa IVA por tarifa', async () => {
    const { calcularPosTotals } = await import('../src/lib/sri-api/pos');
    const result = calcularPosTotals([
      { codigo: '001', descripcion: 'A', cantidad: 1, precioUnitario: 100, ivaPorcentaje: 12 },
      { codigo: '002', descripcion: 'B', cantidad: 1, precioUnitario: 50, ivaPorcentaje: 12 },
      { codigo: '003', descripcion: 'C', cantidad: 1, precioUnitario: 30, ivaPorcentaje: 0 },
    ]);
    expect(result.ivaDesglosado).toHaveLength(2);
    const iva12 = result.ivaDesglosado.find((x: any) => x.tarifa === 12)!;
    expect(iva12.baseImponible).toBe(150.00);
    expect(iva12.valor).toBe(18.00);
  });
});

describe('Módulo 10: eCommerce - calcularEcommerceTotals', () => {
  it('calcula totales igual que POS', async () => {
    const { calcularEcommerceTotals } = await import('../src/lib/sri-api/ecommerce');
    const result = calcularEcommerceTotals([
      { codigo: '001', descripcion: 'Producto A', cantidad: 2, precioUnitario: 10, ivaPorcentaje: 12 },
      { codigo: '002', descripcion: 'Producto B', cantidad: 1, precioUnitario: 5, ivaPorcentaje: 0 },
    ]);
    expect(result.subtotalSinImpuesto).toBe(25.00);
    expect(result.totalIVA).toBe(2.40);
    expect(result.total).toBe(27.40);
  });

  it('aplica descuento global', async () => {
    const { calcularEcommerceTotals } = await import('../src/lib/sri-api/ecommerce');
    const result = calcularEcommerceTotals([
      { codigo: '001', descripcion: 'Item', cantidad: 1, precioUnitario: 100, ivaPorcentaje: 12 },
    ], 10);
    expect(result.totalSinImpuesto).toBe(90.00);
  });
});

describe('Módulo 11: Guía Remisión', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('buildGuiaXml lanza error si emisor no existe', async () => {
    mockDb.queryOne.mockResolvedValue(null);
    const { buildGuiaXml } = await import('../src/lib/sri-api/guia-remision');
    await expect(buildGuiaXml({
      emisor: { ruc: '0990000000001', razonSocial: 'Test', direccionEstablecimiento: 'Quito' },
      destinatario: { razonSocial: 'Cliente', identificacion: CEDULA_VALIDA, tipoIdentificacion: '05' },
      transporte: { placa: 'PBA-1234', transportistaRuc: '1790012345001', transportistaRazonSocial: 'Trans S.A.' },
      fechaInicioTransporte: '2025-01-15', motivoTraslado: 'VENTA', direccionPartida: 'Quito', direccionLlegada: 'Guayaquil',
      detalle: [{ codigo: '001', descripcion: 'Producto', cantidad: 10 }],
      tenantId: 'tenant-1',
    })).rejects.toThrow('no encontrado');
  });

  it('buildGuiaXml llama a xmlBuilder.buildGuiaRemision', async () => {
    const EMISOR_MOCK = {
      id: 'e1', ruc: '0990000000001', razon_social: 'Test S.A.', nombre_comercial: 'Test',
      ambiente: '1', tipo_emision: '1', establecimiento: '001', punto_emision: '001',
      dir_matriz: 'Quito', direccion_matriz: 'Quito',
      contribuyente_rimpe: null, obligado_contabilidad: 'NO', activo: true,
    };

    mockDb.queryOne.mockResolvedValueOnce(EMISOR_MOCK);
    mockDb.queryOne.mockResolvedValueOnce(null);
    mockDb.query.mockResolvedValueOnce(undefined);

    mockXmlBuilder.buildGuiaRemision.mockReturnValue('<xml>guia</xml>');

    const { buildGuiaXml } = await import('../src/lib/sri-api/guia-remision');
    const result = await buildGuiaXml({
      emisor: { ruc: '0990000000001', razonSocial: 'Test S.A.', direccionEstablecimiento: 'Quito',
        contribuyenteEspecial: undefined, obligadoContabilidad: 'NO' },
      destinatario: { razonSocial: 'Cliente', identificacion: CEDULA_VALIDA, tipoIdentificacion: '05' },
      transporte: { placa: 'PBA-1234', transportistaRuc: '1790012345001', transportistaRazonSocial: 'Trans S.A.' },
      fechaInicioTransporte: '2025-01-15', motivoTraslado: 'VENTA', direccionPartida: 'Quito', direccionLlegada: 'Guayaquil',
      detalle: [{ codigo: '001', descripcion: 'Producto', cantidad: 10 }],
      tenantId: 'tenant-1',
    });

    expect(result).toBe('<xml>guia</xml>');
    expect(mockXmlBuilder.buildGuiaRemision).toHaveBeenCalledTimes(1);
  });
});

describe('Módulo 12: Rutas API existen', () => {
  const ROUTES: { path: string; methods: string[] }[] = [
    { path: 'contabilidad/plan-cuentas', methods: ['GET', 'POST'] },
    { path: 'contabilidad/plan-cuentas/[id]', methods: ['GET', 'PUT', 'DELETE'] },
    { path: 'contabilidad/plan-cuentas/arbol', methods: ['GET'] },
    { path: 'contabilidad/plan-cuentas/estandar', methods: ['POST'] },
    { path: 'contabilidad/impuestos', methods: ['GET', 'POST'] },
    { path: 'contabilidad/impuestos/[id]', methods: ['GET', 'PUT', 'DELETE'] },
    { path: 'contabilidad/tipos-documento', methods: ['GET'] },
    { path: 'contabilidad/tipos-sustento', methods: ['GET'] },
    { path: 'contabilidad/posiciones-fiscales', methods: ['GET', 'POST'] },
    { path: 'contabilidad/posiciones-fiscales/[id]', methods: ['GET', 'PUT', 'DELETE'] },
    { path: 'contactos', methods: ['GET', 'POST'] },
    { path: 'contactos/[id]', methods: ['GET', 'PUT', 'DELETE'] },
    { path: 'contactos/validar/[tipo]/[numero]', methods: ['GET'] },
    { path: 'transportistas', methods: ['GET', 'POST'] },
    { path: 'transportistas/[id]', methods: ['GET', 'PUT', 'DELETE'] },
    { path: 'declaraciones/reportes', methods: ['GET', 'POST'] },
    { path: 'declaraciones/reportes/[id]', methods: ['GET', 'PUT'] },
    { path: 'declaraciones/ats', methods: ['GET', 'POST'] },
    { path: 'declaraciones/ats/[id]/xml', methods: ['GET'] },
    { path: 'sri/guia-remision', methods: ['GET', 'POST'] },
    { path: 'sri/guia-remision/[id]', methods: ['GET', 'DELETE'] },
    { path: 'sri/guia-remision/[id]/ride', methods: ['GET'] },
    { path: 'sri/pos', methods: ['POST'] },
    { path: 'sri/motivos-traslado', methods: ['GET'] },
    { path: 'ecommerce/invoices', methods: ['POST'] },
    { path: 'ecommerce/invoices/[id]/send-email', methods: ['POST'] },
  ];

  it.each(ROUTES)('$path exporta $methods', async ({ path, methods }) => {
    const mod = await import(`../src/app/api/${path}/route`);
    for (const method of methods) {
      expect(typeof (mod as any)[method]).toBe('function');
    }
  });
});
