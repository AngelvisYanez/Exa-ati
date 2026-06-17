import { NextResponse } from 'next/server';
import { verifyAuth } from '@/lib/sri-api/auth-helper';
import { db } from '@/lib/sri-api/db';
import { sriSoapClient } from '@/lib/sri-api/sri-soap-client';

export async function POST(req: Request) {
  try {
    const user = await verifyAuth(req);

    // Obtener comprobantes del tenant que estén FIRMADO, PENDIENTE o EN PROCESO
    const pending = await db.queryAll(
      `SELECT id, clave_acceso, secuencial, tipo FROM comprobantes 
       WHERE tenant_id = ? AND estado IN ('PENDIENTE', 'FIRMADO', 'EN PROCESO')`,
      [user.tenantId]
    );

    if (pending.length === 0) {
      return NextResponse.json({
        success: true,
        message: 'No hay comprobantes pendientes de autorización',
        processed: 0,
        results: []
      });
    }

    const results = [];

    for (const doc of pending) {
      try {
        const response = await sriSoapClient.autorizarComprobante(doc.clave_acceso);

        if (response.autorizaciones && response.autorizaciones.autorizacion) {
          const auth = Array.isArray(response.autorizaciones.autorizacion)
            ? response.autorizaciones.autorizacion[0]
            : response.autorizaciones.autorizacion;

          if (auth.estado === 'AUTORIZADO') {
            await db.query(
              `UPDATE comprobantes SET 
                estado = 'AUTORIZADO', 
                estado_sri = 'AUTORIZADO', 
                fecha_autorizacion = ?, 
                numero_autorizacion = ?, 
                updated_at = NOW() 
               WHERE id = ?`,
              [
                auth.fechaAutorizacion ? new Date(auth.fechaAutorizacion) : new Date(),
                auth.numeroAutorizacion || doc.clave_acceso,
                doc.id
              ]
            );

            results.push({
              secuencial: doc.secuencial,
              claveAcceso: doc.clave_acceso,
              estado: 'AUTORIZADO',
              success: true
            });
          } else {
            // Actualizar con el estado retornado (p.ej. NO AUTORIZADO, RECHAZADO)
            await db.query(
              'UPDATE comprobantes SET estado = ?, estado_sri = ?, updated_at = NOW() WHERE id = ?',
              [auth.estado, auth.estado, doc.id]
            );

            results.push({
              secuencial: doc.secuencial,
              claveAcceso: doc.clave_acceso,
              estado: auth.estado,
              success: false,
              mensaje: 'SRI retornó estado no autorizado'
            });
          }
        } else {
          results.push({
            secuencial: doc.secuencial,
            claveAcceso: doc.clave_acceso,
            estado: 'PENDIENTE',
            success: false,
            mensaje: 'Aún en proceso o sin respuesta de autorización'
          });
        }
      } catch (err: any) {
        results.push({
          secuencial: doc.secuencial,
          claveAcceso: doc.clave_acceso,
          estado: 'PENDIENTE',
          success: false,
          error: err.message || 'Error en conexión SOAP'
        });
      }
    }

    const authorizedCount = results.filter(r => r.estado === 'AUTORIZADO').length;

    return NextResponse.json({
      success: true,
      processed: pending.length,
      authorizedCount,
      results
    });
  } catch (error: any) {
    console.error('[Retry Pending Error]', error);
    return NextResponse.json(
      { message: error.message || 'Error interno del servidor al procesar reintentos' },
      { status: error.message?.startsWith('No autorizado') ? 401 : 500 }
    );
  }
}
