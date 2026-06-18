import { describe, it, expect } from 'vitest';
import { xmlBuilder } from '../src/lib/sri-api/xml-builder';

const infoTributariaBase = {
  ambiente: '1',
  tipoEmision: '1',
  razonSocial: 'EMISOR S.A.',
  nombreComercial: 'EMISOR',
  ruc: '0999000000001',
  claveAcceso: '0101202501099000000000110010010000000011234567812',
  codDoc: '01',
  estab: '001',
  ptoEmi: '001',
  secuencial: '000000001',
  dirMatriz: 'Av. Principal 123',
};

describe('xmlBuilder', () => {
  describe('buildFactura()', () => {
    const facturaData = {
      infoTributaria: { ...infoTributariaBase, codDoc: '01' },
      infoFactura: {
        fechaEmision: '01/01/2025',
        dirEstablecimiento: 'Oficina 1',
        obligadoContabilidad: 'SI',
        tipoIdentificacionComprador: '05',
        razonSocialComprador: 'CLIENTE S.A.',
        identificacionComprador: '0999000000002',
        totalSinImpuestos: 100.00,
        totalDescuento: 0.00,
        totalConImpuestos: [
          { codigo: '2', codigoPorcentaje: '4', baseImponible: 100.00, tarifa: 15.00, valor: 15.00 },
        ],
        importeTotal: 115.00,
        moneda: 'USD',
        pagos: [{ formaPago: '01', total: 115.00 }],
      },
      detalles: [
        {
          codigoPrincipal: 'PROD001',
          descripcion: 'Producto de prueba',
          cantidad: 1,
          precioUnitario: 100.00,
          descuento: 0.00,
          precioTotalSinImpuesto: 100.00,
          impuestos: [
            { codigo: '2', codigoPorcentaje: '4', tarifa: 15.00, baseImponible: 100.00, valor: 15.00 },
          ],
        },
      ],
    };

    it('genera un XML con encoding UTF-8', () => {
      const xml = xmlBuilder.buildFactura(facturaData);
      expect(xml).toContain('<?xml version="1.0" encoding="UTF-8"?>');
    });

    it('incluye el tag raíz <factura> con id y version', () => {
      const xml = xmlBuilder.buildFactura(facturaData);
      expect(xml).toContain('<factura');
      expect(xml).toContain('id="comprobante"');
      expect(xml).toContain('version="1.1.0"');
    });

    it('incluye <infoTributaria> con los campos básicos', () => {
      const xml = xmlBuilder.buildFactura(facturaData);
      expect(xml).toContain('<infoTributaria>');
      expect(xml).toContain('<ruc>0999000000001</ruc>');
      expect(xml).toContain('<codDoc>01</codDoc>');
    });

    it('incluye <infoFactura> con datos del comprador', () => {
      const xml = xmlBuilder.buildFactura(facturaData);
      expect(xml).toContain('<infoFactura>');
      expect(xml).toContain('<razonSocialComprador>CLIENTE S.A.</razonSocialComprador>');
    });

    it('incluye <detalles> con los items', () => {
      const xml = xmlBuilder.buildFactura(facturaData);
      expect(xml).toContain('<detalles>');
      expect(xml).toContain('<codigoPrincipal>PROD001</codigoPrincipal>');
    });

    it('incluye <totalConImpuestos> con el desglose de IVA', () => {
      const xml = xmlBuilder.buildFactura(facturaData);
      expect(xml).toContain('<totalConImpuestos>');
      expect(xml).toContain('<valor>15.00</valor>');
    });

    it('incluye <pagos> con forma de pago', () => {
      const xml = xmlBuilder.buildFactura(facturaData);
      expect(xml).toContain('<pagos>');
      expect(xml).toContain('<formaPago>01</formaPago>');
    });
  });

  describe('buildLiquidacionCompra()', () => {
    const liquidacionData = {
      infoTributaria: { ...infoTributariaBase, codDoc: '03' },
      infoLiquidacionCompra: {
        fechaEmision: '01/01/2025',
        obligadoContabilidad: 'SI',
        tipoIdentificacionProveedor: '05',
        razonSocialProveedor: 'PROVEEDOR S.A.',
        identificacionProveedor: '0999000000002',
        totalSinImpuestos: 500.00,
        totalDescuento: 0.00,
      },
      totalConImpuestos: [
        { codigo: '2', codigoPorcentaje: '4', baseImponible: 500.00, tarifa: 15.00, valor: 75.00 },
      ],
      importeTotal: 575.00,
      moneda: 'USD',
      pagos: [{ formaPago: '01', total: 575.00 }],
      detalles: [
        {
          codigoPrincipal: 'SERV001',
          descripcion: 'Servicio profesional',
          cantidad: 1,
          precioUnitario: 500.00,
          descuento: 0.00,
          precioTotalSinImpuesto: 500.00,
          impuestos: [
            { codigo: '2', codigoPorcentaje: '4', tarifa: 15.00, baseImponible: 500.00, valor: 75.00 },
          ],
        },
      ],
    };

    it('genera raíz <liquidacionCompra> con version 1.1.0', () => {
      const xml = xmlBuilder.buildLiquidacionCompra(liquidacionData);
      expect(xml).toContain('<liquidacionCompra');
      expect(xml).toContain('version="1.1.0"');
    });

    it('incluye codDoc="03" en infoTributaria', () => {
      const xml = xmlBuilder.buildLiquidacionCompra(liquidacionData);
      expect(xml).toContain('<codDoc>03</codDoc>');
    });

    it('incluye <infoLiquidacionCompra> con datos del proveedor', () => {
      const xml = xmlBuilder.buildLiquidacionCompra(liquidacionData);
      expect(xml).toContain('<infoLiquidacionCompra>');
      expect(xml).toContain('<identificacionProveedor>0999000000002</identificacionProveedor>');
    });

    it('incluye <totalConImpuestos> fuera de infoLiquidacionCompra', () => {
      const xml = xmlBuilder.buildLiquidacionCompra(liquidacionData);
      expect(xml).toContain('<totalConImpuestos>');
    });

    it('incluye <pagos> con formaPago', () => {
      const xml = xmlBuilder.buildLiquidacionCompra(liquidacionData);
      expect(xml).toContain('<formaPago>01</formaPago>');
    });

    it('incluye reembolsos si se proporcionan en un detalle', () => {
      const data = {
        ...liquidacionData,
        infoLiquidacionCompra: {
          ...liquidacionData.infoLiquidacionCompra,
          codDocReembolso: '41',
        },
        detalles: [
          {
            ...liquidacionData.detalles[0],
            reembolsos: [
              {
                tipoIdentificacionProveedorReembolso: '05',
                identificacionProveedorReembolso: '0999000000003',
                codPaisPagoPorProvReembolso: '0001',
                tipoProvReembolso: '01',
                codDocReembolso: '01',
                estabDocReembolso: '001',
                ptoEmiDocReembolso: '001',
                secuencialDocReembolso: '000000001',
                fechaEmisionDocReembolso: '01/01/2025',
                numeroAutorizacionDocReembolso: '1234567890',
                detalleImpuestos: [
                  { codigo: '2', codigoPorcentaje: '4', baseImponibleReembolso: 100.00, tarifa: 15.00, valorReembolso: 15.00 },
                ],
              },
            ],
          },
        ],
      };
      const xml = xmlBuilder.buildLiquidacionCompra(data);
      expect(xml).toContain('<reembolsos>');
      expect(xml).toContain('<reembolsoDetalle>');
      expect(xml).toContain('<identificacionProveedorReembolso>0999000000003</identificacionProveedorReembolso>');
    });

    it('incluye <maquinaFiscal> si se proporciona', () => {
      const data = {
        ...liquidacionData,
        maquinaFiscal: { marca: 'EPSON', modelo: 'TM-T88', serie: 'SN12345' },
      };
      const xml = xmlBuilder.buildLiquidacionCompra(data);
      expect(xml).toContain('<maquinaFiscal>');
      expect(xml).toContain('<marca>EPSON</marca>');
    });
  });

  describe('buildGuiaRemision()', () => {
    const guiaData = {
      infoTributaria: { ...infoTributariaBase, codDoc: '06' },
      infoGuiaRemision: {
        dirPartida: 'Av. Salida 456',
        razonSocialTransportista: 'TRANSPORTES XYZ',
        tipoIdentificacionTransportista: '05',
        rucTransportista: '1799000000001',
        obligadoContabilidad: 'SI',
        fechaIniTransporte: '01/01/2025',
        fechaFinTransporte: '02/01/2025',
        placa: 'ABC-1234',
      },
      destinatarios: [
        {
          identificacionDestinatario: '0999000000004',
          razonSocialDestinatario: 'DESTINATARIO S.A.',
          dirDestinatario: 'Av. Llegada 789',
          motivoTraslado: 'VENTA',
          codDocSustento: '01',
          numDocSustento: '001-001-000000001',
          numAutDocSustento: '1234567890',
          fechaEmisionDocSustento: '01/01/2025',
          detalles: [
            {
              codigoInterno: 'PROD001',
              descripcion: 'Producto transportado',
              cantidad: 10,
            },
          ],
        },
      ],
    };

    it('genera raíz <guiaRemision> con version 1.1.0', () => {
      const xml = xmlBuilder.buildGuiaRemision(guiaData);
      expect(xml).toContain('<guiaRemision');
      expect(xml).toContain('version="1.1.0"');
    });

    it('incluye codDoc="06" en infoTributaria', () => {
      const xml = xmlBuilder.buildGuiaRemision(guiaData);
      expect(xml).toContain('<codDoc>06</codDoc>');
    });

    it('incluye <infoGuiaRemision> con datos del transportista', () => {
      const xml = xmlBuilder.buildGuiaRemision(guiaData);
      expect(xml).toContain('<infoGuiaRemision>');
      expect(xml).toContain('<rucTransportista>1799000000001</rucTransportista>');
      expect(xml).toContain('<placa>ABC-1234</placa>');
    });

    it('incluye <destinatarios> con destinatario', () => {
      const xml = xmlBuilder.buildGuiaRemision(guiaData);
      expect(xml).toContain('<destinatarios>');
      expect(xml).toContain('<identificacionDestinatario>0999000000004</identificacionDestinatario>');
    });

    it('incluye <detalles> con items transportados dentro de cada destinatario', () => {
      const xml = xmlBuilder.buildGuiaRemision(guiaData);
      expect(xml).toContain('<codigoInterno>PROD001</codigoInterno>');
      expect(xml).toContain('<cantidad>10.000000</cantidad>');
    });

    it('incluye documento de sustento en cada destinatario', () => {
      const xml = xmlBuilder.buildGuiaRemision(guiaData);
      expect(xml).toContain('<codDocSustento>01</codDocSustento>');
      expect(xml).toContain('<numAutDocSustento>1234567890</numAutDocSustento>');
    });
  });

  describe('buildNotaCredito()', () => {
    const ncData = {
      infoTributaria: { ...infoTributariaBase, codDoc: '04' },
      infoNotaCredito: {
        fechaEmision: '01/01/2025',
        tipoIdentificacionComprador: '05',
        razonSocialComprador: 'CLIENTE S.A.',
        identificacionComprador: '0999000000002',
        codDocModificado: '01',
        numDocModificado: '001-001-000000001',
        fechaEmisionDocSustento: '01/12/2024',
        totalSinImpuestos: 100.00,
        valorModificacion: 100.00,
        totalConImpuestos: [
          { codigo: '2', codigoPorcentaje: '4', baseImponible: 100.00, tarifa: 15.00, valor: 15.00 },
        ],
        motivo: 'Devolución total',
      },
      detalles: [
        {
          codigoPrincipal: 'PROD001',
          descripcion: 'Producto devuelto',
          cantidad: 1,
          precioUnitario: 100.00,
          descuento: 0.00,
          precioTotalSinImpuesto: 100.00,
          impuestos: [
            { codigo: '2', codigoPorcentaje: '4', tarifa: 15.00, baseImponible: 100.00, valor: 15.00 },
          ],
        },
      ],
    };

    it('genera raíz <notaCredito>', () => {
      const xml = xmlBuilder.buildNotaCredito(ncData);
      expect(xml).toContain('<notaCredito');
    });

    it('incluye <infoNotaCredito> con motivo', () => {
      const xml = xmlBuilder.buildNotaCredito(ncData);
      expect(xml).toContain('<motivo>Devolución total</motivo>');
    });
  });

  describe('buildRetencion()', () => {
    const retencionData = {
      infoTributaria: { ...infoTributariaBase, codDoc: '07' },
      infoCompRetencion: {
        fechaEmision: '15/01/2025',
        obligadoContabilidad: 'SI',
        tipoIdentificacionSujetoRetenido: '05',
        razonSocialSujetoRetenido: 'PROVEEDOR S.A.',
        identificacionSujetoRetenido: '0999000000002',
        periodoFiscal: '01/2025',
      },
      impuestos: [
        {
          codDocSustento: '01',
          numDocSustento: '001-001-000000050',
          codSustento: '01',
          fechaEmisionDocSustento: '10/01/2025',
          pagoLocExt: '01',
          totalSinImpuestos: 1000.00,
          importeTotal: 1000.00,
          formaPago: '01',
          impuestosDocSustento: [
            { codImpuestoDocSustento: '2', codigoPorcentaje: '4', baseImponible: 1000.00, tarifa: 15.00, valorImpuesto: 150.00 },
          ],
          codigo: '1',
          codigoRetencion: '1',
          baseImponible: 1000.00,
          porcentajeRetener: 1.00,
          valorRetenido: 10.00,
        },
      ],
    };

    it('genera raíz <comprobanteRetencion>', () => {
      const xml = xmlBuilder.buildRetencion(retencionData);
      expect(xml).toContain('<comprobanteRetencion');
    });

    it('incluye <docsSustento> con documento', () => {
      const xml = xmlBuilder.buildRetencion(retencionData);
      expect(xml).toContain('<docsSustento>');
    });
  });

  describe('parseXml()', () => {
    it('parsea un XML string a objeto', async () => {
      const xml = '<root><item id="1">test</item></root>';
      const result = await xmlBuilder.parseXml<any>(xml);
      expect(result.root.item).toBeDefined();
      expect(result.root.item._).toBe('test');
    });
  });
});
