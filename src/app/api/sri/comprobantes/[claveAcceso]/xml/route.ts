import { NextResponse } from 'next/server';
import { verifyAuth } from '@/services/sri-api/auth-helper';
import { db } from '@/services/sri-api/db';
import { getUserRuc } from '@/services/sri-api/user-resolver';
import { resolveComprobanteXml } from '@/services/sri-api/comprobante-xml-resolver';
import fs from 'fs';
import path from 'path';

export async function GET(
  req: Request,
  { params }: { params: Promise<{ claveAcceso: string }> }
) {
  try {
    const user = await verifyAuth(req);
    const { claveAcceso } = await params;

    // Servir XML real descargado por el worker si existe
    const localXmlPath = path.join(process.cwd(), 'downloads', 'XML', `${claveAcceso}.xml`);
    if (fs.existsSync(localXmlPath)) {
      const xmlBuffer = fs.readFileSync(localXmlPath, 'utf8');
      return new Response(xmlBuffer, {
        status: 200,
        headers: {
          'Content-Type': 'application/xml; charset=utf-8',
          'Content-Disposition': `attachment; filename="${claveAcceso}.xml"`,
        },
      });
    }

    if (!claveAcceso || claveAcceso.length !== 49) {
      return NextResponse.json(
        { message: 'La clave de acceso debe tener 49 dígitos' },
        { status: 400 }
      );
    }

    const rucEmisor = claveAcceso.substring(10, 23);
    if (user.rol !== 'SUPERADMIN') {
      let userRuc: string | null = null;
      try {
        userRuc = await getUserRuc(user);
      } catch {
        userRuc = null;
      }

      const emisor = await db.queryOne(
        'SELECT id, tenant_id FROM emisores WHERE ruc = ?',
        [rucEmisor]
      );
      const comprobanteTenant = await db.queryOne(
        'SELECT tenant_id FROM comprobantes WHERE clave_acceso = ?',
        [claveAcceso]
      );
      const allowed =
        (emisor && emisor.tenant_id === user.tenantId) ||
        comprobanteTenant?.tenant_id === user.tenantId ||
        (userRuc &&
          (await db.queryOne(
            'SELECT id FROM comprobantes WHERE clave_acceso = ? AND receptor_identificacion = ?',
            [claveAcceso, userRuc]
          )));

      if (!allowed) {
        return NextResponse.json(
          { message: 'Acceso denegado a este comprobante' },
          { status: 403 }
        );
      }
    }

    const comprobante = await db.queryOne<any>(
      'SELECT id, estado, fecha_emision, emisor_ruc FROM comprobantes WHERE clave_acceso = ?',
      [claveAcceso]
    );

    if (!comprobante) {
      return NextResponse.json(
        { message: `Comprobante ${claveAcceso} no encontrado` },
        { status: 404 }
      );
    }

    const xmlContent = await resolveComprobanteXml(claveAcceso, {
      comprobanteId: comprobante.id,
      fetchFromSri: false,
    });

    if (!xmlContent) {
      return NextResponse.json(
        {
          message: `XML no disponible localmente para ${claveAcceso}. Vuelve a descargarlo desde el portal SRI (Descarga Masiva) o importa el XML.`,
        },
        { status: 404 }
      );
    }

    return new Response(xmlContent, {
      status: 200,
      headers: {
        'Content-Type': 'application/xml; charset=utf-8',
        'Content-Disposition': `attachment; filename="${claveAcceso}.xml"`,
      },
    });
  } catch (error: any) {
    console.error('[Get Comprobante XML Error]', error);
    return NextResponse.json(
      { message: error.message || 'Error interno del servidor' },
      { status: error.message?.startsWith('No autorizado') ? 401 : 500 }
    );
  }
}
