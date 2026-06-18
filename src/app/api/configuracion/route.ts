import { NextResponse } from 'next/server';
import { verifyAuth, requireTenantId } from '@/lib/sri-api/auth-helper';
import { db } from '@/lib/sri-api/db';
import { getUserRuc } from '@/lib/sri-api/user-resolver';

export async function GET(req: Request) {
  try {
    const user = await verifyAuth(req);
    let userRuc = null;
    try {
      userRuc = await getUserRuc(user, req);
    } catch {}

    let emisor = null;
    if (userRuc) {
      emisor = await db.queryOne<any>(
        `SELECT ruc, razon_social, nombre_comercial, tipo_contribuyente, ambiente,
                cert_valido_hasta, certificado_valido_hasta,
                whatsapp_numero, whatsapp_estado, notif_documentos, notif_generacion
         FROM emisores WHERE ruc = $1 AND activo = true`,
        [userRuc]
      );
    }

    const emisores = user.tenantId
      ? await db.queryAll<any>(
          `SELECT ruc, razon_social, nombre_comercial, tipo_contribuyente, ambiente,
                  cert_valido_hasta, certificado_valido_hasta,
                  whatsapp_numero, whatsapp_estado, notif_documentos, notif_generacion
           FROM emisores WHERE tenant_id = $1 AND activo = true`,
          [user.tenantId]
        )
      : [];

    const lastSync = await db.queryOne<any>(
      `SELECT created_at FROM auditoria
       WHERE tenant_id = $1 AND accion = 'SINCRONIZAR_SRI'
       ORDER BY created_at DESC LIMIT 1`,
      [requireTenantId(user)]
    );

    let perfil = null;
    if (emisor) {
      const expiry = emisor.certificado_valido_hasta || emisor.cert_valido_hasta || null;
      let certStatus = 'No registrada';
      if (expiry) {
        const days = Math.ceil(
          (new Date(expiry).getTime() - Date.now()) / (1000 * 60 * 60 * 24)
        );
        certStatus =
          days < 0
            ? `Expirada hace ${Math.abs(days)} días`
            : `Válida hasta ${new Date(expiry).toLocaleDateString('es-EC')}`;
      }

      perfil = {
        ruc: emisor.ruc,
        razonSocial: emisor.razon_social,
        nombreComercial: emisor.nombre_comercial,
        regimen: emisor.tipo_contribuyente || null,
        ambiente: emisor.ambiente === '2' ? 'Producción' : 'Pruebas',
        estadoSri: 'ACTIVO',
        ultimaSincronizacion: lastSync?.created_at || null,
        firmaDigital: certStatus,
      };
    }

    return NextResponse.json({
      success: true,
      perfil,
      emisores: emisores.map((e: any) => ({
        ruc: e.ruc,
        razonSocial: e.razon_social || `Contribuyente ${e.ruc}`,
        nombreComercial: e.nombre_comercial,
        tipoContribuyente: e.tipo_contribuyente,
        ambiente: e.ambiente === '2' ? 'Producción' : 'Pruebas',
        certificadoValidoHasta: e.certificado_valido_hasta || e.cert_valido_hasta || null,
      })),
      notificaciones: {
        whatsapp: emisor ? !!emisor.notif_generacion : false,
        email: true,
        app: emisor ? !!emisor.notif_documentos : false,
      },
      whatsapp: {
        numero: emisor ? emisor.whatsapp_numero : null,
        estado: emisor ? emisor.whatsapp_estado || 'DESCONECTADO' : 'DESCONECTADO',
      },
    });
  } catch (error: any) {
    console.error('[Configuracion GET Error]', error);
    return NextResponse.json(
      { message: error.message || 'Error al obtener configuración' },
      { status: error.message?.startsWith('No autorizado') ? 401 : 500 }
    );
  }
}

export async function PUT(req: Request) {
  try {
    const user = await verifyAuth(req);
    const userRuc = await getUserRuc(user);
    const body = await req.json();

    if (body.notifDocumentos !== undefined || body.notifGeneracion !== undefined) {
      await db.query(
        `UPDATE emisores SET
          notif_documentos = COALESCE($1, notif_documentos),
          notif_generacion = COALESCE($2, notif_generacion),
          updated_at = NOW()
         WHERE ruc = $3 AND activo = true`,
        [
          body.notifDocumentos !== undefined ? Boolean(body.notifDocumentos) : null,
          body.notifGeneracion !== undefined ? Boolean(body.notifGeneracion) : null,
          userRuc,
        ]
      );
    }

    return NextResponse.json({ success: true, message: 'Configuración actualizada' });
  } catch (error: any) {
    console.error('[Configuracion PUT Error]', error);
    return NextResponse.json(
      { message: error.message || 'Error al actualizar configuración' },
      { status: error.message?.startsWith('No autorizado') ? 401 : 500 }
    );
  }
}
