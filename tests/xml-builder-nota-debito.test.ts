import { describe, it, expect } from 'vitest';
import { xmlBuilder } from '../src/lib/sri-api/xml-builder';

const infoTributariaBase = {
  ambiente: '1',
  tipoEmision: '1',
  razonSocial: 'EMISOR S.A.',
  nombreComercial: 'EMISOR',
  ruc: '0999000000001',
  claveAcceso: '0101202501099000000000110010010000000011234567812',
  codDoc: '05',
  estab: '001',
  ptoEmi: '001',
  secuencial: '000000001',
  dirMatriz: 'Av. Principal 123',
};

describe('buildNotaDebito()', () => {
  const ndData = {
    infoTributaria: { ...infoTributariaBase, codDoc: '05' },
    infoNotaDebito: {
      fechaEmision: '15/01/2025',
      dirEstablecimiento: 'Oficina 1',
      tipoIdentificacionComprador: '05',
      razonSocialComprador: 'CLIENTE S.A.',
      identificacionComprador: '0999000000002',
      obligadoContabilidad: 'SI',
      codDocModificado: '01',
      numDocModificado: '001-001-000000050',
      fechaEmisionDocSustento: '10/01/2025',
      totalSinImpuestos: 500.00,
      valorTotal: 575.00,
      impuestos: [
        { codigo: '2', codigoPorcentaje: '4', baseImponible: 500.00, tarifa: 15.00, valor: 75.00 },
      ],
    },
    motivos: [
      { razon: 'Interés por mora', valor: 50.00 },
      { razon: 'Reajuste de precio', valor: 25.00 },
    ],
  };

  it('genera raíz <notaDebito> con version 1.0.0', () => {
    const xml = xmlBuilder.buildNotaDebito(ndData);
    expect(xml).toContain('<notaDebito');
    expect(xml).toContain('version="1.0.0"');
    expect(xml).toContain('id="comprobante"');
  });

  it('incluye <infoNotaDebito> con datos del comprador y documento modificado', () => {
    const xml = xmlBuilder.buildNotaDebito(ndData);
    expect(xml).toContain('<infoNotaDebito>');
    expect(xml).toContain('<tipoIdentificacionComprador>05</tipoIdentificacionComprador>');
    expect(xml).toContain('<codDocModificado>01</codDocModificado>');
    expect(xml).toContain('<numDocModificado>001-001-000000050</numDocModificado>');
  });

  it('incluye <impuestos> con <impuesto> (no totalConImpuestos)', () => {
    const xml = xmlBuilder.buildNotaDebito(ndData);
    expect(xml).toContain('<impuestos>');
    expect(xml).toContain('<impuesto>');
    expect(xml).toContain('<codigo>2</codigo>');
    expect(xml).toContain('<valor>75.00</valor>');
    expect(xml).not.toContain('<totalConImpuestos>');
  });

  it('incluye <motivos> con razón y valor', () => {
    const xml = xmlBuilder.buildNotaDebito(ndData);
    expect(xml).toContain('<motivos>');
    expect(xml).toContain('<razon>Interés por mora</razon>');
    expect(xml).toContain('<valor>50.00</valor>');
    expect(xml).toContain('<razon>Reajuste de precio</razon>');
    expect(xml).toContain('<valor>25.00</valor>');
  });

  it('incluye <infoAdicional> si se proporciona', () => {
    const data = {
      ...ndData,
      infoAdicional: [
        { nombre: 'Email', valor: 'cliente@mail.com' },
      ],
    };
    const xml = xmlBuilder.buildNotaDebito(data);
    expect(xml).toContain('<infoAdicional>');
    expect(xml).toContain('<campoAdicional nombre="Email">');
    expect(xml).toContain('cliente@mail.com');
  });

  it('incluye infoTributaria con codDoc="05"', () => {
    const xml = xmlBuilder.buildNotaDebito(ndData);
    expect(xml).toContain('<codDoc>05</codDoc>');
  });

  it('no incluye <moneda> en la salida', () => {
    const xml = xmlBuilder.buildNotaDebito(ndData);
    expect(xml).not.toContain('<moneda>');
  });

  it('es XML válido y parseable', async () => {
    const xml = xmlBuilder.buildNotaDebito(ndData);
    const parsed = await xmlBuilder.parseXml<any>(xml);
    expect(parsed.notaDebito).toBeDefined();
    expect(parsed.notaDebito.$.id).toBe('comprobante');
    expect(parsed.notaDebito.$.version).toBe('1.0.0');
  });

  it('formatea decimales a 2 dígitos en valorTotal', () => {
    const xml = xmlBuilder.buildNotaDebito(ndData);
    expect(xml).toContain('<valorTotal>575.00</valorTotal>');
  });
});
