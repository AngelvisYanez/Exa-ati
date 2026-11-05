import { describe, it, expect } from 'vitest';
import { formatNumero, getFormaPagoLabel, buildQrData, extractRideDataFromParsed, buildRideTotales, facturaRideDeMuestra, renderRidePdf } from '../src/services/sri-api/ride-pdf';
import { DISENO_CLASICO } from '../src/services/sri-api/ride-diseno';

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
    expect(getFormaPagoLabel('01')).toBe('Sin utilización del sistema financiero');
    expect(getFormaPagoLabel('03')).toBe('Tarjeta de crédito');
    expect(getFormaPagoLabel('10')).toBe('Transferencia o depósito');
    expect(getFormaPagoLabel('19')).toBe('Tarjeta de crédito');
  });

  it('retorna fallback para código desconocido', () => {
    expect(getFormaPagoLabel('99')).toBe('Código 99');
  });

  it('usa el catálogo vigente del SRI para crédito y débito', () => {
    expect(getFormaPagoLabel('15')).toBe('Compensación de deudas');
    expect(getFormaPagoLabel('16')).toBe('Tarjeta de débito');
    expect(getFormaPagoLabel('20')).toBe('Otros con utilización del sistema financiero');
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

describe('extractRideDataFromParsed', () => {
  const clave = '0110202601179000000000110010010000001231234567811';

  it('arma la factura con comprador, impuestos, propina, pago e información adicional', () => {
    const data = extractRideDataFromParsed({
      factura: {
        infoTributaria: {
          ambiente: '1',
          tipoEmision: '1',
          razonSocial: 'OFSERCONT CIA. LTDA.',
          nombreComercial: 'OFSERCONT',
          ruc: '1790000000001',
          claveAcceso: clave,
          estab: '001',
          ptoEmi: '001',
          secuencial: '000000123',
          dirMatriz: 'Av. Amazonas N34-120',
          agenteRetencion: '1',
          contribuyenteRimpe: 'CONTRIBUYENTE RÉGIMEN RIMPE',
        },
        infoFactura: {
          fechaEmision: '01/10/2026',
          dirEstablecimiento: 'Av. República y Amazonas',
          contribuyenteEspecial: '123',
          obligadoContabilidad: 'SI',
          tipoIdentificacionComprador: '04',
          guiaRemision: '001-001-000000045',
          razonSocialComprador: 'CLIENTE DEMO S.A.',
          identificacionComprador: '0990000000001',
          direccionComprador: 'Quito, Ecuador',
          totalSinImpuestos: '100.00',
          totalDescuento: '5.00',
          totalConImpuestos: {
            totalImpuesto: [
              { codigo: '2', codigoPorcentaje: '4', tarifa: '15.00', baseImponible: '100.00', valor: '15.00' },
              { codigo: '2', codigoPorcentaje: '0', tarifa: '0.00', baseImponible: '0.00', valor: '0.00' },
            ],
          },
          propina: '0.00',
          importeTotal: '115.00',
          moneda: 'DOLAR',
          pagos: { pago: { formaPago: '20', total: '115.00', plazo: '30', unidadTiempo: 'dias' } },
        },
        detalles: {
          detalle: {
            codigoPrincipal: 'SERV-01',
            codigoAuxiliar: 'AUX-9',
            descripcion: 'Honorarios contables',
            cantidad: '1.00',
            precioUnitario: '100.00',
            descuento: '5.00',
            precioTotalSinImpuesto: '95.00',
            detallesAdicionales: { detAdicional: { $: { nombre: 'Periodo', valor: 'Septiembre 2026' } } },
          },
        },
        infoAdicional: {
          campoAdicional: { $: { nombre: 'Email' }, _: 'cliente@demo.com' },
        },
      },
    });

    expect(data.comprobante.numeroCompleto).toBe('001-001-000000123');
    expect(data.comprador.razonSocial).toBe('CLIENTE DEMO S.A.');
    expect(data.comprador.identificacion).toBe('0990000000001');
    expect(data.emisor.obligadoContabilidad).toBe('SI');
    expect(data.emisor.contribuyenteEspecial).toBe('123');
    expect(data.emisor.rimpe).toContain('RIMPE');
    expect(data.detalles[0].codigoAuxiliar).toBe('AUX-9');
    expect(data.detalles[0].detalleAdicional).toBe('Periodo: Septiembre 2026');
    expect(data.infoAdicional).toEqual([{ nombre: 'Email', valor: 'cliente@demo.com' }]);
    expect(data.formasPago[0]).toMatchObject({ forma: '20', plazo: '30', valor: 115 });
    expect(data.propina).toBe(0);
    expect(data.referencias.map((campo) => campo.nombre)).toContain('Guía de remisión');

    const totales = buildRideTotales(data).map((line) => line.label);
    expect(totales).toContain('SUBTOTAL 15%');
    expect(totales).toContain('SUBTOTAL 0%');
    expect(totales).toContain('IVA 15%');
    expect(totales).toContain('PROPINA');
    expect(totales.at(-1)).toBe('VALOR TOTAL');
  });
});

describe('renderRidePdf', () => {
  it('genera un PDF por cada plantilla', async () => {
    const sample = facturaRideDeMuestra();
    for (const plantilla of ['clasico', 'compacto', 'banda'] as const) {
      const pdf = await renderRidePdf(sample, { ...DISENO_CLASICO, codigo: plantilla, plantilla });
      expect(pdf.subarray(0, 5).toString()).toBe('%PDF-');
    }
  });

  it('acepta un color fijo', async () => {
    const pdf = await renderRidePdf(facturaRideDeMuestra(), {
      ...DISENO_CLASICO,
      colorModo: 'fijo',
      colorHex: '#0f3d2e',
    });
    expect(pdf.length).toBeGreaterThan(1000);
  });
});
