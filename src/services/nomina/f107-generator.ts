import { BrandPdf } from '@/services/pdf/layout';
import { GastosPersonales } from './calculos-ir-empleados';

export interface Formulario107Data {
  anioFiscal: number;
  emisor: {
    ruc: string;
    razonSocial: string;
    nombreComercial?: string | null;
  };
  empleado: {
    cedula: string;
    nombres: string;
    apellidos: string;
    cargasFamiliares?: number;
  };
  sueldosSalarios301: number;
  horasExtrasComisiones303: number;
  utilidades305?: number;
  aporteIess351: number;
  gastosPersonales?: GastosPersonales;
  impuestoRetenido401: number;
}

export function generateF107Xml(data: Formulario107Data): string {
  const { anioFiscal, emisor, empleado } = data;
  const totalIngresos = data.sueldosSalarios301 + data.horasExtrasComisiones303 + (data.utilidades305 ?? 0);
  const gp = data.gastosPersonales || {};

  return `<?xml version="1.0" encoding="UTF-8"?>
<rdep>
  <numRuc>${emisor.ruc}</numRuc>
  <anio>${anioFiscal}</anio>
  <empleado>
    <tipIdRet>C</tipIdRet>
    <idRet>${empleado.cedula}</idRet>
    <nomEmp>${empleado.apellidos} ${empleado.nombres}</nomEmp>
    <suelSal>${data.sueldosSalarios301.toFixed(2)}</suelSal>
    <overTime>${data.horasExtrasComisiones303.toFixed(2)}</overTime>
    <utilidades>${(data.utilidades305 ?? 0).toFixed(2)}</utilidades>
    <valRet>${data.impuestoRetenido401.toFixed(2)}</valRet>
    <aprotPers>${data.aporteIess351.toFixed(2)}</aprotPers>
    <vivienda>${(gp.vivienda ?? 0).toFixed(2)}</vivienda>
    <salud>${(gp.salud ?? 0).toFixed(2)}</salud>
    <educacion>${(gp.educacion ?? 0).toFixed(2)}</educacion>
    <alimentacion>${(gp.alimentacion ?? 0).toFixed(2)}</alimentacion>
    <vestimenta>${(gp.vestimenta ?? 0).toFixed(2)}</vestimenta>
  </empleado>
</rdep>`;
}

export async function generateF107Pdf(data: Formulario107Data): Promise<Buffer> {
  const pdf = await BrandPdf.create({
    ruc: data.emisor.ruc,
    razonSocial: data.emisor.razonSocial,
    nombreComercial: data.emisor.nombreComercial,
  });
  const money = (value: number) => `$ ${value.toFixed(2)}`;

  pdf.drawHeader({
    documentTitle: 'Formulario 107',
    subtitle: `Retención en la fuente del impuesto a la renta · año ${data.anioFiscal}`,
    badge: String(data.anioFiscal),
  });

  pdf.drawPanels(
    {
      title: 'EMPLEADOR',
      lines: [
        { label: 'RUC', value: data.emisor.ruc },
        { label: 'Razón social', value: data.emisor.razonSocial },
      ],
    },
    {
      title: 'TRABAJADOR',
      lines: [
        { label: 'Cédula / pasaporte', value: data.empleado.cedula },
        { label: 'Apellidos y nombres', value: `${data.empleado.apellidos} ${data.empleado.nombres}` },
      ],
    }
  );

  pdf.drawSectionTitle('Casilleros');
  const casilleros = [
    { code: '301', label: 'Sueldos y salarios', val: data.sueldosSalarios301 },
    { code: '303', label: 'Sobresueldos, horas extras y comisiones', val: data.horasExtrasComisiones303 },
    { code: '305', label: 'Participación de utilidades', val: data.utilidades305 ?? 0 },
    { code: '351', label: 'Aporte personal al IESS', val: data.aporteIess351 },
    { code: '361', label: 'Gastos personales — vivienda', val: data.gastosPersonales?.vivienda ?? 0 },
    { code: '363', label: 'Gastos personales — educación', val: data.gastosPersonales?.educacion ?? 0 },
    { code: '365', label: 'Gastos personales — salud', val: data.gastosPersonales?.salud ?? 0 },
    { code: '367', label: 'Gastos personales — vestimenta', val: data.gastosPersonales?.vestimenta ?? 0 },
    { code: '369', label: 'Gastos personales — alimentación', val: data.gastosPersonales?.alimentacion ?? 0 },
    { code: '401', label: 'Impuesto a la renta retenido', val: data.impuestoRetenido401 },
  ];

  pdf.drawTable(
    [
      { header: 'Casillero', width: 70 },
      { header: 'Concepto', width: pdf.contentWidth - 160 },
      { header: 'Valor', width: 90, align: 'right' },
    ],
    casilleros.map((c) => [c.code, c.label, money(c.val)])
  );

  pdf.drawAmountBox([{ label: 'Casillero 401', value: money(data.impuestoRetenido401), strong: true }]);
  pdf.drawSignatureRow('Firma del empleador', 'Firma del trabajador');

  return pdf.toBuffer();
}
