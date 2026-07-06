import { describe, it, expect } from 'vitest';
import {
  getTipoDocDesc,
  parseSriFloat,
  extractClaveAcceso,
  extractRuc,
  extractSerie,
  extractSecuencial,
  extractFechaEmision,
  mapSriTypeCode,
  classifyExpense,
  cleanEmisorRazonSocial,
  extractIva,
  parseLocalIsoDate,
  getDaysInRange,
} from '../src/lib/scraping/sri-utils';

describe('getTipoDocDesc', () => {
  it('retorna descripción para códigos conocidos', () => {
    expect(getTipoDocDesc('01')).toBe('Factura');
    expect(getTipoDocDesc('03')).toBe('Liquidación de Compra');
    expect(getTipoDocDesc('04')).toBe('Nota de Crédito');
    expect(getTipoDocDesc('05')).toBe('Nota de Débito');
    expect(getTipoDocDesc('07')).toBe('Comprobante de Retención');
  });

  it('retorna código genérico para desconocidos', () => {
    expect(getTipoDocDesc('99')).toBe('Tipo 99');
  });
});

describe('parseSriFloat', () => {
  it('parsea número con punto decimal', () => {
    expect(parseSriFloat('123.45')).toBe(123.45);
  });

  it('parsea número con coma decimal', () => {
    expect(parseSriFloat('123,45')).toBe(123.45);
  });

  it('parsea con ambos separadores (formato EU)', () => {
    expect(parseSriFloat('1.234,56')).toBe(1234.56);
  });

  it('parsea con ambos separadores (formato US)', () => {
    expect(parseSriFloat('1,234.56')).toBe(1234.56);
  });

  it('retorna 0 para null/undefined', () => {
    expect(parseSriFloat(null)).toBe(0);
    expect(parseSriFloat(undefined)).toBe(0);
  });

  it('retorna 0 para string vacío', () => {
    expect(parseSriFloat('')).toBe(0);
  });

  it('retorna número desde valor numérico', () => {
    expect(parseSriFloat(123.45)).toBe(123.45);
  });

  it('maneja número negativo', () => {
    expect(parseSriFloat('-50.00')).toBe(-50);
  });
});

describe('extractClaveAcceso', () => {
  it('extrae 49 dígitos de un string', () => {
    const result = extractClaveAcceso('0101202501099900000000110010010000000011234567812');
    expect(result).toBe('0101202501099900000000110010010000000011234567812');
  });

  it('retorna null si no hay 49 dígitos', () => {
    expect(extractClaveAcceso('abc123')).toBeNull();
    expect(extractClaveAcceso(null)).toBeNull();
    expect(extractClaveAcceso(undefined)).toBeNull();
  });

  it('extrae de texto con más contenido', () => {
    const result = extractClaveAcceso('Clave: 0101202501099900000000110010010000000011234567812 fin');
    expect(result).toBe('0101202501099900000000110010010000000011234567812');
  });
});

describe('extractRuc', () => {
  it('extrae 13 dígitos', () => {
    expect(extractRuc('0999000000001')).toBe('0999000000001');
  });

  it('retorna null si no hay match', () => {
    expect(extractRuc('abc')).toBeNull();
    expect(extractRuc(null)).toBeNull();
  });
});

describe('extractSerie', () => {
  it('extrae de clave de acceso de 49 dígitos', () => {
    const clave = '0101202501099900000000110010010000000011234567812';
    expect(extractSerie(clave)).toBe('001-001');
  });

  it('extrae de formato serie-numero', () => {
    expect(extractSerie('001-002')).toBe('001-002');
  });

  it('retorna null si no hay match', () => {
    expect(extractSerie(null)).toBeNull();
    expect(extractSerie('')).toBeNull();
  });
});

describe('extractSecuencial', () => {
  it('extrae de clave de acceso de 49 dígitos', () => {
    const clave = '0101202501099900000000110010010000000011234567812';
    expect(extractSecuencial(clave)).toBe('000000001');
  });

  it('extrae el último segmento separado por guión', () => {
    expect(extractSecuencial('001-001-000000123')).toBe('000000123');
  });

  it('retorna null para string vacío', () => {
    expect(extractSecuencial('')).toBeNull();
  });
});

describe('extractFechaEmision', () => {
  it('extrae fecha de clave de acceso', () => {
    const clave = '0101202501099900000000110010010000000011234567812';
    expect(extractFechaEmision(clave)).toBe('2025-01-01');
  });

  it('retorna null para null', () => {
    expect(extractFechaEmision(null)).toBeNull();
  });
});

describe('mapSriTypeCode', () => {
  it('mapea códigos de búsqueda a códigos SRI', () => {
    expect(mapSriTypeCode('1')).toBe('01');
    expect(mapSriTypeCode('2')).toBe('03');
    expect(mapSriTypeCode('3')).toBe('04');
    expect(mapSriTypeCode('4')).toBe('05');
    expect(mapSriTypeCode('6')).toBe('07');
  });

  it('pasa códigos desconocidos sin cambios', () => {
    expect(mapSriTypeCode('99')).toBe('99');
    expect(mapSriTypeCode('01')).toBe('01');
  });
});

describe('classifyExpense', () => {
  it('clasifica alimentación', () => {
    expect(classifyExpense('SUPERMAXI S.A.')).toBe('Alimentación');
    expect(classifyExpense('Casa Favorita')).toBe('Alimentación');
    expect(classifyExpense('Supermercado XYZ')).toBe('Alimentación');
  });

  it('clasifica salud', () => {
    expect(classifyExpense('Farmacia Cruz Azul')).toBe('Salud');
    expect(classifyExpense('Hospital Metropolitano')).toBe('Salud');
  });

  it('clasifica educación', () => {
    expect(classifyExpense('Universidad Central')).toBe('Educación');
    expect(classifyExpense('Colegio San Gabriel')).toBe('Educación');
  });

  it('clasifica vivienda', () => {
    expect(classifyExpense('Inmobiliaria XYZ')).toBe('Vivienda');
  });

  it('clasifica vestimenta', () => {
    expect(classifyExpense('Textil del Valle')).toBe('Vestimenta');
    expect(classifyExpense('Moda Fashion')).toBe('Vestimenta');
  });

  it('clasifica negocios/servicios', () => {
    expect(classifyExpense('Claro Ecuador')).toBe('Negocio/Servicios');
    expect(classifyExpense('CNT EP')).toBe('Negocio/Servicios');
  });

  it('retorna Otros por defecto', () => {
    expect(classifyExpense('Empresa XYZ S.A.')).toBe('Otros');
  });

  it('retorna Otros para null', () => {
    expect(classifyExpense(null)).toBe('Otros');
  });
});

describe('cleanEmisorRazonSocial', () => {
  it('limpia RUC del texto', () => {
    expect(cleanEmisorRazonSocial('0999000000001 EMPRESA S.A.')).toBe('EMPRESA S.A.');
  });

  it('limpia guiones y dos puntos', () => {
    expect(cleanEmisorRazonSocial('- EMPRESA S.A. :')).toBe('EMPRESA S.A.');
  });

  it('retorna null para null', () => {
    expect(cleanEmisorRazonSocial(null)).toBeNull();
  });
});

describe('extractIva', () => {
  it('extrae IVA de totalConImpuestos', () => {
    const doc = { totalConImpuestos: { totalImpuesto: { codigo: '2', valor: '12.00' } } };
    expect(extractIva(doc)).toBe(12);
  });

  it('extrae IVA de array de impuestos', () => {
    const doc = { totalConImpuestos: { totalImpuesto: [{ codigo: '2', valor: '12.00' }, { codigo: '3', valor: '5.00' }] } };
    expect(extractIva(doc)).toBe(12);
  });

  it('extrae IVA de impuestos.impuesto', () => {
    const doc = { impuestos: { impuesto: { codigo: '2', valor: '24.00' } } };
    expect(extractIva(doc)).toBe(24);
  });

  it('retorna 0 si no hay IVA', () => {
    expect(extractIva({})).toBe(0);
    expect(extractIva(null)).toBe(0);
  });
});

describe('parseLocalIsoDate', () => {
  it('parsea string ISO', () => {
    const d = parseLocalIsoDate('2025-01-15');
    expect(d.getFullYear()).toBe(2025);
    expect(d.getMonth()).toBe(0);
    expect(d.getDate()).toBe(15);
  });

  it('maneja Date existente', () => {
    const orig = new Date(2025, 0, 1);
    expect(parseLocalIsoDate(orig)).toBe(orig);
  });

  it('usa fecha actual para null', () => {
    const d = parseLocalIsoDate(null);
    expect(d).toBeInstanceOf(Date);
  });
});

describe('getDaysInRange', () => {
  it('retorna todos los días en el rango', () => {
    const start = new Date(2025, 0, 1);
    const end = new Date(2025, 0, 5);
    const days = getDaysInRange(start, end);
    expect(days).toHaveLength(5);
    expect(days[0].getDate()).toBe(1);
    expect(days[4].getDate()).toBe(5);
  });

  it('retorna 1 día si start === end', () => {
    const d = new Date(2025, 5, 15);
    expect(getDaysInRange(d, d)).toHaveLength(1);
  });
});
