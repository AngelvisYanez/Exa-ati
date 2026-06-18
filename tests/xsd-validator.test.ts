import { describe, it, expect } from 'vitest';
import { xsdValidator } from '../src/lib/sri-api/xsd-validator';

const validFactura = {
  factura: {
    $: { id: 'comprobante', version: '1.1.0' },
    infoTributaria: {
      ambiente: '1', tipoEmision: '1', razonSocial: 'EMISOR S.A.',
      ruc: '0999000000001', claveAcceso: '0101202501099000000000110010010000000011234567812',
      codDoc: '01', estab: '001', ptoEmi: '001', secuencial: '000000001',
      dirMatriz: 'Av. Principal 123',
    },
    infoFactura: {
      fechaEmision: '01/01/2025', obligadoContabilidad: 'SI',
      tipoIdentificacionComprador: '05', razonSocialComprador: 'CLIENTE S.A.',
      identificacionComprador: '0999000000002', totalSinImpuestos: '100.00',
      totalDescuento: '0.00', importeTotal: '115.00',
      totalConImpuestos: {
        totalImpuesto: [{ codigo: '2', codigoPorcentaje: '4', baseImponible: '100.00', valor: '15.00' }],
      },
      pagos: { pago: [{ formaPago: '01', total: '115.00' }] },
    },
    detalles: {
      detalle: [{
        codigoPrincipal: 'PROD001', descripcion: 'Producto', cantidad: '1.000000',
        precioUnitario: '100.000000', descuento: '0.00', precioTotalSinImpuesto: '100.00',
        impuestos: { impuesto: [{ codigo: '2', codigoPorcentaje: '4', baseImponible: '100.00', tarifa: '15.00', valor: '15.00' }] },
      }],
    },
  },
};

const validNotaDebito = {
  notaDebito: {
    $: { id: 'comprobante', version: '1.0.0' },
    infoTributaria: {
      ambiente: '1', tipoEmision: '1', razonSocial: 'EMISOR S.A.',
      ruc: '0999000000001', claveAcceso: '0101202501099000000000110010010000000011234567812',
      codDoc: '05', estab: '001', ptoEmi: '001', secuencial: '000000001',
      dirMatriz: 'Av. Principal 123',
    },
    infoNotaDebito: {
      fechaEmision: '15/01/2025', tipoIdentificacionComprador: '05',
      razonSocialComprador: 'CLIENTE S.A.', identificacionComprador: '0999000000002',
      obligadoContabilidad: 'SI', codDocModificado: '01',
      numDocModificado: '001-001-000000050', fechaEmisionDocSustento: '10/01/2025',
      totalSinImpuestos: '500.00', valorTotal: '575.00',
    },
    impuestos: {
      impuesto: [{ codigo: '2', codigoPorcentaje: '4', baseImponible: '500.00', tarifa: '15.00', valor: '75.00' }],
    },
    motivos: {
      motivo: [{ razon: 'Interés por mora', valor: '50.00' }],
    },
  },
};

describe('xsdValidator', () => {
  describe('detectTipo()', () => {
    it('detecta factura (01)', () => {
      expect(xsdValidator.detectTipo(validFactura)).toBe('01');
    });

    it('detecta notaDebito (05)', () => {
      expect(xsdValidator.detectTipo(validNotaDebito)).toBe('05');
    });

    it('retorna null para objeto vacío', () => {
      expect(xsdValidator.detectTipo({})).toBeNull();
    });
  });

  describe('validate()', () => {
    it('valida factura válida', () => {
      const result = xsdValidator.validate(validFactura);
      expect(result.valid).toBe(true);
      expect(result.tipo).toBe('01');
      expect(result.errors).toHaveLength(0);
    });

    it('valida nota de débito válida', () => {
      const result = xsdValidator.validate(validNotaDebito);
      expect(result.valid).toBe(true);
      expect(result.tipo).toBe('05');
    });

    it('reporta error para factura sin infoFactura', () => {
      const obj = { factura: { $: { id: 'comprobante', version: '1.1.0' }, infoTributaria: { ...validFactura.factura.infoTributaria } } };
      const result = xsdValidator.validate(obj);
      expect(result.valid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
      expect(result.errors[0].path).toContain('infoFactura');
    });

    it('reporta error para NotaDebito sin motivos', () => {
      const obj = {
        notaDebito: { ...validNotaDebito.notaDebito, motivos: undefined },
      };
      const result = xsdValidator.validate(obj);
      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.path.includes('motivos'))).toBe(true);
    });

    it('reporta error para NotaDebito sin impuestos', () => {
      const obj = {
        notaDebito: { ...validNotaDebito.notaDebito, impuestos: undefined },
      };
      const result = xsdValidator.validate(obj);
      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.path.includes('impuestos'))).toBe(true);
    });

    it('reporta error para factura sin detalles', () => {
      const obj = {
        factura: { ...validFactura.factura, detalles: undefined },
      };
      const result = xsdValidator.validate(obj);
      expect(result.valid).toBe(false);
    });

    it('reporta warning por versión incorrecta', () => {
      const obj = {
        notaDebito: {
          ...validNotaDebito.notaDebito,
          $: { id: 'comprobante', version: '2.0.0' },
        },
      };
      const result = xsdValidator.validate(obj);
      expect(result.warnings.length).toBeGreaterThan(0);
      expect(result.warnings[0].message).toContain('Versión');
    });

    it('retorna error para tipo no soportado', () => {
      const result = xsdValidator.validate({ foo: {} });
      expect(result.valid).toBe(false);
    });
  });

  describe('validateXml()', () => {
    it('valida XML string que parsea correctamente', async () => {
      const xml = '<?xml version="1.0" encoding="UTF-8"?><notaDebito id="comprobante" version="1.0.0"><infoTributaria><ambiente>1</ambiente><tipoEmision>1</tipoEmision><razonSocial>EMISOR S.A.</razonSocial><ruc>0999000000001</ruc><claveAcceso>0101202501099000000000110010010000000011234567812</claveAcceso><codDoc>05</codDoc><estab>001</estab><ptoEmi>001</ptoEmi><secuencial>000000001</secuencial><dirMatriz>Av. Principal 123</dirMatriz></infoTributaria><infoNotaDebito><fechaEmision>15/01/2025</fechaEmision><tipoIdentificacionComprador>05</tipoIdentificacionComprador><razonSocialComprador>C</razonSocialComprador><identificacionComprador>0999000000002</identificacionComprador><obligadoContabilidad>SI</obligadoContabilidad><codDocModificado>01</codDocModificado><numDocModificado>001-001-000000050</numDocModificado><fechaEmisionDocSustento>10/01/2025</fechaEmisionDocSustento><totalSinImpuestos>500.00</totalSinImpuestos><valorTotal>575.00</valorTotal></infoNotaDebito><impuestos><impuesto><codigo>2</codigo><codigoPorcentaje>4</codigoPorcentaje><baseImponible>500.00</baseImponible><valor>75.00</valor></impuesto></impuestos><motivos><motivo><razon>Interés</razon><valor>50.00</valor></motivo></motivos></notaDebito>';
      const result = await xsdValidator.validateXml(xml);
      expect(result.tipo).toBe('05');
    });

    it('retorna error para XML inválido', async () => {
      const result = await xsdValidator.validateXml('not xml');
      expect(result.valid).toBe(false);
      expect(result.errors[0].message).toContain('Error de parseo');
    });
  });

  describe('getSoportedTipos()', () => {
    it('retorna todos los 6 tipos', () => {
      const tipos = xsdValidator.getSoportedTipos();
      expect(tipos).toHaveLength(6);
      const cods = tipos.map(t => t.codigo);
      expect(cods).toContain('01');
      expect(cods).toContain('05');
      expect(cods).toContain('06');
    });
  });
});
