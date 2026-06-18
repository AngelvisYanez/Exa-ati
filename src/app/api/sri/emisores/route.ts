import { NextResponse } from 'next/server';
import { verifyAuth, requireTenantId } from '@/lib/sri-api/auth-helper';
import { db } from '@/lib/sri-api/db';

export async function GET(req: Request) {
  try {
    const user = await verifyAuth(req);
    const tenantId = requireTenantId(user);

    const emisores = await db.queryAll<any>(
      `SELECT id, ruc, razon_social, nombre_comercial, ambiente, tipo_contribuyente,
              cert_valido_hasta, certificado_valido_hasta 
       FROM emisores WHERE tenant_id = $1 AND activo = true ORDER BY razon_social ASC`,
      [tenantId]
    );

    return NextResponse.json({
      success: true,
      emisores: emisores.map((e) => ({
        id: e.id,
        ruc: e.ruc,
        razonSocial: e.razon_social || `Contribuyente ${e.ruc}`,
        nombreComercial: e.nombre_comercial,
        tipoContribuyente: e.tipo_contribuyente,
        ambiente: e.ambiente,
        certificadoExpiracion: e.certificado_valido_hasta || e.cert_valido_hasta || null,
      }))
    });
  } catch (error: any) {
    console.error('[Get Emisores Error]', error);
    return NextResponse.json(
      { message: error.message || 'Error al obtener emisores' },
      { status: 500 }
    );
  }
}
