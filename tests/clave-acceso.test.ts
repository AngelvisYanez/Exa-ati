import { describe, it, expect } from 'vitest';
import { claveAccesoService, Ambiente, TipoEmision } from '../src/lib/sri-api/clave-acceso';

describe('claveAccesoService', () => {
  const validInput = {
    fechaEmision: new Date(2025, 0, 1),
    tipoComprobante: '01',
    ruc: '0999000000001',
    ambiente: Ambiente.PRUEBAS,
    establecimiento: '001',
    puntoEmision: '001',
    secuencial: '000000001',
    codigoNumerico: '12345678',
    tipoEmision: TipoEmision.NORMAL,
  };

  describe('generate()', () => {
    it('genera una clave de 49 dígitos numéricos', () => {
      const clave = claveAccesoService.generate(validInput);
      expect(clave).toHaveLength(49);
      expect(/^\d{49}$/.test(clave)).toBe(true);
    });

    it('incluye la fecha formateada como DDMMAAAA al inicio', () => {
      const clave = claveAccesoService.generate(validInput);
      expect(clave.substring(0, 8)).toBe('01012025');
    });

    it('incluye el tipo de comprobante en posiciones 8-10', () => {
      const clave = claveAccesoService.generate(validInput);
      expect(clave.substring(8, 10)).toBe('01');
    });

    it('incluye el RUC de 13 dígitos en posiciones 10-23', () => {
      const clave = claveAccesoService.generate(validInput);
      expect(clave.substring(10, 23)).toBe('0999000000001');
    });

    it('incluye el ambiente en posición 23', () => {
      const clave = claveAccesoService.generate(validInput);
      expect(clave.charAt(23)).toBe('1');
    });

    it('incluye establecimiento (3d) + puntoEmision (3d) + secuencial (9d)', () => {
      const clave = claveAccesoService.generate(validInput);
      expect(clave.substring(24, 27)).toBe('001');
      expect(clave.substring(27, 30)).toBe('001');
      expect(clave.substring(30, 39)).toBe('000000001');
    });

    it('incluye código numérico de 8 dígitos en posiciones 39-47', () => {
      const clave = claveAccesoService.generate(validInput);
      expect(clave.substring(39, 47)).toBe('12345678');
    });

    it('incluye tipo de emisión en posición 47', () => {
      const clave = claveAccesoService.generate(validInput);
      expect(clave.charAt(47)).toBe('1');
    });

    it('calcula el dígito verificador (módulo 11) en la última posición', () => {
      const clave = claveAccesoService.generate(validInput);
      const digito = parseInt(clave.charAt(48), 10);
      expect(digito).toBeGreaterThanOrEqual(0);
      expect(digito).toBeLessThanOrEqual(9);
    });

    it('genera código numérico aleatorio si no se provee', () => {
      const input = { ...validInput, codigoNumerico: undefined };
      const clave1 = claveAccesoService.generate(input);
      const clave2 = claveAccesoService.generate(input);
      expect(clave1.substring(39, 47)).not.toBe(clave2.substring(39, 47));
    });

    it('usa ambiente PRUEBAS por defecto', () => {
      const input = { ...validInput, ambiente: undefined };
      const clave = claveAccesoService.generate(input as any);
      expect(clave.charAt(23)).toBe('1');
    });

    it('usa tipo EMISION NORMAL por defecto', () => {
      const input = { ...validInput, tipoEmision: undefined };
      const clave = claveAccesoService.generate(input as any);
      expect(clave.charAt(47)).toBe('1');
    });

    it('lanza error si el RUC no tiene 13 dígitos', () => {
      const input = { ...validInput, ruc: '12345' };
      expect(() => claveAccesoService.generate(input)).toThrow('RUC inválido');
    });

    it('limpia caracteres no numéricos del RUC', () => {
      const input = { ...validInput, ruc: '0999-0000-00001' };
      const clave = claveAccesoService.generate(input);
      expect(clave.substring(10, 23)).toBe('0999000000001');
    });
  });

  describe('validate()', () => {
    it('valida una clave correcta de 49 dígitos', () => {
      const clave = claveAccesoService.generate(validInput);
      expect(claveAccesoService.validate(clave)).toBe(true);
    });

    it('rechaza clave con menos de 49 dígitos', () => {
      expect(claveAccesoService.validate('010120250109900000000011001001000000001123456781')).toBe(false);
    });

    it('rechaza clave con caracteres no numéricos', () => {
      expect(claveAccesoService.validate('01012025010990000000001100100100000000112345678AX')).toBe(false);
    });

    it('rechaza clave con dígito verificador incorrecto', () => {
      const clave = claveAccesoService.generate(validInput);
      const digitoOriginal = parseInt(clave.charAt(48), 10);
      const digitoFalso = digitoOriginal === 0 ? 1 : 0;
      const claveInvalida = clave.substring(0, 48) + digitoFalso;
      expect(claveAccesoService.validate(claveInvalida)).toBe(false);
    });
  });

  describe('parse()', () => {
    it('parsea una clave válida extrayendo todos los campos', () => {
      const clave = claveAccesoService.generate(validInput);
      const parsed = claveAccesoService.parse(clave);
      expect(parsed).not.toBeNull();
      expect(parsed!.tipoComprobante).toBe('01');
      expect(parsed!.ruc).toBe('0999000000001');
      expect(parsed!.ambiente).toBe('1');
      expect(parsed!.establecimiento).toBe('001');
      expect(parsed!.puntoEmision).toBe('001');
      expect(parsed!.secuencial).toBe('000000001');
      expect(parsed!.codigoNumerico).toBe('12345678');
      expect(parsed!.tipoEmision).toBe('1');
    });

    it('retorna null para clave inválida', () => {
      expect(claveAccesoService.parse('01012025010990000000001100100100000000112345678')).toBeNull();
    });

    it('parsea correctamente la fecha de emisión', () => {
      const clave = claveAccesoService.generate(validInput);
      const parsed = claveAccesoService.parse(clave);
      expect(parsed!.fechaEmision.getFullYear()).toBe(2025);
      expect(parsed!.fechaEmision.getMonth()).toBe(0);
      expect(parsed!.fechaEmision.getDate()).toBe(1);
    });
  });

  describe('algoritmo Módulo 11', () => {
    it('verifica el cálculo del dígito verificador con factor ponderado 2', () => {
      const clave = claveAccesoService.generate(validInput);
      expect(claveAccesoService.validate(clave)).toBe(true);
    });

    it('funciona para ambiente PRODUCCION', () => {
      const input = { ...validInput, ambiente: Ambiente.PRODUCCION };
      const clave = claveAccesoService.generate(input);
      expect(clave.charAt(23)).toBe('2');
      expect(claveAccesoService.validate(clave)).toBe(true);
    });

    it('funciona para tipo EMISION CONTINGENCIA', () => {
      const input = { ...validInput, tipoEmision: TipoEmision.CONTINGENCIA };
      const clave = claveAccesoService.generate(input);
      expect(clave.charAt(47)).toBe('2');
      expect(claveAccesoService.validate(clave)).toBe(true);
    });

    it('funciona para Liquidación de Compra (03)', () => {
      const input = { ...validInput, tipoComprobante: '03' };
      const clave = claveAccesoService.generate(input);
      expect(clave.substring(8, 10)).toBe('03');
      expect(claveAccesoService.validate(clave)).toBe(true);
    });

    it('funciona para Guía de Remisión (06)', () => {
      const input = { ...validInput, tipoComprobante: '06' };
      const clave = claveAccesoService.generate(input);
      expect(clave.substring(8, 10)).toBe('06');
      expect(claveAccesoService.validate(clave)).toBe(true);
    });

    it('funciona para Comprobante de Retención (07)', () => {
      const input = { ...validInput, tipoComprobante: '07' };
      const clave = claveAccesoService.generate(input);
      expect(clave.substring(8, 10)).toBe('07');
      expect(claveAccesoService.validate(clave)).toBe(true);
    });

    it('funciona para Nota de Crédito (04)', () => {
      const input = { ...validInput, tipoComprobante: '04' };
      const clave = claveAccesoService.generate(input);
      expect(clave.substring(8, 10)).toBe('04');
      expect(claveAccesoService.validate(clave)).toBe(true);
    });

    it('funciona para Nota de Débito (05)', () => {
      const input = { ...validInput, tipoComprobante: '05' };
      const clave = claveAccesoService.generate(input);
      expect(clave.substring(8, 10)).toBe('05');
      expect(claveAccesoService.validate(clave)).toBe(true);
    });
  });
});
