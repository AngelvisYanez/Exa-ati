import { NextResponse } from 'next/server';
import { verifyAuth } from '@/lib/sri-api/auth-helper';
import { db } from '@/lib/sri-api/db';
import { claveAccesoService } from '@/lib/sri-api/clave-acceso';
import { xmlBuilder } from '@/lib/sri-api/xml-builder';
import { xmlSigner } from '@/lib/sri-api/xml-signer';
import { xmlStorage } from '@/lib/sri-api/xml-storage';
import { sriSoapClient } from '@/lib/sri-api/sri-soap-client';
import { classifySriError } from '@/lib/sri-api/sri-error-handler';

const BUILDERS: Record<string, (data: any) => string> = {
  '01': xmlBuilder.buildFactura.bind(xmlBuilder),
  '03': xmlBuilder.buildLiquidacionCompra.bind(xmlBuilder),
  '04': xmlBuilder.buildNotaCredito.bind(xmlBuilder),
  '05': xmlBuilder.buildNotaDebito.bind(xmlBuilder),
  '06': xmlBuilder.buildGuiaRemision.bind(xmlBuilder),
  '07': xmlBuilder.buildRetencion.bind(xmlBuilder),
};

const TIPOS_SOPORTADOS = Object.keys(BUILDERS);

export async function POST(req: Request) {
  try {
    const user = await verifyAuth(req);
    const body = await req.json();

    const { tipo, emisorRuc, ambiente: ambienteOverride, datos } = body;

    if (!tipo || !emisorRuc || !datos) {
      return NextResponse.json(
        { message: 'Faltan campos requeridos: tipo, emisorRuc, datos' },
        { status: 400 }
      );
    }

    if (!TIPOS_SOPORTADOS.includes(tipo)) {
      return NextResponse.json(
        { message: `Tipo de comprobante no soportado: ${tipo}. Soportados: ${TIPOS_SOPORTADOS.join(', ')}` },
        { status: 400 }
      );
    }

    const missingCols = [
      'establecimiento VARCHAR(3) DEFAULT \'001\'',
      'punto_emision VARCHAR(3) DEFAULT \'001\'',
      'dir_matriz VARCHAR(500)',
      'tipo_emision VARCHAR(2) DEFAULT \'1\'',
      'agente_retencion VARCHAR(2)',
      'contribuyente_rimpe VARCHAR(2)',
      'obligado_contabilidad VARCHAR(2)',
      'certificado_p12 BYTEA',
      'password_certificado TEXT',
      'certificado_password_encrypted TEXT',
      'certificado_password VARCHAR(500)',
      'certificado_nombre VARCHAR(500)',
      'certificado_valido_hasta TIMESTAMP',
      'cert_valido_hasta TIMESTAMP',
      'notif_documentos BOOLEAN DEFAULT TRUE',
      'notif_generacion BOOLEAN DEFAULT TRUE',
    ];
    for (const col of missingCols) {
      await db.query(`ALTER TABLE emisores ADD COLUMN IF NOT EXISTS ${col}`).catch(() => {});
    }

    const emisor = await db.queryOne<any>(
      `SELECT id, ruc, razon_social, nombre_comercial, ambiente, tipo_emision,
              establecimiento, punto_emision, dir_matriz,
              agente_retencion, contribuyente_rimpe, obligado_contabilidad,
              certificado_p12, password_certificado, certificado_password_encrypted
       FROM emisores
       WHERE ruc = ? AND tenant_id = ? AND activo = true`,
      [emisorRuc, user.tenantId]
    );

    if (!emisor) {
      return NextResponse.json(
        { message: `Emisor con RUC ${emisorRuc} no encontrado o inactivo` },
        { status: 404 }
      );
    }

    const ambiente = ambienteOverride || emisor.ambiente;

    if (!ambiente) {
      return NextResponse.json(
        { message: `El emisor ${emisorRuc} no tiene configurado el ambiente (1=Pruebas, 2=Producción)` },
        { status: 400 }
      );
    }

    if (!emisor.establecimiento || !emisor.punto_emision) {
      return NextResponse.json(
        { message: `El emisor ${emisorRuc} no tiene configurados establecimiento y punto de emisión` },
        { status: 400 }
      );
    }

    const builder = BUILDERS[tipo];
    if (!builder) {
      return NextResponse.json(
        { message: `No hay builder para el tipo ${tipo}` },
        { status: 500 }
      );
    }

    const secuencial = String(datos.secuencial || '1').padStart(9, '0');
    const establecimiento = emisor.establecimiento.padStart(3, '0');
    const puntoEmision = emisor.punto_emision.padStart(3, '0');

    const claveAcceso = claveAccesoService.generate({
      fechaEmision: new Date(datos.fechaEmision),
      tipoComprobante: tipo,
      ruc: emisor.ruc,
      ambiente,
      establecimiento,
      puntoEmision,
      secuencial,
    });

    const infoTributaria = {
      ambiente,
      tipoEmision: emisor.tipo_emision || '1',
      razonSocial: emisor.razon_social,
      nombreComercial: emisor.nombre_comercial || undefined,
      ruc: emisor.ruc,
      claveAcceso,
      codDoc: tipo,
      estab: establecimiento,
      ptoEmi: puntoEmision,
      secuencial,
      dirMatriz: emisor.dir_matriz || '',
      agenteRetencion: emisor.agente_retencion || undefined,
      contribuyenteRimpe: emisor.contribuyente_rimpe || undefined,
    };

    const wrapInfo: Record<string, string> = {
      '01': 'infoFactura',
      '03': 'infoLiquidacionCompra',
      '04': 'infoNotaCredito',
      '05': 'infoNotaDebito',
      '06': 'infoGuiaRemision',
    };
    const infoKey = wrapInfo[tipo];
    const dataComprobante = infoKey
      ? { infoTributaria, [infoKey]: datos, detalles: datos.detalles, destinatarios: datos.destinatarios }
      : { infoTributaria, ...datos };

    const xmlSinFirma = builder(dataComprobante);

    const xmlFirmado = await xmlSigner.signXmlForEmisor(xmlSinFirma, emisor.ruc);

    const fechaEmision = new Date(datos.fechaEmision);
    xmlStorage.saveAllXmls(emisor.ruc, claveAcceso, fechaEmision, xmlSinFirma, xmlFirmado);

    const comprobanteId = await db.insert('comprobantes', {
      emisor_id: emisor.id,
      tenant_id: user.tenantId,
      clave_acceso: claveAcceso,
      tipo,
      serie: `${establecimiento}-${puntoEmision}`,
      secuencial,
      ambiente,
      fecha_emision: fechaEmision.toISOString().split('T')[0],
      estado: 'FIRMADO',
      estado_sri: 'FIRMADO',
      importe_total: datos.importeTotal || 0,
      total_sin_impuesto: datos.totalSinImpuestos || 0,
      receptor_identificacion: datos.identificacionComprador || datos.identificacionProveedor || '',
      receptor_razon_social: datos.razonSocialComprador || datos.razonSocialProveedor || '',
      emisor_ruc: emisor.ruc,
      emisor_razon_social: emisor.razon_social,
    });

    const result = await sriSoapClient.enviarYAutorizar(xmlFirmado, claveAcceso);

    await db.query(
      `UPDATE comprobantes SET
        estado = ?,
        estado_sri = ?,
        fecha_autorizacion = ?,
        numero_autorizacion = ?,
        updated_at = NOW()
       WHERE id = ?`,
      [
        result.estado,
        result.estado,
        result.fechaAutorizacion ? new Date(result.fechaAutorizacion) : null,
        result.numeroAutorizacion || null,
        comprobanteId?.id,
      ]
    );

    if (result.estado === 'AUTORIZADO' && result.xmlAutorizado) {
      xmlStorage.saveXml(emisor.ruc, claveAcceso, fechaEmision, 'autorizado', result.xmlAutorizado);
    }

    const errorClassified = classifySriError(result.mensajes, result.estado === 'EN_PROCESO' ? 'autorizacion' : 'recepcion');

    return NextResponse.json({
      success: result.success || result.estado === 'EN_PROCESO',
      claveAcceso,
      estado: result.estado,
      numeroAutorizacion: result.numeroAutorizacion,
      fechaAutorizacion: result.fechaAutorizacion,
      mensajes: result.mensajes,
      error: errorClassified
        ? { tipo: errorClassified.tipo, accion: errorClassified.accion, mensaje: errorClassified.mensaje }
        : undefined,
      requierePolling: result.estado === 'EN_PROCESO',
      comprobanteId: comprobanteId?.id,
    });
  } catch (error: any) {
    console.error('[Emitir Error]', error);
    return NextResponse.json(
      {
        success: false,
        message: error.message || 'Error interno del servidor al emitir el comprobante',
        error: {
          tipo: 'ERROR_CONEXION',
          accion: 'REINTENTAR',
          mensaje: error.message,
        },
      },
      { status: error.message?.startsWith('No autorizado') ? 401 : 500 }
    );
  }
}
