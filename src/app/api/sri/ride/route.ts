import { NextResponse } from 'next/server';
import { verifyAuth, requireTenantId } from '@/lib/sri-api/auth-helper';
import { db } from '@/lib/sri-api/db';
import { generateRidePdf } from '@/lib/sri-api/ride-pdf';

export async function POST(req: Request) {
  try {
    const user = await verifyAuth(req);
    const tenantId = requireTenantId(user);
    const body = await req.json();
    const { comprobanteId } = body;

    if (!comprobanteId) {
      return NextResponse.json(
        { message: 'comprobanteId es obligatorio' },
        { status: 400 }
      );
    }

    const comprobante = await db.queryOne(
      'SELECT id, tenant_id FROM comprobantes WHERE id = $1',
      [comprobanteId]
    );
    if (!comprobante) {
      return NextResponse.json(
        { message: `Comprobante con ID ${comprobanteId} no encontrado` },
        { status: 404 }
      );
    }

    if (user.rol !== 'SUPERADMIN' && comprobante.tenant_id !== tenantId) {
      return NextResponse.json(
        { message: 'Acceso denegado a este comprobante' },
        { status: 403 }
      );
    }

    const pdfBuffer = await generateRidePdf(comprobanteId);

    return new NextResponse(new Uint8Array(pdfBuffer), {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="RIDE_${comprobanteId}.pdf"`,
        'Content-Length': pdfBuffer.length.toString(),
      },
    });
  } catch (error: any) {
    console.error('[Post RIDE Error]', error);
    return NextResponse.json(
      { message: error.message || 'Error interno del servidor' },
      { status: error.message?.startsWith('No autorizado') ? 401 : 500 }
    );
  }
}
