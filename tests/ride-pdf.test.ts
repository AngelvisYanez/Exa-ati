import { describe, it, expect } from 'vitest';
import { formatNumero, getFormaPagoLabel, buildQrData } from '../src/lib/sri-api/ride-pdf';

describe('formatNumero', () => {
  it('formatea número con separadores de miles', () => {
    expect(formatNumero(1234.56)).toBe('1,234.56');
  });

  it('formatea número grande', () => {
    expect(formatNumero(1000000.00)).toBe('1,000,000.00');
  });

  it('formatea string numérico', () => {
    expect(formatNumero('5000')).toBe('5,000.00');
  });

  it('formatea cero', () => {
    expect(formatNumero(0)).toBe('0.00');
  });

  it('usa decimales personalizados', () => {
    expect(formatNumero(100.5, 0)).toBe('101');
  });
});

describe('getFormaPagoLabel', () => {
  it('retorna label para código conocido', () => {
    expect(getFormaPagoLabel('01')).toBe('Efectivo');
    expect(getFormaPagoLabel('03')).toBe('Tarjeta de Crédito');
    expect(getFormaPagoLabel('10')).toBe('Transferencia Depósito');
    expect(getFormaPagoLabel('19')).toBe('Otros');
  });

  it('retorna fallback para código desconocido', () => {
    expect(getFormaPagoLabel('99')).toBe('Código 99');
  });

  it('retorna label para Tarjeta de Crédito Visa', () => {
    expect(getFormaPagoLabel('14')).toBe('Tarjeta de Crédito Visa');
  });

  it('retorna label para Tarjeta de Crédito Mastercard', () => {
    expect(getFormaPagoLabel('15')).toBe('Tarjeta de Crédito Mastercard');
  });
});

describe('buildQrData', () => {
  it('construye JSON con datos correctos', () => {
    const result = buildQrData({
      ruc: '0999000000001',
      razonSocial: 'EMPRESA S.A.',
      claveAcceso: '0101202501099900000000110010010000000011234567812',
      importeTotal: 112.50,
      ambiente: '2',
    });
    const parsed = JSON.parse(result);
    expect(parsed.ruc).toBe('0999000000001');
    expect(parsed.razonSocial).toBe('EMPRESA S.A.');
    expect(parsed.claveAcceso).toBe('0101202501099900000000110010010000000011234567812');
    expect(parsed.total).toBe('112.50');
    expect(parsed.ambiente).toBe('2');
  });

  it('formatea total con 2 decimales', () => {
    const result = buildQrData({
      ruc: '0999000000001',
      razonSocial: 'Test',
      claveAcceso: '0101202501099900000000110010010000000011234567812',
      importeTotal: 100,
      ambiente: '1',
    });
    const parsed = JSON.parse(result);
    expect(parsed.total).toBe('100.00');
  });
});
