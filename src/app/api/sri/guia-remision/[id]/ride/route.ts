import { NextResponse } from 'next/server';
import { verifyAuth, requireTenantId } from '@/lib/sri-api/auth-helper';
import { db } from '@/lib/sri-api/db';
import { getDatosRide, generateRidePdf } from '@/lib/sri-api/ride-pdf';

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await verifyAuth(req);
    const tenantId = requireTenantId(user);
    const { id } = await params;

    const guia = await db.queryOne(
      "SELECT id FROM comprobantes WHERE id = $1 AND tenant_id = $2 AND tipo = '06'",
      [id, tenantId]
    );
    if (!guia) {
      return NextResponse.json(
        { message: `Guía de remisión con ID ${id} no encontrada` },
        { status: 404 }
      );
    }

    const pdfBuffer = await generateRidePdf(id);

    return new NextResponse(new Uint8Array(pdfBuffer), {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="RIDE_${id}.pdf"`,
        'Content-Length': pdfBuffer.length.toString(),
      },
    });
  } catch (error: any) {
    console.error('[Get RIDE Guia Error]', error);
    return NextResponse.json(
      { message: error.message || 'Error interno del servidor' },
      { status: error.message?.startsWith('No autorizado') ? 401 : 500 }
    );
  }
}
