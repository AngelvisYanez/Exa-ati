import { describe, it, expect } from 'vitest';
import { calcularIREmpleado } from '../src/services/nomina/calculos-ir-empleados';
import { calcularNominaEmpleado } from '../src/services/nomina/calculos-nomina';
import { generateF107Xml, generateF107Pdf } from '../src/services/nomina/f107-generator';

describe('Motor de Cálculo de Nómina, IESS y Retenciones IR (Formulario 107)', () => {
  it('calcula correctamente aportes IESS (9.45% ind, 11.15% pat), décimos y liquido a recibir', () => {
    const res = calcularNominaEmpleado({
      cedula: '1712345678',
      nombreCompleto: 'Juan Pérez',
      sueldoBase: 1000,
      diasTrabajados: 30,
      cargasFamiliares: 1,
    });

    expect(res.sueldoGanado).toBe(1000);
    expect(res.aporteIndividualIESS).toBe(94.5);
    expect(res.aportePatronalIESS).toBe(111.5);
    expect(res.decimoTercero).toBe(83.33);
    expect(res.decimoCuarto).toBe(39.17); // 470 / 12
    expect(res.fondosReserva).toBe(83.3);
    expect(res.sueldoNetoAPagar).toBeGreaterThan(800);
  });

  it('calcula la tabla progresiva de IR SRI y aplica la rebaja por cargas familiares', () => {
    const resIR = calcularIREmpleado({
      ingresoAnualBruto: 24000, // $2000 al mes
      aporteIESSAnual: 2268,   // 9.45% de $24000
      cargasFamiliares: 2,     // 11 Canastas Básicas
      gastosPersonales: {
        vivienda: 2000,
        educacion: 2000,
        alimentacion: 3000,
        salud: 2000,
      },
    });

    expect(resIR.baseImponibleAnual).toBe(21732);
    expect(resIR.impuestoCausadoBruto).toBeGreaterThan(0);
    expect(resIR.rebajaGastosPersonales).toBeGreaterThan(0);
    expect(resIR.retencionMensualSugerida).toBeGreaterThanOrEqual(0);
  });

  it('genera correctamente el XML y PDF del Formulario 107 SRI', async () => {
    const f107Data = {
      anioFiscal: 2025,
      emisor: { ruc: '1790000000001', razonSocial: 'EMPRESA DEMO S.A.' },
      empleado: { cedula: '1712345678', nombres: 'JUAN', apellidos: 'PÉREZ' },
      sueldosSalarios301: 12000,
      horasExtrasComisiones303: 500,
      aporteIess351: 1134,
      impuestoRetenido401: 120,
    };

    const xml = generateF107Xml(f107Data);
    expect(xml).toContain('<numRuc>1790000000001</numRuc>');
    expect(xml).toContain('<suelSal>12000.00</suelSal>');
    expect(xml).toContain('<valRet>120.00</valRet>');

    const pdfBuffer = await generateF107Pdf(f107Data);
    expect(pdfBuffer).toBeInstanceOf(Buffer);
    expect(pdfBuffer.length).toBeGreaterThan(1000);
  });
});
