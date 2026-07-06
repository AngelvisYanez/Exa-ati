import { db } from './db';
import { xmlBuilder } from './xml-builder';
import { xmlSigner } from './xml-signer';
import { xmlStorage } from './xml-storage';
import { sriSoapClient } from './sri-soap-client';
import { claveAccesoService } from './clave-acceso';

export interface EcommerceItem {
  codigo: string;
  descripcion: string;
  cantidad: number;
  precioUnitario: number;
  ivaPorcentaje: number;
  descuento?: number;
}

export interface EcommerceSaleData {
  emisorId: string;
  items: EcommerceItem[];
  cliente: { tipoIdentificacion: string; identificacion: string; razonSocial: string; email: string; direccion?: string };
  formaPago: string;
  guiaRemision?: string;
  pedidoId?: string;
  moneda?: string;
  plazo?: string;
  descuentoGlobal?: number;
  importeTotal?: number;
}

function codigoPorcentajeIva(tarifa: number): string {
  if (tarifa === 0) return '0';
  if (tarifa === 5) return '3';
  if (tarifa === 12) return '2';
  if (tarifa === 14) return '2';
  if (tarifa === 15) return '2';
  return '2';
}

function tarifaNormalizada(tarifa: number): number {
  if (tarifa === 14 || tarifa === 15) return 15;
  if (tarifa === 5) return 5;
  if (tarifa === 12) return 12;
  return 0;
}

export function calcularEcommerceTotals(items: EcommerceItem[], descuentoGlobal = 0) {
  let subtotalSinImpuesto = 0;
  let totalDescuento = 0;
  const ivaMap = new Map<number, { tarifa: number; baseImponible: number; valor: number }>();

  for (const item of items) {
    const base = item.cantidad * item.precioUnitario;
    const desc = (item.descuento || 0);
    const baseConDesc = base - desc;
    subtotalSinImpuesto += baseConDesc;
    totalDescuento += desc;

    if (item.ivaPorcentaje > 0) {
      const existing = ivaMap.get(item.ivaPorcentaje);
      const valorIva = baseConDesc * item.ivaPorcentaje / 100;
      if (existing) {
        existing.baseImponible += baseConDesc;
        existing.valor += valorIva;
      } else {
        ivaMap.set(item.ivaPorcentaje, { tarifa: item.ivaPorcentaje, baseImponible: baseConDesc, valor: valorIva });
      }
    } else {
      const existing = ivaMap.get(0);
      if (existing) {
        existing.baseImponible += baseConDesc;
      } else {
        ivaMap.set(0, { tarifa: 0, baseImponible: baseConDesc, valor: 0 });
      }
    }
  }

  const ivaDesglosado = Array.from(ivaMap.values()).map(v => ({
    tarifa: v.tarifa,
    baseImponible: Number(v.baseImponible.toFixed(2)),
    valor: Number(v.valor.toFixed(2)),
  }));

  const totalIVA = ivaDesglosado.reduce((s, v) => s + v.valor, 0);
  const totalConGlobal = subtotalSinImpuesto - descuentoGlobal;
  const total = Number((totalConGlobal + totalIVA).toFixed(2));

  return {
    subtotalSinImpuesto: Number(subtotalSinImpuesto.toFixed(2)),
    totalDescuento: Number(totalDescuento.toFixed(2)),
    totalSinImpuesto: Number(totalConGlobal.toFixed(2)),
    totalIVA: Number(totalIVA.toFixed(2)),
    total,
    ivaDesglosado,
  };
}

export async function createEcommerceInvoice(data: EcommerceSaleData): Promise<{ claveAcceso: string; id: string }> {
  const emisor = await db.queryOne<any>(
    `SELECT id, ruc, razon_social, nombre_comercial, ambiente, tipo_emision,
            establecimiento, punto_emision, dir_matriz,
            obligado_contabilidad
     FROM emisores WHERE id = ? AND activo = true`,
    [data.emisorId]
  );

  if (!emisor) {
    throw new Error('Emisor no encontrado o inactivo');
  }

  const estab = emisor.establecimiento.padStart(3, '0');
  const ptoEmi = emisor.punto_emision.padStart(3, '0');

  const secuencial = await db.transaction<string>(async (client) => {
    const usesPostgres = Boolean(process.env.DATABASE_URL);
    if (usesPostgres) {
      await client.query(
        `INSERT INTO secuenciales (emisor_id, tipo_comprobante, serie, ultimo_secuencial)
         VALUES ($1, '01', $2, 1)
         ON CONFLICT (emisor_id, tipo_comprobante, serie)
         DO UPDATE SET ultimo_secuencial = secuenciales.ultimo_secuencial + 1, updated_at = NOW()`,
        [emisor.id, `${estab}-${ptoEmi}`]
      );
      const res = await client.query(
        `SELECT ultimo_secuencial FROM secuenciales
         WHERE emisor_id = $1 AND tipo_comprobante = '01' AND serie = $2`,
        [emisor.id, `${estab}-${ptoEmi}`]
      );
      return String(res.rows[0].ultimo_secuencial).padStart(9, '0');
    } else {
      await client.query(
        `INSERT INTO secuenciales (emisor_id, tipo_comprobante, serie, ultimo_secuencial)
         VALUES (?, '01', ?, 1)
         ON DUPLICATE KEY UPDATE ultimo_secuencial = ultimo_secuencial + 1, updated_at = NOW()`,
        [emisor.id, `${estab}-${ptoEmi}`]
      );
      const [rows] = await client.query(
        `SELECT ultimo_secuencial FROM secuenciales
         WHERE emisor_id = ? AND tipo_comprobante = '01' AND serie = ?`,
        [emisor.id, `${estab}-${ptoEmi}`]
      );
      return String((rows as any[])[0].ultimo_secuencial).padStart(9, '0');
    }
  });

  const ahora = new Date();
  const fechaStr = ahora.toISOString().split('T')[0];
  const moneda = data.moneda || 'DOLAR';

  const totales = calcularEcommerceTotals(data.items, data.descuentoGlobal);

  const claveAcceso = claveAccesoService.generate({
    fechaEmision: ahora,
    tipoComprobante: '01',
    ruc: emisor.ruc,
    ambiente: (emisor.ambiente || '2') as any,
    establecimiento: estab,
    puntoEmision: ptoEmi,
    secuencial,
  });

  const pagos = data.plazo
    ? [{ formaPago: data.formaPago, total: totales.total, plazo: data.plazo, unidadTiempo: 'dias' }]
    : [{ formaPago: data.formaPago, total: totales.total }];

  const facturaData = {
    infoTributaria: {
      ambiente: emisor.ambiente || '2',
      tipoEmision: emisor.tipo_emision || '1',
      razonSocial: emisor.razon_social,
      nombreComercial: emisor.nombre_comercial || undefined,
      ruc: emisor.ruc,
      claveAcceso,
      codDoc: '01',
      estab,
      ptoEmi,
      secuencial,
      dirMatriz: emisor.dir_matriz || '',
    },
    infoFactura: {
      fechaEmision: fechaStr,
      obligadoContabilidad: emisor.obligado_contabilidad || 'NO',
      tipoIdentificacionComprador: data.cliente.tipoIdentificacion,
      razonSocialComprador: data.cliente.razonSocial,
      identificacionComprador: data.cliente.identificacion,
      direccionComprador: data.cliente.direccion || undefined,
      guiaRemision: data.guiaRemision || undefined,
      totalSinImpuestos: totales.totalSinImpuesto,
      totalDescuento: totales.totalDescuento + (data.descuentoGlobal || 0),
      totalConImpuestos: totales.ivaDesglosado.map(iv => ({
        codigo: '2',
        codigoPorcentaje: codigoPorcentajeIva(iv.tarifa),
        baseImponible: iv.baseImponible,
        tarifa: tarifaNormalizada(iv.tarifa),
        valor: iv.valor,
      })),
      importeTotal: data.importeTotal ?? totales.total,
      moneda,
      pagos,
    },
    detalles: data.items.map(item => {
      const base = item.cantidad * item.precioUnitario;
      const desc = (item.descuento || 0);
      return {
        codigoPrincipal: item.codigo,
        descripcion: item.descripcion,
        cantidad: item.cantidad,
        precioUnitario: item.precioUnitario,
        descuento: desc,
        precioTotalSinImpuesto: base - desc,
        impuestos: [{
          codigo: '2',
          codigoPorcentaje: codigoPorcentajeIva(item.ivaPorcentaje),
          tarifa: tarifaNormalizada(item.ivaPorcentaje),
          baseImponible: base - desc,
          valor: item.ivaPorcentaje > 0 ? ((base - desc) * item.ivaPorcentaje / 100) : 0,
        }],
      };
    }),
    infoAdicional: [
      { nombre: 'Email', valor: data.cliente.email },
      ...(data.pedidoId ? [{ nombre: 'Pedido', valor: data.pedidoId }] : []),
    ],
  };

  const xmlSinFirma = xmlBuilder.buildFactura(facturaData);
  const xmlFirmado = await xmlSigner.signXmlForEmisor(xmlSinFirma, emisor.ruc);

  const comprobanteRecord = await db.insert('comprobantes', {
    emisor_id: emisor.id,
    tipo: '01',
    serie: `${estab}-${ptoEmi}`,
    secuencial,
    ambiente: emisor.ambiente || '2',
    tipo_emision: emisor.tipo_emision || '1',
    clave_acceso: claveAcceso,
    fecha_emision: fechaStr,
    estado: 'FIRMADO',
    estado_sri: 'FIRMADO',
    total_sin_impuesto: totales.totalSinImpuesto,
    importe_total: data.importeTotal ?? totales.total,
    moneda,
    receptor_tipo_id: data.cliente.tipoIdentificacion,
    receptor_identificacion: data.cliente.identificacion,
    receptor_razon_social: data.cliente.razonSocial,
    receptor_email: data.cliente.email,
    emisor_ruc: emisor.ruc,
    emisor_razon_social: emisor.razon_social,
    origen: 'ECOMMERCE',
    documentos_relacionados: data.pedidoId || null,
  });

  xmlStorage.saveAllXmls(emisor.ruc, claveAcceso, ahora, xmlSinFirma, xmlFirmado);

  const result = await sriSoapClient.enviarYAutorizar(xmlFirmado, claveAcceso);

  await db.query(
    `UPDATE comprobantes SET
      estado = ?, estado_sri = ?,
      fecha_autorizacion = ?, numero_autorizacion = ?,
      updated_at = NOW()
     WHERE id = ?`,
    [
      result.estado,
      result.estado,
      result.fechaAutorizacion ? new Date(result.fechaAutorizacion) : null,
      result.numeroAutorizacion || null,
      comprobanteRecord?.id,
    ]
  );

  if (result.estado === 'AUTORIZADO' && result.xmlAutorizado) {
    xmlStorage.saveXml(emisor.ruc, claveAcceso, ahora, 'autorizado', result.xmlAutorizado);
  }

  return { claveAcceso, id: comprobanteRecord?.id || '' };
}

export async function sendInvoiceEmail(claveAcceso: string): Promise<boolean> {
  const comprobante = await db.queryOne<any>(
    `SELECT clave_acceso, receptor_email, receptor_razon_social, emisor_ruc, serie, secuencial, importe_total
     FROM comprobantes WHERE clave_acceso = ? AND estado = 'AUTORIZADO'`,
    [claveAcceso]
  );

  if (!comprobante) {
    throw new Error('Comprobante no encontrado o no autorizado');
  }

  if (!comprobante.receptor_email) {
    throw new Error('El cliente no tiene email registrado');
  }

  const emisor = await db.queryOne<any>(
    `SELECT razon_social, ruc FROM emisores WHERE ruc = ? AND activo = true`,
    [comprobante.emisor_ruc]
  );

  const apiUrl = process.env.NEXT_PUBLIC_SRI_API_URL || '';
  const pdfUrl = `${apiUrl}/api/sri/comprobantes/${claveAcceso}/pdf`;
  const subject = `Factura ${comprobante.serie}-${comprobante.secuencial} - ${emisor?.razon_social || ''}`;
  const body = `Estimado/a ${comprobante.receptor_razon_social},\n\nAdjuntamos su factura electrónica ${comprobante.serie}-${comprobante.secuencial} por un valor de $${parseFloat(comprobante.importe_total).toFixed(2)}.\n\nClave de Acceso: ${claveAcceso}\n\nGracias por su preferencia.`;

  try {
    const transporter = await getMailTransporter();
    await transporter.sendMail({
      to: comprobante.receptor_email,
      subject,
      text: body,
      attachments: [{ filename: `factura_${claveAcceso}.pdf`, path: pdfUrl }],
    });
    return true;
  } catch {
    return false;
  }
}

async function getMailTransporter() {
  const nodemailer = await import('nodemailer');
  return nodemailer.default.createTransport({
    host: process.env.SMTP_HOST || 'localhost',
    port: parseInt(process.env.SMTP_PORT || '587', 10),
    secure: process.env.SMTP_SECURE === 'true',
    auth: process.env.SMTP_USER ? {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    } : undefined,
  });
}
