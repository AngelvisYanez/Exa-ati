import { describe, it, expect, vi, beforeEach } from 'vitest';

const { mockClient, mockCreateClient } = vi.hoisted(() => {
  const client = {
    validarComprobanteAsync: vi.fn(),
    autorizacionComprobanteAsync: vi.fn(),
    setEndpoint: vi.fn(),
    setSecurity: vi.fn(() => {}),
  };
  return {
    mockClient: client,
    mockCreateClient: vi.fn(() => Promise.resolve(client)),
  };
});

vi.mock('soap', () => {
  function ClientSSLSecurity() { return {}; }
  return {
    createClientAsync: () => mockCreateClient(),
    ClientSSLSecurity,
  };
});

vi.mock('../src/lib/sri-api/config', () => ({
  config: { sri: { wsdl: { reception: '', authorization: '' } } },
}));

beforeEach(() => {
  vi.clearAllMocks();
});

describe('sriSoapClient', () => {
  describe('autorizarComprobante', () => {
    it('retorna autorización exitosa', async () => {
      const { sriSoapClient } = await import('../src/lib/sri-api/sri-soap-client');

      mockClient.autorizacionComprobanteAsync.mockResolvedValue([
        {
          RespuestaAutorizacionComprobante: {
            claveAccesoConsultada: '0101202501099000000000110010010000000011234567812',
            numeroComprobantes: '1',
            autorizaciones: {
              autorizacion: {
                estado: 'AUTORIZADO',
                numeroAutorizacion: '1234567890',
                fechaAutorizacion: '2025-01-01T12:00:00Z',
                comprobante: '<xml>autorizado</xml>',
              },
            },
          },
        },
      ]);

      const result = await sriSoapClient.autorizarComprobante(
        '0101202501099000000000110010010000000011234567812'
      );
      expect(result.autorizaciones.autorizacion.estado).toBe('AUTORIZADO');
      expect(result.autorizaciones.autorizacion.numeroAutorizacion).toBe('1234567890');
    });

    it('retorna respuesta con error si SOAP falla todos los reintentos', { timeout: 15000 }, async () => {
      const { sriSoapClient } = await import('../src/lib/sri-api/sri-soap-client');

      mockClient.autorizacionComprobanteAsync.mockRejectedValue(
        new Error('Connection timeout')
      );

      const result = await sriSoapClient.autorizarComprobante(
        '0101202501099000000000110010010000000011234567812'
      );
      expect(result.autorizaciones.autorizacion.estado).toBe('EN PROCESO');
      expect(result.autorizaciones.autorizacion.mensajes.mensaje.identificador).toBe('ERROR');
    });
  });

  describe('enviarYAutorizar', () => {
    it('flujo completo: recibe XML y autoriza', async () => {
      const { sriSoapClient } = await import('../src/lib/sri-api/sri-soap-client');

      mockClient.validarComprobanteAsync.mockResolvedValue([
        {
          RespuestaRecepcionComprobante: {
            estado: 'RECIBIDA',
          },
        },
      ]);
      mockClient.autorizacionComprobanteAsync.mockResolvedValue([
        {
          RespuestaAutorizacionComprobante: {
            claveAccesoConsultada: '0101202501099000000000110010010000000011234567812',
            numeroComprobantes: '1',
            autorizaciones: {
              autorizacion: {
                estado: 'AUTORIZADO',
                numeroAutorizacion: '1234567890',
                fechaAutorizacion: '2025-01-01T12:00:00Z',
                comprobante: '<xml>autorizado</xml>',
              },
            },
          },
        },
      ]);

      const result = await sriSoapClient.enviarYAutorizar(
        '<xml>firmado</xml>',
        '0101202501099000000000110010010000000011234567812'
      );
      expect(result.estado).toBe('AUTORIZADO');
      expect(result.success).toBe(true);
    });

    it('retorna DUPLICADO si error 43 en recepción', async () => {
      const { sriSoapClient } = await import('../src/lib/sri-api/sri-soap-client');

      mockClient.validarComprobanteAsync.mockResolvedValue([
        {
          RespuestaRecepcionComprobante: {
            estado: 'DEVUELTA',
            comprobantes: {
              comprobante: {
                mensajes: {
                  mensaje: { identificador: '43', mensaje: 'Clave registrada', tipo: 'ERROR' },
                },
              },
            },
          },
        },
      ]);

      const result = await sriSoapClient.enviarYAutorizar(
        '<xml>firmado</xml>',
        '0101202501099000000000110010010000000011234567812'
      );
      expect(result.estado).toBe('DUPLICADO');
      expect(result.success).toBe(false);
    });

    it('retorna DOCUMENTO_INVALIDO si error 35 en recepción', async () => {
      const { sriSoapClient } = await import('../src/lib/sri-api/sri-soap-client');

      mockClient.validarComprobanteAsync.mockResolvedValue([
        {
          RespuestaRecepcionComprobante: {
            estado: 'DEVUELTA',
            comprobantes: {
              comprobante: {
                mensajes: {
                  mensaje: { identificador: '35', mensaje: 'Documento inválido', tipo: 'ERROR' },
                },
              },
            },
          },
        },
      ]);

      const result = await sriSoapClient.enviarYAutorizar(
        '<xml>firmado</xml>',
        '0101202501099000000000110010010000000011234567812'
      );
      expect(result.estado).toBe('DOCUMENTO_INVALIDO');
      expect(result.success).toBe(false);
    });

    it('retorna EN_PROCESO si error 70 en autorización', async () => {
      const { sriSoapClient } = await import('../src/lib/sri-api/sri-soap-client');

      mockClient.validarComprobanteAsync.mockResolvedValue([
        {
          RespuestaRecepcionComprobante: {
            estado: 'RECIBIDA',
          },
        },
      ]);
      mockClient.autorizacionComprobanteAsync.mockResolvedValue([
        {
          RespuestaAutorizacionComprobante: {
            autorizaciones: {
              autorizacion: {
                estado: 'EN PROCESO',
                mensajes: {
                  mensaje: { identificador: '70', mensaje: 'Clave acceso en procesamiento', tipo: 'ERROR' },
                },
              },
            },
          },
        },
      ]);

      const result = await sriSoapClient.enviarYAutorizar(
        '<xml>firmado</xml>',
        '0101202501099000000000110010010000000011234567812'
      );
      expect(result.estado).toBe('EN_PROCESO');
      expect(result.success).toBe(false);
    });
  });
});
