import { NextResponse } from 'next/server';
import { verifyAuth } from '@/lib/sri-api/auth-helper';
import { db } from '@/lib/sri-api/db';

const TIPO_COMPROBANTE_DESCRIPCIONES: Record<string, string> = {
  '01': 'FACTURA',
  '04': 'NOTA DE CRÉDITO',
  '05': 'NOTA DE DÉBITO',
  '06': 'GUÍA DE REMISIÓN',
  '07': 'COMPROBANTE DE RETENCIÓN',
};

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
        'SELECT id, tenant_id FROM emisores WHERE ruc = ? AND activo = true',
        [rucEmisor]
      );
      if (!emisor || emisor.tenant_id !== user.tenantId) {
        return NextResponse.json(
          { message: 'Acceso denegado a este comprobante' },
          { status: 403 }
        );
      }
    }

    const comprobante = await db.queryOne<any>(
      `SELECT 
        c.*,
        COALESCE(e.ruc, c.emisor_ruc) as ruc_emisor,
        COALESCE(e.razon_social, c.emisor_razon_social) as razon_social_emisor,
        c.serie as serie_completa,
        c.total_sin_impuesto as subtotal,
        c.importe_total as total,
        c.total_iva as total_impuestos,
        CASE WHEN x.id IS NOT NULL THEN true ELSE false END as xml_disponible
      FROM comprobantes c
      LEFT JOIN comprobante_xmls x ON c.id = x.comprobante_id AND x.tipo = 'autorizado'
      LEFT JOIN emisores e ON c.emisor_id = e.id
      WHERE c.clave_acceso = ?`,
      [claveAcceso]
    );

    if (!comprobante) {
      return NextResponse.json(
        { message: `Comprobante ${claveAcceso} no encontrado` },
        { status: 404 }
      );
    }

    // Obtener detalles del comprobante
    const detallesResult = await db.query(
      `SELECT 
        d.id,
        d.codigo_principal,
        d.codigo_auxiliar,
        d.descripcion,
        d.cantidad,
        d.precio_unitario,
        d.descuento,
        d.precio_total_sin_impuesto as subtotal
      FROM comprobante_detalles d
      WHERE d.comprobante_id = ?
      ORDER BY d.id`,
      [comprobante.id]
    );

    return NextResponse.json({
      id: comprobante.id,
      claveAcceso: comprobante.clave_acceso,
      tipoComprobante: comprobante.tipo,
      tipoComprobanteDescripcion: TIPO_COMPROBANTE_DESCRIPCIONES[comprobante.tipo] || comprobante.tipo,
      ambiente: comprobante.ambiente,
      fechaEmision: comprobante.fecha_emision,
      establecimiento: comprobante.serie_completa?.split('-')[0] || null,
      puntoEmision: comprobante.serie_completa?.split('-')[1] || null,
      secuencial: comprobante.secuencial,
      rucEmisor: comprobante.ruc_emisor,
      razonSocialEmisor: comprobante.razon_social_emisor,
      identificacionComprador: comprobante.receptor_identificacion,
      razonSocialComprador: comprobante.receptor_razon_social,
      subtotal: parseFloat(comprobante.subtotal) || 0,
      totalImpuestos: parseFloat(comprobante.total_impuestos) || 0,
      total: parseFloat(comprobante.total) || 0,
      estado: comprobante.estado,
      fechaAutorizacion: comprobante.fecha_autorizacion,
      numAutorizacion: comprobante.numero_autorizacion,
      createdAt: comprobante.created_at,
      updatedAt: comprobante.updated_at,
      detalles: detallesResult.rows.map((d: any) => ({
        id: d.id,
        codigoPrincipal: d.codigo_principal,
        descripcion: d.descripcion,
        cantidad: parseFloat(d.cantidad) || 0,
        precioUnitario: parseFloat(d.precio_unitario) || 0,
        descuento: parseFloat(d.descuento) || 0,
        subtotal: parseFloat(d.subtotal) || 0,
      })),
      infoAdicional: [],
      xmlDisponible: comprobante.xml_disponible,
      documentosRelacionados: comprobante.documentos_relacionados || null,
    });
  } catch (error: any) {
    console.error('[Get Comprobante Detail Error]', error);
    return NextResponse.json(
      { message: error.message || 'Error interno del servidor' },
      { status: error.message?.startsWith('No autorizado') ? 401 : 500 }
    );
  }
}
