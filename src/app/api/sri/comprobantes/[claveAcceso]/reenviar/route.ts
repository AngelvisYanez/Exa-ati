import { NextResponse } from 'next/server';
import { verifyAuth } from '@/services/sri-api/auth-helper';
import { db } from '@/services/sri-api/db';
import { sriSoapClient } from '@/services/sri-api/sri-soap-client';
import { classifySriError } from '@/services/sri-api/sri-error-handler';
import { saveAutorizadoXml } from '@/services/sri-api/comprobante-importer';
import { xmlStorage } from '@/services/sri-api/xml-storage';

export async function POST(req: Request, { params }: { params: Promise<{ claveAcceso: string }> }) {
  try {
    const user = await verifyAuth(req);
    const { claveAcceso } = await params;

    const comp = await db.queryOne<any>(
      `SELECT id, emisor_id, tipo, clave_acceso, estado, estado_sri, emisor_ruc, tenant_id
       FROM comprobantes WHERE clave_acceso = ? AND tenant_id = ?`,
      [claveAcceso, user.tenantId]
    );

    if (!comp) {
      return NextResponse.json({ message: 'Comprobante no encontrado' }, { status: 404 });
    }

    if (comp.estado === 'AUTORIZADO') {
      return NextResponse.json({ message: 'El comprobante ya está autorizado' }, { status: 400 });
    }

    if (comp.estado === 'EN_PROCESO' || comp.estado === 'PPR') {
      return NextResponse.json({
        message: 'El comprobante está en procesamiento por el SRI. Usa el sistema de polling automático.',
        requierePolling: true,
        claveAcceso,
      }, { status: 409 });
    }

    const emisor = await db.queryOne<any>(
      `SELECT ruc, razon_social FROM emisores WHERE id = ? AND activo = true`,
      [comp.emisor_id]
    );
    if (!emisor) {
      return NextResponse.json({ message: 'Emisor no encontrado' }, { status: 404 });
    }

    const xmlRecord = await db.queryOne<any>(
      `SELECT ruta_archivo FROM comprobante_xmls WHERE comprobante_id = ? AND tipo = 'firmado'`,
      [comp.id]
    );
    if (!xmlRecord?.ruta_archivo) {
      return NextResponse.json({ message: 'No hay XML firmado almacenado para reenvío' }, { status: 404 });
    }

    const xmlFirmado = xmlStorage.readXml(xmlRecord.ruta_archivo);
    if (!xmlFirmado) {
      return NextResponse.json({ message: 'No se pudo leer el XML firmado almacenado' }, { status: 404 });
    }

    const result = await sriSoapClient.enviarYAutorizar(xmlFirmado, claveAcceso);

    await db.query(
      `UPDATE comprobantes SET
        estado = ?, estado_sri = ?,
        fecha_autorizacion = ?, numero_autorizacion = ?,
        updated_at = NOW()
       WHERE id = ?`,
      [
        result.estado, result.estado,
        result.fechaAutorizacion ? new Date(result.fechaAutorizacion) : null,
        result.numeroAutorizacion || null,
        comp.id,
      ]
    );

    if (result.estado === 'AUTORIZADO' && result.xmlAutorizado) {
      await saveAutorizadoXml(
        comp.id,
        emisor.ruc,
        claveAcceso,
        new Date(),
        result.xmlAutorizado
      );
    }

    const errorClassified = classifySriError(result.mensajes, result.estado === 'EN_PROCESO' ? 'autorizacion' : 'recepcion');

    return NextResponse.json({
      success: result.success || result.estado === 'EN_PROCESO',
      claveAcceso,
      estado: result.estado,
      numeroAutorizacion: result.numeroAutorizacion,
      fechaAutorizacion: result.fechaAutorizacion,
      mensajes: result.mensajes,
      error: errorClassified ? { tipo: errorClassified.tipo, accion: errorClassified.accion, mensaje: errorClassified.mensaje } : undefined,
      requierePolling: result.estado === 'EN_PROCESO',
      reenviado: true,
    });
  } catch (error: any) {
    console.error('[Reenvio Error]', error);
    return NextResponse.json(
      { success: false, message: error.message || 'Error al reenviar el comprobante' },
      { status: 500 }
    );
  }
}
