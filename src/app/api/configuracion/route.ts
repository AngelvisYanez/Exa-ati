import { NextResponse } from 'next/server';
import { verifyAuth, requireTenantId } from '@/lib/sri-api/auth-helper';
import { db } from '@/lib/sri-api/db';
import { getUserRuc } from '@/lib/sri-api/user-resolver';

export async function GET(req: Request) {
  try {
    const user = await verifyAuth(req);
    const userRuc = await getUserRuc(user);

    const emisor = await db.queryOne<any>(
      `SELECT ruc, razon_social, nombre_comercial, tipo_contribuyente, ambiente,
              cert_valido_hasta, certificado_valido_hasta,
              whatsapp_numero, whatsapp_estado, notif_documentos, notif_generacion
       FROM emisores WHERE ruc = ? AND activo = 1`,
      [userRuc]
    );

    if (!emisor) {
      return NextResponse.json({ message: 'Emisor no encontrado' }, { status: 404 });
    }

    const lastSync = await db.queryOne<any>(
      `SELECT created_at FROM auditoria
       WHERE tenant_id = ? AND accion = 'SINCRONIZAR_SRI'
       ORDER BY created_at DESC LIMIT 1`,
      [requireTenantId(user)]
    );

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

    return NextResponse.json({
      success: true,
      perfil: {
        ruc: emisor.ruc,
        razonSocial: emisor.razon_social,
        nombreComercial: emisor.nombre_comercial,
        regimen: emisor.tipo_contribuyente || null,
        ambiente: emisor.ambiente === '2' ? 'Producción' : 'Pruebas',
        estadoSri: 'ACTIVO',
        ultimaSincronizacion: lastSync?.created_at || null,
        firmaDigital: certStatus,
      },
      notificaciones: {
        whatsapp: !!emisor.notif_generacion,
        email: true,
        app: !!emisor.notif_documentos,
      },
      whatsapp: {
        numero: emisor.whatsapp_numero,
        estado: emisor.whatsapp_estado || 'DESCONECTADO',
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
          notif_documentos = COALESCE(?, notif_documentos),
          notif_generacion = COALESCE(?, notif_generacion),
          updated_at = NOW()
         WHERE ruc = ? AND activo = 1`,
        [
          body.notifDocumentos !== undefined ? (body.notifDocumentos ? 1 : 0) : null,
          body.notifGeneracion !== undefined ? (body.notifGeneracion ? 1 : 0) : null,
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
