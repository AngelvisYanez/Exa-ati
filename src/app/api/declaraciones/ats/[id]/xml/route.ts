import { NextResponse } from 'next/server';
import { verifyAuth, requireTenantId } from '@/services/sri-api/auth-helper';
import { db } from '@/services/sri-api/db';
import { buildAtsXml, type AtsData } from '@/services/sri-api/ats';

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await verifyAuth(req);
    const tenantId = requireTenantId(user);
    const { id } = await params;
    const numId = parseInt(id, 10);

    const reporte = await db.queryOne<any>(
      `SELECT r.id, r.tipo, r.periodo, r.data, r.xml_generado
       FROM reportes_fiscales r
       WHERE r.id = $1 AND r.tenant_id = $2 AND r.tipo = 'ATS'`,
      [numId, tenantId]
    );

    if (!reporte) {
      return NextResponse.json(
        { message: `Reporte ATS con ID ${id} no encontrado` },
        { status: 404 }
      );
    }

    const data: AtsData =
      typeof reporte.data === 'string' ? JSON.parse(reporte.data) : reporte.data;

    if (!data || !Array.isArray(data.ventas)) {
      return NextResponse.json(
        { message: 'El reporte ATS no contiene datos válidos para exportar' },
        { status: 422 }
      );
    }

    // Genera siempre desde los datos guardados para garantizar
    // la estructura oficial del SRI (raíz ivaRecaudado).
    const xml = buildAtsXml(data);

    return new NextResponse(xml, {
      headers: {
        'Content-Type': 'application/xml; charset=utf-8',
        'Content-Disposition': `attachment; filename="ATS_${data.periodo}.xml"`,
      },
    });
  } catch (error: any) {
    console.error('[Export ATS XML Error]', error);
    return NextResponse.json(
      { message: error.message || 'Error interno del servidor' },
      { status: error.message?.startsWith('No autorizado') ? 401 : 500 }
    );
  }
}
