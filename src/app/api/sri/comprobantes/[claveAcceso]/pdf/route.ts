import { NextResponse } from 'next/server';
import { verifyAuth } from '@/services/sri-api/auth-helper';
import { db } from '@/services/sri-api/db';
import { generateRidePdf } from '@/services/sri-api/ride-pdf';
import fs from 'fs';
import path from 'path';

function tryReadStoredPdfBase64(value: string | null | undefined): Buffer | null {
  if (!value || value.length < 100) return null;
  // Rutas de archivo / XML no son PDF base64
  if (value.includes('.xml') || value.includes('/') || value.includes('\\')) return null;
  if (value.trimStart().startsWith('<') || value.trimStart().startsWith('<?xml')) return null;
  try {
    const buf = Buffer.from(value, 'base64');
    if (buf.length > 4 && buf.subarray(0, 4).toString() === '%PDF') return buf;
  } catch {
    return null;
  }
  return null;
}

export async function GET(
  req: Request,
  { params }: { params: Promise<{ claveAcceso: string }> }
) {
  try {
    await verifyAuth(req);
    const { claveAcceso } = await params;

    // Servir PDF real descargado por el worker si existe
    const localPdfPath = path.join(process.cwd(), 'downloads', 'RIDE', `${claveAcceso}.pdf`);
    if (fs.existsSync(localPdfPath)) {
      const pdfBuffer = fs.readFileSync(localPdfPath);
      return new Response(pdfBuffer, {
        status: 200,
        headers: {
          'Content-Type': 'application/pdf',
          'Content-Disposition': `attachment; filename="RIDE_${claveAcceso}.pdf"`,
        },
      });
    }

    const detail = await db.queryOne<{ id: string }>(
      `SELECT id FROM comprobantes WHERE clave_acceso = ?`,
      [claveAcceso]
    );

    if (!detail) {
      return NextResponse.json({ message: 'Comprobante no encontrado' }, { status: 404 });
    }

    // PDF base64 guardado por scrapers (columna legacy xml_autorizado_path)
    const xmlRow = await db.queryOne<{ xml_autorizado_path: string | null }>(
      `SELECT xml_autorizado_path FROM comprobante_xmls
       WHERE comprobante_id = ? AND xml_autorizado_path IS NOT NULL
       ORDER BY created_at DESC LIMIT 1`,
      [detail.id]
    );
    const storedPdf = tryReadStoredPdfBase64(xmlRow?.xml_autorizado_path);
    if (storedPdf) {
      return new Response(new Uint8Array(storedPdf), {
        status: 200,
        headers: {
          'Content-Type': 'application/pdf',
          'Content-Disposition': `attachment; filename="RIDE_${claveAcceso}.pdf"`,
        },
      });
    }

    const pdfBuffer = await generateRidePdf(detail.id);

    return new Response(new Uint8Array(pdfBuffer), {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="RIDE_${claveAcceso}.pdf"`,
        'Content-Length': pdfBuffer.length.toString(),
      },
    });
  } catch (error: any) {
    console.error('[Get Comprobante PDF Error]', error);
    return NextResponse.json(
      { message: error.message || 'Error al generar RIDE PDF' },
      { status: error.message?.startsWith('No autorizado') ? 401 : 500 }
    );
  }
}
