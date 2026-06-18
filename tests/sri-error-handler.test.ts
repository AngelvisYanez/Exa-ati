import { describe, it, expect } from 'vitest';
import {
  classifySriError,
  classifyAllSriErrors,
  isSriErrorCode,
} from '../src/lib/sri-api/sri-error-handler';
import type { SriMensaje } from '../src/lib/sri-api/sri-soap-client';

function makeMensaje(identificador: string, mensaje: string, tipo = 'ERROR', informacionAdicional?: string): SriMensaje {
  return { identificador, mensaje, tipo, informacionAdicional };
}

describe('sriErrorHandler', () => {
  describe('classifySriError()', () => {
    it('retorna null si no hay mensajes', () => {
      expect(classifySriError([], 'recepcion')).toBeNull();
    });

    it('clasifica error 35 como DOCUMENTO_INVALIDO', () => {
      const result = classifySriError([makeMensaje('35', 'Documento inválido')], 'recepcion');
      expect(result).not.toBeNull();
      expect(result!.tipo).toBe('DOCUMENTO_INVALIDO');
      expect(result!.codigo).toBe('35');
      expect(result!.accion).toBe('CORREGIR_XML');
    });

    it('clasifica error 43 como DUPLICADO', () => {
      const result = classifySriError([makeMensaje('43', 'Clave de acceso registrada')], 'recepcion');
      expect(result!.tipo).toBe('DUPLICADO');
      expect(result!.codigo).toBe('43');
      expect(result!.accion).toBe('CONSULTAR');
    });

    it('clasifica error 70 como EN_PROCESO', () => {
      const result = classifySriError([makeMensaje('70', 'Clave de acceso en procesamiento')], 'autorizacion');
      expect(result!.tipo).toBe('EN_PROCESO');
      expect(result!.codigo).toBe('70');
      expect(result!.accion).toBe('POLLING');
    });

    it('clasifica el primer error coincidente', () => {
      const mensajes = [
        makeMensaje('35', 'Documento inválido'),
        makeMensaje('43', 'Clave de acceso registrada'),
      ];
      const result = classifySriError(mensajes, 'recepcion');
      expect(result!.codigo).toBe('35');
    });

    it('retorna null si ningún código coincide', () => {
      const result = classifySriError([makeMensaje('99', 'Error genérico')], 'recepcion');
      expect(result).toBeNull();
    });

    it('retorna null para mensajes sin identificador', () => {
      const result = classifySriError([makeMensaje('', 'Error sin código')], 'recepcion');
      expect(result).toBeNull();
    });
  });

  describe('classifyAllSriErrors()', () => {
    it('retorna array vacío si no hay mensajes', () => {
      expect(classifyAllSriErrors([], 'recepcion')).toHaveLength(0);
    });

    it('clasifica todos los mensajes incluyendo códigos desconocidos como RECHAZADO', () => {
      const mensajes = [
        makeMensaje('35', 'Documento inválido'),
        makeMensaje('99', 'Error desconocido'),
        makeMensaje('70', 'En procesamiento'),
      ];
      const results = classifyAllSriErrors(mensajes, 'autorizacion');
      expect(results).toHaveLength(3);
      expect(results[0].tipo).toBe('DOCUMENTO_INVALIDO');
      expect(results[1].tipo).toBe('RECHAZADO');
      expect(results[1].accion).toBe('REINTENTAR');
      expect(results[2].tipo).toBe('EN_PROCESO');
    });
  });

  describe('isSriErrorCode()', () => {
    it('retorna true si el código existe en los mensajes', () => {
      const mensajes = [makeMensaje('35', 'Documento inválido')];
      expect(isSriErrorCode(mensajes, '35')).toBe(true);
    });

    it('retorna false si el código no existe', () => {
      const mensajes = [makeMensaje('35', 'Documento inválido')];
      expect(isSriErrorCode(mensajes, '43')).toBe(false);
    });

    it('retorna false si no hay mensajes', () => {
      expect(isSriErrorCode([], '35')).toBe(false);
    });
  });
});
