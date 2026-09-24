import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';
import { calcularIREmpleado, GastosPersonales } from './calculos-ir-empleados';

export interface Formulario107Data {
  anioFiscal: number;
  emisor: {
    ruc: string;
    razonSocial: string;
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
  const pdfDoc = await PDFDocument.create();
  const page = pdfDoc.addPage([600, 840]);
  const { width, height } = page.getSize();

  const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
  const fontRegular = await pdfDoc.embedFont(StandardFonts.Helvetica);

  // Cabecera SRI
  page.drawRectangle({
    x: 20,
    y: height - 80,
    width: width - 40,
    height: 60,
    color: rgb(0.06, 0.16, 0.32),
  });

  page.drawText('FORMULARIO 107 - COMPROBANTE DE RETENCIÓN EN LA FUENTE', {
    x: 35,
    y: height - 45,
    size: 11,
    font: fontBold,
    color: rgb(1, 1, 1),
  });

  page.drawText(`IMPUESTO A LA RENTA / INGRESOS DEL TRABAJO EN RELACIÓN DE DEPENDENCIA · AÑO ${data.anioFiscal}`, {
    x: 35,
    y: height - 65,
    size: 8,
    font: fontRegular,
    color: rgb(0.9, 0.9, 0.9),
  });

  // Emisor
  let y = height - 110;
  page.drawText('100 DATOS DEL EMPLEADOR (INFORMANTE)', { x: 30, y, size: 9, font: fontBold, color: rgb(0.06, 0.16, 0.32) });
  y -= 15;
  page.drawText(`RUC: ${data.emisor.ruc}`, { x: 30, y, size: 8, font: fontRegular });
  page.drawText(`Razón Social: ${data.emisor.razonSocial}`, { x: 250, y, size: 8, font: fontRegular });

  // Empleado
  y -= 25;
  page.drawText('200 DATOS DEL TRABAJADOR (SUJETO RETENIDO)', { x: 30, y, size: 9, font: fontBold, color: rgb(0.06, 0.16, 0.32) });
  y -= 15;
  page.drawText(`Cédula / Pasaporte: ${data.empleado.cedula}`, { x: 30, y, size: 8, font: fontRegular });
  page.drawText(`Apellidos y Nombres: ${data.empleado.apellidos} ${data.empleado.nombres}`, { x: 250, y, size: 8, font: fontRegular });

  // Tabla Casilleros Formulario 107
  y -= 35;
  page.drawRectangle({ x: 30, y: y - 15, width: width - 60, height: 18, color: rgb(0.9, 0.92, 0.95) });
  page.drawText('Casillero / Concepto Tributario', { x: 40, y: y - 10, size: 8, font: fontBold });
  page.drawText('Valor ($)', { x: width - 100, y: y - 10, size: 8, font: fontBold });

  y -= 30;
  const casilleros = [
    { code: '301', label: 'Sueldos y Salarios', val: data.sueldosSalarios301 },
    { code: '303', label: 'Sobresueldos, Horas Extras y Comisiones', val: data.horasExtrasComisiones303 },
    { code: '305', label: 'Participación de Utilidades', val: data.utilidades305 ?? 0 },
    { code: '351', label: 'Aporte Personal al IESS (9.45%)', val: data.aporteIess351 },
    { code: '361', label: 'Deducción Gastos Personales - Vivienda', val: data.gastosPersonales?.vivienda ?? 0 },
    { code: '363', label: 'Deducción Gastos Personales - Educación / Arte', val: data.gastosPersonales?.educacion ?? 0 },
    { code: '365', label: 'Deducción Gastos Personales - Salud', val: data.gastosPersonales?.salud ?? 0 },
    { code: '367', label: 'Deducción Gastos Personales - Vestimenta', val: data.gastosPersonales?.vestimenta ?? 0 },
    { code: '369', label: 'Deducción Gastos Personales - Alimentación', val: data.gastosPersonales?.alimentacion ?? 0 },
    { code: '401', label: 'IMPUESTO A LA RENTA RETENIDO EN LA FUENTE', val: data.impuestoRetenido401, highlight: true },
  ];

  for (const c of casilleros) {
    if (c.highlight) {
      page.drawRectangle({ x: 30, y: y - 3, width: width - 60, height: 14, color: rgb(0.95, 0.96, 0.98) });
    }
    page.drawText(`[${c.code}] ${c.label}`, { x: 40, y, size: 8, font: c.highlight ? fontBold : fontRegular });
    page.drawText(`$ ${c.val.toFixed(2)}`, { x: width - 100, y, size: 8, font: c.highlight ? fontBold : fontRegular });
    y -= 16;
  }

  // Pie de firmas
  y -= 40;
  page.drawLine({ start: { x: 50, y }, end: { x: 220, y }, thickness: 1, color: rgb(0.6, 0.6, 0.6) });
  page.drawLine({ start: { x: 350, y }, end: { x: 520, y }, thickness: 1, color: rgb(0.6, 0.6, 0.6) });

  y -= 12;
  page.drawText('Firma Agente de Retención (Empleador)', { x: 50, y, size: 7, font: fontRegular });
  page.drawText('Firma del Trabajador (Sujeto Retenido)', { x: 350, y, size: 7, font: fontRegular });

  const pdfBytes = await pdfDoc.save();
  return Buffer.from(pdfBytes);
}
