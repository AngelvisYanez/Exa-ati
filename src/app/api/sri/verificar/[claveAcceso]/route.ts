import { NextResponse } from 'next/server';
import { verifyAuth } from '@/lib/sri-api/auth-helper';
import { db } from '@/lib/sri-api/db';
import { sriSoapClient } from '@/lib/sri-api/sri-soap-client';

export async function GET(
  req: Request,
  { params }: { params: Promise<{ claveAcceso: string }> }
) {
  try {
    const user = await verifyAuth(req);
    const { claveAcceso } = await params;

    if (!claveAcceso || claveAcceso.length !== 49) {
      return NextResponse.json(
        { message: 'La clave de acceso debe tener 49 dígitos' },
        { status: 400 }
      );
    }

    // Validar acceso del usuario al emisor de la clave de acceso
    const rucEmisor = claveAcceso.substring(10, 23);
    if (user.rol !== 'SUPERADMIN') {
      const emisor = await db.queryOne(
        'SELECT id, tenant_id FROM emisores WHERE ruc = $1',
        [rucEmisor]
      );
      if (!emisor || emisor.tenant_id !== user.tenantId) {
        return NextResponse.json(
          { message: 'Acceso denegado a este comprobante' },
          { status: 403 }
        );
      }
    }

    // 1. Consultar estado en base de datos local
    const comprobanteLocal = await db.queryOne<any>(
      'SELECT estado FROM comprobantes WHERE clave_acceso = $1',
      [claveAcceso]
    );
    const estadoLocal = comprobanteLocal?.estado;

    // 2. Consultar directamente al SRI
    const respuestaSri = await sriSoapClient.autorizarComprobante(claveAcceso);

    // 3. Analizar respuesta del SRI
    let existeEnSri = false;
    let estadoSri = 'NO EXISTE';
    let fechaAutorizacion: string | undefined;
    let numeroAutorizacion: string | undefined;
    let mensajes: string[] = [];

    if (respuestaSri.autorizaciones && respuestaSri.autorizaciones.autorizacion) {
      existeEnSri = true;
      const auth = Array.isArray(respuestaSri.autorizaciones.autorizacion)
        ? respuestaSri.autorizaciones.autorizacion[0]
        : respuestaSri.autorizaciones.autorizacion;

      estadoSri = auth.estado || 'DESCONOCIDO';
      fechaAutorizacion = auth.fechaAutorizacion;
      numeroAutorizacion = auth.numeroAutorizacion;

      if (auth.mensajes?.mensaje) {
        const msgs = Array.isArray(auth.mensajes.mensaje)
          ? auth.mensajes.mensaje
          : [auth.mensajes.mensaje];
        mensajes = msgs.map(
          (m: any) => `[${m.tipo || 'INFO'}] ${m.identificador || ''}: ${m.mensaje || ''}`
        );
      }
    }

    // 4. Determinar si está sincronizado
    const sincronizado =
      estadoLocal === estadoSri ||
      (estadoLocal === 'AUTORIZADO' && estadoSri === 'AUTORIZADO');

    return NextResponse.json({
      claveAcceso,
      existeEnSri,
      estado: estadoSri,
      fechaAutorizacion,
      numeroAutorizacion,
      mensajes: mensajes.length > 0 ? mensajes : undefined,
      estadoLocal: estadoLocal || undefined,
      sincronizado,
    });
  } catch (error: any) {
    console.error('[Verify Comprobante SRI Error]', error);
    return NextResponse.json(
      { message: error.message || 'Error interno del servidor' },
      { status: error.message?.startsWith('No autorizado') ? 401 : 500 }
    );
  }
}
