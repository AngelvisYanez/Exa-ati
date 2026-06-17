import { NextResponse } from 'next/server';
import { verifyAuth } from '@/lib/sri-api/auth-helper';
import { db } from '@/lib/sri-api/db';
import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';
import fs from 'fs';
import path from 'path';

export async function GET(
  req: Request,
  { params }: { params: Promise<{ claveAcceso: string }> }
) {
  try {
    const user = await verifyAuth(req);
    const { claveAcceso } = await params;

    // Servir PDF real descargado por el worker si existe
    const localPdfPath = path.join(process.cwd(), 'downloads', 'RIDE', `${claveAcceso}.pdf`);
    if (fs.existsSync(localPdfPath)) {
      const pdfBuffer = fs.readFileSync(localPdfPath);
      return new Response(pdfBuffer, {
        status: 200,
        headers: {
          'Content-Type': 'application/pdf',
          'Content-Disposition': `attachment; filename="ride_${claveAcceso}.pdf"`,
        },
      });
    }

    // Obtener datos del comprobante
    const detail = await db.queryOne<any>(
      `SELECT c.*, e.ruc AS emisor_ruc, e.razon_social AS emisor_razon_social, e.nombre_comercial AS emisor_nombre_comercial, e.direccion_matriz AS emisor_matriz
       FROM comprobantes c
       LEFT JOIN emisores e ON c.emisor_id = e.id
       WHERE c.clave_acceso = ?`,
      [claveAcceso]
    );

    if (!detail) {
      return NextResponse.json({ message: 'Comprobante no encontrado' }, { status: 404 });
    }

    // Crear PDF usando pdf-lib
    const pdfDoc = await PDFDocument.create();
    const page = pdfDoc.addPage([600, 800]);
    const { width, height } = page.getSize();

    const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
    const fontRegular = await pdfDoc.embedFont(StandardFonts.Helvetica);

    // Dibujar fondo de cabecera
    page.drawRectangle({
      x: 20,
      y: height - 100,
      width: width - 40,
      height: 80,
      color: rgb(0.06, 0.16, 0.32), // Navy oscuro
    });

    // Título
    page.drawText('COMPROBANTE ELECTRÓNICO - RIDE', {
      x: 40,
      y: height - 50,
      size: 14,
      font: fontBold,
      color: rgb(1, 1, 1),
    });

    page.drawText(`Nro. Autorización: ${claveAcceso}`, {
      x: 40,
      y: height - 70,
      size: 9,
      font: fontRegular,
      color: rgb(0.9, 0.9, 0.9),
    });

    // Cuadro Emisor / Clave
    let y = height - 130;
    page.drawText('DATOS DEL EMISOR', { x: 30, y, size: 10, font: fontBold, color: rgb(0.06, 0.16, 0.32) });
    y -= 15;
    page.drawText(`Razón Social: ${detail.emisor_razon_social || '—'}`, { x: 30, y, size: 9, font: fontRegular });
    y -= 12;
    page.drawText(`RUC: ${detail.emisor_ruc || '—'}`, { x: 30, y, size: 9, font: fontRegular });
    y -= 12;
    page.drawText(`Establecimiento: ${detail.serie || '001-001'} · Secuencial: ${detail.secuencial || '000000001'}`, { x: 30, y, size: 9, font: fontRegular });

    // Cuadro Receptor
    y -= 30;
    page.drawText('DATOS DEL RECEPTOR', { x: 30, y, size: 10, font: fontBold, color: rgb(0.06, 0.16, 0.32) });
    y -= 15;
    page.drawText(`Razón Social: ${detail.receptor_razon_social || 'CONSUMIDOR FINAL'}`, { x: 30, y, size: 9, font: fontRegular });
    y -= 12;
    page.drawText(`Identificación: ${detail.receptor_identificacion || '9999999999'}`, { x: 30, y, size: 9, font: fontRegular });
    y -= 12;
    page.drawText(`Email: ${detail.receptor_email || '—'}`, { x: 30, y, size: 9, font: fontRegular });
    y -= 12;
    page.drawText(`Fecha Emisión: ${detail.fecha_emision ? new Date(detail.fecha_emision).toLocaleDateString('es-EC') : '—'}`, { x: 30, y, size: 9, font: fontRegular });

    // Tabla de Detalles
    y -= 40;
    page.drawRectangle({
      x: 30,
      y: y - 20,
      width: width - 60,
      height: 20,
      color: rgb(0.9, 0.92, 0.95)
    });
    page.drawText('Descripción del Servicio / Producto', { x: 40, y: y - 14, size: 9, font: fontBold, color: rgb(0.1, 0.1, 0.1) });
    page.drawText('Total', { x: width - 80, y: y - 14, size: 9, font: fontBold, color: rgb(0.1, 0.1, 0.1) });

    y -= 35;
    page.drawText(detail.tipo === '07' ? 'Servicios de Retención de Impuestos' : 'Consumo / Servicios profesionales de asesoría', { x: 40, y, size: 9, font: fontRegular });
    page.drawText(`$${(parseFloat(detail.importe_total) || 0).toFixed(2)}`, { x: width - 80, y, size: 9, font: fontBold });

    // Totales
    y -= 50;
    page.drawLine({
      start: { x: 30, y },
      end: { x: width - 30, y },
      thickness: 1,
      color: rgb(0.8, 0.8, 0.8)
    });

    y -= 20;
    page.drawText('Subtotal sin Impuestos:', { x: width - 220, y, size: 9, font: fontRegular });
    page.drawText(`$${(parseFloat(detail.total_sin_impuesto ?? detail.total_sin_impuestos) || 0).toFixed(2)}`, { x: width - 80, y, size: 9, font: fontRegular });

    y -= 15;
    page.drawText('Total Descuento:', { x: width - 220, y, size: 9, font: fontRegular });
    page.drawText(`$${(parseFloat(detail.total_descuento) || 0).toFixed(2)}`, { x: width - 80, y, size: 9, font: fontRegular });

    y -= 15;
    page.drawText('IVA 15%:', { x: width - 220, y, size: 9, font: fontRegular });
    page.drawText(`$${(parseFloat(detail.total_iva) || 0).toFixed(2)}`, { x: width - 80, y, size: 9, font: fontRegular });

    y -= 20;
    page.drawRectangle({
      x: width - 230,
      y: y - 5,
      width: 160,
      height: 20,
      color: rgb(0.95, 0.96, 0.98)
    });
    page.drawText('VALOR TOTAL:', { x: width - 220, y, size: 9, font: fontBold, color: rgb(0.06, 0.16, 0.32) });
    page.drawText(`$${(parseFloat(detail.importe_total) || 0).toFixed(2)}`, { x: width - 80, y, size: 9, font: fontBold, color: rgb(0.06, 0.16, 0.32) });

    // Pie de página
    page.drawText('Generado automáticamente por OFSERCONT IA - Ecuador', {
      x: 30,
      y: 40,
      size: 8,
      font: fontRegular,
      color: rgb(0.6, 0.6, 0.6)
    });

    const pdfBytes = await pdfDoc.save();

    return new Response(Buffer.from(pdfBytes), {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="ride_${claveAcceso}.pdf"`,
      },
    });
  } catch (error: any) {
    console.error('[Get Comprobante PDF Error]', error);
    return NextResponse.json(
      { message: error.message || 'Error al generar PDF' },
      { status: error.message?.startsWith('No autorizado') ? 401 : 500 }
    );
  }
}
