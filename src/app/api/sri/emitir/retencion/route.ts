import { NextResponse } from 'next/server';
import { verifyAuth } from '@/lib/sri-api/auth-helper';
import { db } from '@/lib/sri-api/db';
import { xmlBuilder } from '@/lib/sri-api/xml-builder';
import { xmlSigner } from '@/lib/sri-api/xml-signer';
import { sriSoapClient, SriOperationResult } from '@/lib/sri-api/sri-soap-client';
import { xmlStorage } from '@/lib/sri-api/xml-storage';
import { claveAccesoService } from '@/lib/sri-api/clave-acceso';
import { sincronizarConSri } from '@/lib/sri-api/sync-service';
import { Decimal } from 'decimal.js';

export async function POST(req: Request) {
  try {
    const user = await verifyAuth(req);
    const dto = await req.json();

    if (!dto.emisor?.ruc) {
      return NextResponse.json({ message: 'Los datos del emisor y su RUC son obligatorios' }, { status: 400 });
    }

    const ruc = dto.emisor.ruc;

    if (user.rol !== 'SUPERADMIN') {
      const emisorCheck = await db.queryOne(
        'SELECT id, tenant_id FROM emisores WHERE ruc = ? AND activo = true',
        [ruc]
      );
      if (!emisorCheck || emisorCheck.tenant_id !== user.tenantId) {
        return NextResponse.json({ message: 'Acceso denegado a este emisor' }, { status: 403 });
      }
    }

    const emisor = await db.queryOne<any>(
      `SELECT id, ruc, razon_social, nombre_comercial, direccion_matriz, obligado_contabilidad,
              ambiente, establecimiento, punto_emision, tenant_id, certificado_p12, password_certificado
       FROM emisores WHERE ruc = ? AND activo = true`,
      [ruc]
    );

    if (!emisor) {
      return NextResponse.json({ message: `Emisor con RUC ${ruc} no encontrado o inactivo` }, { status: 404 });
    }

    if (!emisor.certificado_p12 && !emisor.password_certificado) {
      return NextResponse.json(
        { message: `El emisor con RUC ${ruc} no tiene firma digital .p12 configurada.` },
        { status: 400 }
      );
    }

    if (!emisor.ambiente) {
      return NextResponse.json(
        { message: `El emisor con RUC ${ruc} no tiene configurado el ambiente (1=Pruebas, 2=Producción)` },
        { status: 400 }
      );
    }

    const estab = (dto.emisor?.establecimiento || emisor.establecimiento || '').padStart(3, '0');
    const ptoEmi = (dto.emisor?.puntoEmision || emisor.puntoEmision || '').padStart(3, '0');
    if (!estab || estab === '000' || !ptoEmi || ptoEmi === '000') {
      return NextResponse.json(
        { message: `El emisor con RUC ${ruc} no tiene configurados establecimiento y punto de emisión` },
        { status: 400 }
      );
    }
    const serie = `${estab}-${ptoEmi}`;

    let secuencial = dto.secuencial?.padStart(9, '0');
    if (!secuencial) {
      secuencial = await db.transaction<string>(async (client) => {
        const usesPostgres = Boolean(process.env.DATABASE_URL);
        if (usesPostgres) {
          await client.query(
            `INSERT INTO secuenciales (emisor_id, tipo_comprobante, serie, ultimo_secuencial)
             VALUES ($1, '07', $2, 1)
             ON CONFLICT (emisor_id, tipo_comprobante, serie) 
             DO UPDATE SET ultimo_secuencial = secuenciales.ultimo_secuencial + 1, updated_at = NOW()`,
            [emisor.id, serie]
          );
          const res = await client.query(
            `SELECT ultimo_secuencial FROM secuenciales
             WHERE emisor_id = $1 AND tipo_comprobante = '07' AND serie = $2`,
            [emisor.id, serie]
          );
          return String(res.rows[0].ultimo_secuencial).padStart(9, '0');
        } else {
          await client.query(
            `INSERT INTO secuenciales (emisor_id, tipo_comprobante, serie, ultimo_secuencial)
             VALUES (?, '07', ?, 1)
             ON DUPLICATE KEY UPDATE ultimo_secuencial = ultimo_secuencial + 1, updated_at = NOW()`,
            [emisor.id, serie]
          );
          const [rows] = await client.query(
            `SELECT ultimo_secuencial FROM secuenciales
             WHERE emisor_id = ? AND tipo_comprobante = '07' AND serie = ?`,
            [emisor.id, serie]
          );
          const row = (rows as any[])[0];
          return String(row.ultimo_secuencial).padStart(9, '0');
        }
      });
    }

    const ambiente = emisor.ambiente;
    const tipoEmision = dto.tipoEmision || emisor.tipo_emision || '1';

    let fechaEmision: Date;
    if (dto.fechaEmision?.includes('/')) {
      const [day, month, year] = dto.fechaEmision.split('/');
      fechaEmision = new Date(parseInt(year, 10), parseInt(month, 10) - 1, parseInt(day, 10));
    } else {
      fechaEmision = new Date(dto.fechaEmision || Date.now());
    }

    if (fechaEmision > new Date()) {
      return NextResponse.json(
        { message: 'La fecha de emisión no puede ser mayor a la fecha actual' },
        { status: 400 }
      );
    }

    const claveAcceso = claveAccesoService.generate({
      fechaEmision,
      tipoComprobante: '07',
      ruc,
      ambiente: ambiente as any,
      establecimiento: estab,
      puntoEmision: ptoEmi,
      secuencial,
      tipoEmision: tipoEmision as any,
    });

    // Calcular totales retenidos
    let totalRetenido = new Decimal(0);
    const impuestosParsed = (dto.impuestos || []).map((imp: any) => {
      totalRetenido = totalRetenido.plus(new Decimal(imp.valorRetenido));
      return {
        codigo: imp.codigo,
        codigoRetencion: imp.codigoRetencion,
        baseImponible: imp.baseImponible,
        porcentajeRetener: imp.porcentajeRetener,
        valorRetenido: imp.valorRetenido,
        codDocSustento: imp.codDocSustento,
        numDocSustento: imp.numDocSustento,
        fechaEmisionDocSustento: imp.fechaEmisionDocSustento,
      };
    });

    const retencionXmlData = {
      infoTributaria: {
        ambiente,
        tipoEmision,
        razonSocial: emisor.razon_social,
        nombreComercial: emisor.nombre_comercial || emisor.razon_social,
        ruc,
        claveAcceso,
        codDoc: '07',
        estab,
        ptoEmi,
        secuencial,
        dirMatriz: emisor.direccion_matriz || 'S/N',
      },
      infoCompRetencion: {
        fechaEmision: dto.fechaEmision,
        dirEstablecimiento: dto.emisor.dirEstablecimiento || emisor.direccion_matriz || 'S/N',
        obligadoContabilidad: emisor.obligado_contabilidad === 'SI' ? 'SI' : 'NO',
        tipoIdentificacionSujetoRetenido: dto.sujetoRetenido.tipoIdentificacion,
        razonSocialSujetoRetenido: dto.sujetoRetenido.razonSocial,
        identificacionSujetoRetenido: dto.sujetoRetenido.identificacion,
        periodoFiscal: dto.periodoFiscal,
      },
      impuestos: dto.impuestos || [],
      infoAdicional: dto.sujetoRetenido.email
        ? [{ nombre: 'Email', valor: dto.sujetoRetenido.email }]
        : [],
    };

    const xmlSinFirma = xmlBuilder.buildRetencion(retencionXmlData);
    let xmlFirmado: string;
    try {
      xmlFirmado = await xmlSigner.signXmlForEmisor(xmlSinFirma, ruc);
    } catch (err: any) {
      return NextResponse.json({ message: `Error al firmar XML: ${err.message}` }, { status: 500 });
    }

    let resultado: SriOperationResult;
    try {
      resultado = await sriSoapClient.enviarYAutorizar(xmlFirmado, claveAcceso);
    } catch (err: any) {
      resultado = {
        success: false,
        claveAcceso,
        estado: 'PENDIENTE',
        mensajes: [{ identificador: 'SRI_TIMEOUT', mensaje: err.message, tipo: 'ERROR' }],
      };
    }

    const estado = resultado.success ? 'AUTORIZADO' : resultado.estado;

    await db.query(
      `INSERT INTO comprobantes (
        emisor_id, tipo, serie, secuencial, ambiente, tipo_emision, clave_acceso, fecha_emision,
        estado, estado_sri, fecha_autorizacion, numero_autorizacion,
        importe_total, moneda,
        receptor_tipo_id, receptor_identificacion, receptor_razon_social, receptor_email,
        emisor_ruc, emisor_razon_social, tenant_id, periodo_fiscal
      ) VALUES (?, '07', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        emisor.id, serie, secuencial, ambiente, tipoEmision, claveAcceso,
        fechaEmision.toISOString().split('T')[0], estado, resultado.estado,
        resultado.fechaAutorizacion ? new Date(resultado.fechaAutorizacion) : null,
        resultado.numeroAutorizacion || claveAcceso,
        totalRetenido.toDecimalPlaces(2).toNumber(), 'USD',
        dto.sujetoRetenido.tipoIdentificacion, dto.sujetoRetenido.identificacion,
        dto.sujetoRetenido.razonSocial, dto.sujetoRetenido.email || null,
        ruc, emisor.razon_social, emisor.tenant_id, dto.periodoFiscal
      ]
    );

    const comp = await db.queryOne<any>('SELECT id FROM comprobantes WHERE clave_acceso = ?', [claveAcceso]);
    if (comp?.id) {
      // Insertar detalles de retenciones
      for (const imp of impuestosParsed) {
        await db.query(
          `INSERT INTO comprobante_retenciones (
             comprobante_id, codigo, codigo_retencion, base_imponible, porcentaje_retener, valor_retenido,
             cod_doc_sustento, num_doc_sustento, fecha_emision_doc_sustento
           ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            comp.id, imp.codigo, imp.codigoRetencion, imp.baseImponible, imp.porcentajeRetener, imp.valorRetenido,
            imp.codDocSustento, imp.numDocSustento,
            imp.fechaEmisionDocSustento.includes('/') ? imp.fechaEmisionDocSustento.split('/').reverse().join('-') : imp.fechaEmisionDocSustento
          ]
        );
      }

      const xmlPaths = xmlStorage.saveAllXmls(ruc, claveAcceso, fechaEmision, undefined, xmlFirmado, resultado.xmlAutorizado);
      if (xmlPaths.firmadoPath) {
        await db.upsertComprobanteXml(comp.id, 'firmado', xmlPaths.firmadoPath);
      }
      if (xmlPaths.autorizadoPath) {
        await db.upsertComprobanteXml(comp.id, 'autorizado', xmlPaths.autorizadoPath);
      }
    }

    if (emisor.tenant_id) {
      try {
        await sincronizarConSri(emisor.tenant_id, ruc, { clavesAcceso: [claveAcceso], limite: 1 });
      } catch (syncErr: any) {
        console.warn('[Emitir Retencion] Post-sync falló:', syncErr.message);
      }
    }

    return NextResponse.json({
      success: resultado.success,
      claveAcceso,
      estado: resultado.estado,
      fechaAutorizacion: resultado.fechaAutorizacion,
      numeroAutorizacion: resultado.numeroAutorizacion,
      mensajes: resultado.mensajes,
    });
  } catch (error: any) {
    console.error('[Emit Retencion Error]', error);
    return NextResponse.json(
      { message: error.message || 'Error interno del servidor al emitir retencion' },
      { status: error.message?.startsWith('No autorizado') ? 401 : 500 }
    );
  }
}
