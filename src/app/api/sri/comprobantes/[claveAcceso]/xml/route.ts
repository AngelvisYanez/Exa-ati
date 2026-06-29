import { NextResponse } from 'next/server';
import { verifyAuth } from '@/lib/sri-api/auth-helper';
import { db } from '@/lib/sri-api/db';
import { xmlStorage } from '@/lib/sri-api/xml-storage';
import { sriSoapClient } from '@/lib/sri-api/sri-soap-client';
import { getUserRuc } from '@/lib/sri-api/user-resolver';
import { saveAutorizadoXml } from '@/lib/sri-api/comprobante-importer';
import fs from 'fs';
import path from 'path';

async function readStoredXml(comprobanteId: string): Promise<string | null> {
  const rows = await db.queryAll<any>(
    `SELECT xml_autorizado_path, ruta_archivo, tipo
     FROM comprobante_xmls
     WHERE comprobante_id = ?`,
    [comprobanteId]
  );

  if (!rows || rows.length === 0) return null;

  // 1. Intentar buscar el XML de tipo 'autorizado' en la columna 'ruta_archivo'
  const autorizado = rows.find(r => r.tipo === 'autorizado' && r.ruta_archivo);
  if (autorizado) {
    const content = xmlStorage.readXml(autorizado.ruta_archivo);
    if (content) return content;
  }

  // 2. Intentar buscar en la columna legacy 'xml_autorizado_path'
  const legacyAutorizado = rows.find(r => r.xml_autorizado_path);
  if (legacyAutorizado) {
    const content = xmlStorage.readXml(legacyAutorizado.xml_autorizado_path);
    if (content) return content;
  }

  // 3. Intentar buscar el XML de tipo 'firmado' en la columna 'ruta_archivo'
  const firmado = rows.find(r => r.tipo === 'firmado' && r.ruta_archivo);
  if (firmado) {
    const content = xmlStorage.readXml(firmado.ruta_archivo);
    if (content) return content;
  }

  // 4. Intentar buscar cualquier registro con ruta_archivo válida
  const cualquiera = rows.find(r => r.ruta_archivo);
  if (cualquiera) {
    const content = xmlStorage.readXml(cualquiera.ruta_archivo);
    if (content) return content;
  }

  return null;
}

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

    let xmlContent = await readStoredXml(comprobante.id);

    if (!xmlContent) {
      const respuestaSri = await sriSoapClient.autorizarComprobante(claveAcceso);
      if (respuestaSri.autorizaciones?.autorizacion) {
        const auth = Array.isArray(respuestaSri.autorizaciones.autorizacion)
          ? respuestaSri.autorizaciones.autorizacion[0]
          : respuestaSri.autorizaciones.autorizacion;

        if (auth.estado === 'AUTORIZADO' && auth.comprobante) {
          xmlContent = auth.comprobante;
          const ruc = comprobante.emisor_ruc || claveAcceso.substring(10, 23);
          const fecha = comprobante.fecha_emision
            ? new Date(comprobante.fecha_emision)
            : new Date();
          try {
            await saveAutorizadoXml(
              comprobante.id,
              ruc,
              claveAcceso,
              fecha,
              typeof xmlContent === 'string' ? xmlContent : String(xmlContent)
            );
          } catch (saveErr) {
            console.warn('[Get Comprobante XML] No se pudo persistir XML:', saveErr);
          }
        }
      }
    }

    if (!xmlContent) {
      return NextResponse.json(
        { message: `XML autorizado no disponible para ${claveAcceso}. Sincroniza con el SRI o importa el XML.` },
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
