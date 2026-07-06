import { describe, it, expect } from 'vitest';
import {
  parsePeriodo,
  periodoDateBounds,
  validateAts,
  escapeXml,
} from '../src/lib/sri-api/ats';
import type { AtsData, AtsVenta, AtsCompra, AtsRetencion, AtsAnulado } from '../src/lib/sri-api/ats';

describe('parsePeriodo', () => {
  it('parsea 202406 como año 2024 mes 6', () => {
    const result = parsePeriodo(202406);
    expect(result).toEqual({ year: 2024, month: 6 });
  });

  it('parsea 202001 como año 2020 mes 1', () => {
    const result = parsePeriodo(202001);
    expect(result).toEqual({ year: 2020, month: 1 });
  });

  it('parsea 202012 como año 2020 mes 12', () => {
    const result = parsePeriodo(202012);
    expect(result).toEqual({ year: 2020, month: 12 });
  });
});

describe('periodoDateBounds', () => {
  it('retorna primer y último momento de junio 2024', () => {
    const { desde, hasta } = periodoDateBounds(202406);

    expect(desde.getFullYear()).toBe(2024);
    expect(desde.getMonth()).toBe(5); // 0-indexed
    expect(desde.getDate()).toBe(1);
    expect(desde.getHours()).toBe(0);
    expect(desde.getMinutes()).toBe(0);
    expect(desde.getSeconds()).toBe(0);
    expect(desde.getMilliseconds()).toBe(0);

    expect(hasta.getFullYear()).toBe(2024);
    expect(hasta.getMonth()).toBe(5);
    expect(hasta.getDate()).toBe(30);
    expect(hasta.getHours()).toBe(23);
    expect(hasta.getMinutes()).toBe(59);
    expect(hasta.getSeconds()).toBe(59);
    expect(hasta.getMilliseconds()).toBe(999);
  });

  it('retorna primer y último momento de enero 2020', () => {
    const { desde, hasta } = periodoDateBounds(202001);

    expect(desde.getFullYear()).toBe(2020);
    expect(desde.getMonth()).toBe(0);
    expect(desde.getDate()).toBe(1);

    expect(hasta.getFullYear()).toBe(2020);
    expect(hasta.getMonth()).toBe(0);
    expect(hasta.getDate()).toBe(31);
  });
});

describe('escapeXml', () => {
  it('escapa &', () => {
    expect(escapeXml('a & b')).toBe('a &amp; b');
  });

  it('escapa <', () => {
    expect(escapeXml('<tag>')).toBe('&lt;tag&gt;');
  });

  it('escapa >', () => {
    expect(escapeXml('a > b')).toBe('a &gt; b');
  });

  it('escapa "', () => {
    expect(escapeXml('"hola"')).toBe('&quot;hola&quot;');
  });

  it('escapa \'', () => {
    expect(escapeXml("'hola'")).toBe('&apos;hola&apos;');
  });

  it('escapa todos los caracteres especiales simultáneamente', () => {
    const input = '<hello "world" & \'foo\'>';
    const expected = '&lt;hello &quot;world&quot; &amp; &apos;foo&apos;&gt;';
    expect(escapeXml(input)).toBe(expected);
  });

  it('retorna string vacío sin cambios', () => {
    expect(escapeXml('')).toBe('');
  });

  it('retorna texto sin caracteres especiales sin cambios', () => {
    expect(escapeXml('ABC123')).toBe('ABC123');
  });
});

function validAtsData(overrides?: Partial<AtsData>): AtsData {
  return {
    periodo: 202406,
    razonSocial: 'EMPRESA TEST S.A.',
    ruc: '0999999999999',
    establecimientos: [{ codigo: '001', direccion: 'Av. Test' }],
    ventas: [
      {
        tpIdCliente: '05',
        idCliente: '1799999999001',
        razonSocial: 'CLIENTE TEST',
        tipoComprobante: 'FACTURA',
        numeroComprobantes: 1,
        baseImponible: 1000,
        baseNoGraIva: 0,
        montoIva: 120,
        valorRetenidoIva: 0,
        valorRetenidoRenta: 0,
      },
    ],
    compras: [
      {
        tpIdProveedor: '04',
        idProveedor: '1798888888001',
        razonSocial: 'PROVEEDOR TEST',
        tipoComprobante: 'FACTURA',
        numeroComprobantes: 1,
        baseImponible: 500,
        baseNoGraIva: 0,
        montoIva: 60,
        valorRetenidoIva: 0,
        valorRetenidoRenta: 0,
      },
    ],
    retenciones: [],
    anulados: [],
    totalVentas: 1000,
    totalCompras: 500,
    totalRetenciones: 0,
    ...overrides,
  };
}

describe('validateAts', () => {
  it('retorna valido: true con datos correctos', () => {
    const result = validateAts(validAtsData());
    expect(result.valido).toBe(true);
    expect(result.errores).toHaveLength(0);
  });

  it('retorna error si ruc está vacío', () => {
    const result = validateAts(validAtsData({ ruc: '' }));
    expect(result.valido).toBe(false);
    expect(result.errores).toContain('El RUC del contribuyente es requerido (13 dígitos).');
  });

  it('retorna error si ruc no tiene 13 dígitos', () => {
    const result = validateAts(validAtsData({ ruc: '12345' }));
    expect(result.valido).toBe(false);
    expect(result.errores).toContain('El RUC del contribuyente es requerido (13 dígitos).');
  });

  it('retorna error si razón social está vacía', () => {
    const result = validateAts(validAtsData({ razonSocial: '' }));
    expect(result.valido).toBe(false);
    expect(result.errores).toContain('La razón social del contribuyente es requerida.');
  });

  it('retorna error si periodo es menor a 202001', () => {
    const result = validateAts(validAtsData({ periodo: 201912 }));
    expect(result.valido).toBe(false);
    expect(result.errores).toContain('Período fiscal inválido. Debe estar en formato YYYYMM.');
  });

  it('retorna error si periodo es mayor a 999999', () => {
    const result = validateAts(validAtsData({ periodo: 1000000 }));
    expect(result.valido).toBe(false);
    expect(result.errores).toContain('Período fiscal inválido. Debe estar en formato YYYYMM.');
  });

  it('retorna error si no hay establecimientos', () => {
    const result = validateAts(validAtsData({ establecimientos: [] }));
    expect(result.valido).toBe(false);
    expect(result.errores).toContain('Debe existir al menos un establecimiento registrado.');
  });

  it('retorna error si base imponible de venta es negativa', () => {
    const result = validateAts(
      validAtsData({
        ventas: [
          {
            tpIdCliente: '05',
            idCliente: '1799999999001',
            razonSocial: 'CLIENTE TEST',
            tipoComprobante: 'FACTURA',
            numeroComprobantes: 1,
            baseImponible: -100,
            baseNoGraIva: 0,
            montoIva: 0,
            valorRetenidoIva: 0,
            valorRetenidoRenta: 0,
          },
        ],
      }),
    );
    expect(result.valido).toBe(false);
    expect(result.errores).toContain('Base imponible negativa en venta de CLIENTE TEST.');
  });

  it('retorna error si venta no tiene idCliente', () => {
    const result = validateAts(
      validAtsData({
        ventas: [
          {
            tpIdCliente: '05',
            idCliente: '',
            razonSocial: 'CLIENTE TEST',
            tipoComprobante: 'FACTURA',
            numeroComprobantes: 1,
            baseImponible: 100,
            baseNoGraIva: 0,
            montoIva: 12,
            valorRetenidoIva: 0,
            valorRetenidoRenta: 0,
          },
        ],
      }),
    );
    expect(result.valido).toBe(false);
    expect(result.errores).toContain('Una venta no tiene identificación de cliente.');
  });

  it('retorna error si compra no tiene idProveedor', () => {
    const result = validateAts(
      validAtsData({
        compras: [
          {
            tpIdProveedor: '04',
            idProveedor: '',
            razonSocial: 'PROVEEDOR TEST',
            tipoComprobante: 'FACTURA',
            numeroComprobantes: 1,
            baseImponible: 500,
            baseNoGraIva: 0,
            montoIva: 60,
            valorRetenidoIva: 0,
            valorRetenidoRenta: 0,
          },
        ],
      }),
    );
    expect(result.valido).toBe(false);
    expect(result.errores).toContain('Una compra no tiene identificación de proveedor.');
  });

  it('retorna error si base imponible de compra es negativa', () => {
    const result = validateAts(
      validAtsData({
        compras: [
          {
            tpIdProveedor: '04',
            idProveedor: '1798888888001',
            razonSocial: 'PROVEEDOR TEST',
            tipoComprobante: 'FACTURA',
            numeroComprobantes: 1,
            baseImponible: -200,
            baseNoGraIva: 0,
            montoIva: 0,
            valorRetenidoIva: 0,
            valorRetenidoRenta: 0,
          },
        ],
      }),
    );
    expect(result.valido).toBe(false);
    expect(result.errores).toContain('Base imponible negativa en compra de PROVEEDOR TEST.');
  });

  it('acumula múltiples errores simultáneamente', () => {
    const result = validateAts(validAtsData({ ruc: '', razonSocial: '', periodo: 0, establecimientos: [] }));
    expect(result.valido).toBe(false);
    expect(result.errores.length).toBeGreaterThanOrEqual(3);
  });
});
