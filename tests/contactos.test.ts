import { describe, it, expect } from 'vitest';
import { validarIdentificacion } from '../src/lib/sri-api/contactos';

describe('validarIdentificacion', () => {
  describe('validarCedula (tipo 05)', () => {
    it('válida con dígito verificador correcto (provincia 17, módulo 10)', () => {
      const result = validarIdentificacion('05', '1710034065');
      expect(result).toEqual({ valido: true, mensaje: '' });
    });

    it('inválida — provincia fuera de rango (> 24)', () => {
      const result = validarIdentificacion('05', '2512345678');
      expect(result).toEqual({ valido: false, mensaje: 'Código de provincia inválido.' });
    });

    it('inválida — tercer dígito mayor a 6', () => {
      const result = validarIdentificacion('05', '1772345678');
      expect(result).toEqual({ valido: false, mensaje: 'Tercer dígito inválido para cédula.' });
    });

    it('inválida — dígito verificador incorrecto', () => {
      const result = validarIdentificacion('05', '1710034060');
      expect(result).toEqual({ valido: false, mensaje: 'Dígito verificador de la cédula no coincide.' });
    });

    it('inválida — longitud incorrecta (9 dígitos)', () => {
      const result = validarIdentificacion('05', '123456789');
      expect(result).toEqual({ valido: false, mensaje: 'La cédula debe tener 10 dígitos numéricos.' });
    });
  });

  describe('validarRuc natural person (tipo 04, 3er dígito ≤ 6)', () => {
    it('válido con cédula base correcta y sufijo 001', () => {
      const result = validarIdentificacion('04', '1710034065001');
      expect(result).toEqual({ valido: true, mensaje: '' });
    });

    it('inválido — dígito verificador de la cédula base incorrecto', () => {
      const result = validarIdentificacion('04', '1710034060001');
      expect(result).toEqual({ valido: false, mensaje: 'Dígito verificador de la cédula no coincide.' });
    });

    it('inválido — no termina en 001', () => {
      const result = validarIdentificacion('04', '1710034065002');
      expect(result).toEqual({ valido: false, mensaje: 'Los últimos 3 dígitos del RUC deben ser 001.' });
    });

    it('inválido — longitud incorrecta (12 dígitos)', () => {
      const result = validarIdentificacion('04', '171003406500');
      expect(result).toEqual({ valido: false, mensaje: 'El RUC debe tener 13 dígitos numéricos.' });
    });
  });

  describe('validarRuc sociedad (tipo 04, 3er dígito = 9)', () => {
    it('válido con módulo 11 correcto', () => {
      const result = validarIdentificacion('04', '1790000001001');
      expect(result).toEqual({ valido: true, mensaje: '' });
    });

    it('inválido — dígito verificador incorrecto', () => {
      const result = validarIdentificacion('04', '1790000002001');
      expect(result).toEqual({ valido: false, mensaje: 'Dígito verificador del RUC (Sociedad) no coincide.' });
    });
  });

  describe('validarRuc extranjero (tipo 04, 3er dígito = 8)', () => {
    it('válido con módulo 11 correcto', () => {
      const result = validarIdentificacion('04', '1780000048001');
      expect(result).toEqual({ valido: true, mensaje: '' });
    });

    it('inválido — dígito verificador incorrecto', () => {
      const result = validarIdentificacion('04', '1780000058001');
      expect(result).toEqual({ valido: false, mensaje: 'Dígito verificador del RUC (Extranjero) no coincide.' });
    });
  });

  describe('validarRuc — tercer dígito inválido', () => {
    it('rechaza RUC con tercer dígito = 7', () => {
      const result = validarIdentificacion('04', '1770000000001');
      expect(result).toEqual({ valido: false, mensaje: 'Tercer dígito del RUC inválido.' });
    });
  });

  describe('validarPasaporte (tipo 06)', () => {
    it('válido con 6 caracteres', () => {
      const result = validarIdentificacion('06', 'A12345');
      expect(result).toEqual({ valido: true, mensaje: '' });
    });

    it('válido con 20 caracteres', () => {
      const result = validarIdentificacion('06', 'ABCD1234567890123456');
      expect(result).toEqual({ valido: true, mensaje: '' });
    });

    it('inválido — demasiado corto (5 caracteres)', () => {
      const result = validarIdentificacion('06', 'A1234');
      expect(result).toEqual({ valido: false, mensaje: 'El pasaporte debe tener entre 6 y 20 caracteres.' });
    });

    it('inválido — demasiado largo (21 caracteres)', () => {
      const result = validarIdentificacion('06', 'ABCD123456789012345678');
      expect(result).toEqual({ valido: false, mensaje: 'El pasaporte debe tener entre 6 y 20 caracteres.' });
    });
  });

  describe('validarConsumidorFinal (tipo 07)', () => {
    it('válido con 9999999999999', () => {
      const result = validarIdentificacion('07', '9999999999999');
      expect(result).toEqual({ valido: true, mensaje: '' });
    });

    it('inválido — cualquier otro valor', () => {
      const result = validarIdentificacion('07', '9999999999998');
      expect(result).toEqual({ valido: false, mensaje: 'Consumidor final debe ser 9999999999999.' });
    });
  });

  describe('validarIdentExt (tipo 08)', () => {
    it('válida con 6 caracteres alfanuméricos', () => {
      const result = validarIdentificacion('08', 'ABC123');
      expect(result).toEqual({ valido: true, mensaje: '' });
    });

    it('válida con 20 caracteres alfanuméricos', () => {
      const result = validarIdentificacion('08', 'ABCD1234EFGH5678IJ90');
      expect(result).toEqual({ valido: true, mensaje: '' });
    });

    it('inválida — demasiado corta (4 caracteres)', () => {
      const result = validarIdentificacion('08', 'AB12');
      expect(result).toEqual({ valido: false, mensaje: 'Identificación del exterior inválida. Debe tener entre 5 y 20 caracteres alfanuméricos.' });
    });

    it('inválida — contiene caracteres no alfanuméricos', () => {
      const result = validarIdentificacion('08', 'ABC-123');
      expect(result).toEqual({ valido: false, mensaje: 'Identificación del exterior inválida. Debe tener entre 5 y 20 caracteres alfanuméricos.' });
    });
  });

  describe('dispatcher validarIdentificacion', () => {
    it('tipo 04 → validarRuc', () => {
      expect(validarIdentificacion('04', '1710034065001').valido).toBe(true);
    });

    it('tipo 05 → validarCedula', () => {
      expect(validarIdentificacion('05', '1710034065').valido).toBe(true);
    });

    it('tipo 06 → validarPasaporte', () => {
      expect(validarIdentificacion('06', 'A12345').valido).toBe(true);
    });

    it('tipo 07 → validarConsumidorFinal', () => {
      expect(validarIdentificacion('07', '9999999999999').valido).toBe(true);
    });

    it('tipo 08 → validarIdentExt', () => {
      expect(validarIdentificacion('08', 'ABC123').valido).toBe(true);
    });

    it('tipo desconocido → error', () => {
      const result = validarIdentificacion('99', '1234567890');
      expect(result).toEqual({ valido: false, mensaje: 'Tipo de identificación 99 no reconocido.' });
    });

    it('tipo vacío → error de requeridos', () => {
      const result = validarIdentificacion('', '1234567890');
      expect(result).toEqual({ valido: false, mensaje: 'Tipo de identificación y número son requeridos.' });
    });

    it('número vacío → error de requeridos', () => {
      const result = validarIdentificacion('05', '');
      expect(result).toEqual({ valido: false, mensaje: 'Tipo de identificación y número son requeridos.' });
    });
  });
});
