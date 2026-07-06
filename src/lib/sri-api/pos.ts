import { db } from './db';
import { xmlBuilder } from './xml-builder';
import { xmlSigner } from './xml-signer';
import { xmlStorage } from './xml-storage';
import { sriSoapClient } from './sri-soap-client';
import { claveAccesoService } from './clave-acceso';

export interface PosSaleItem {
  codigo: string;
  descripcion: string;
  cantidad: number;
  precioUnitario: number;
  ivaPorcentaje: number;
  descuento?: number;
}

export interface PosSaleData {
  emisorId: string;
  items: PosSaleItem[];
  formaPago: '01' | '02' | '03' | '19' | '20';
  cliente?: { tipoIdentificacion: string; identificacion: string; razonSocial: string; email?: string; direccion?: string };
  propina?: number;
  descuentoGlobal?: number;
  observaciones?: string;
}

export function calcularPosTotals(items: PosSaleItem[], descuentoGlobal = 0, propina = 0) {
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
  const total = Number((totalConGlobal + totalIVA + propina).toFixed(2));

  return {
    subtotalSinImpuesto: Number(subtotalSinImpuesto.toFixed(2)),
    totalDescuento: Number(totalDescuento.toFixed(2)),
    totalSinImpuesto: Number(totalConGlobal.toFixed(2)),
    totalIVA: Number(totalIVA.toFixed(2)),
    total,
    ivaDesglosado,
  };
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

export async function createPosInvoice(data: PosSaleData): Promise<{ claveAcceso: string; id: string }> {
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

  const totales = calcularPosTotals(data.items, data.descuentoGlobal, data.propina);

  const claveAcceso = claveAccesoService.generate({
    fechaEmision: ahora,
    tipoComprobante: '01',
    ruc: emisor.ruc,
    ambiente: (emisor.ambiente || '2') as any,
    establecimiento: estab,
    puntoEmision: ptoEmi,
    secuencial,
  });

  const clienteIdent = data.cliente?.identificacion || '9999999999999';
  const clienteTipo = data.cliente?.tipoIdentificacion || '07';
  const clienteNombre = data.cliente?.razonSocial || 'CONSUMIDOR FINAL';

  const pagos = [{ formaPago: data.formaPago, total: totales.total }];

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
      tipoIdentificacionComprador: clienteTipo,
      razonSocialComprador: clienteNombre,
      identificacionComprador: clienteIdent,
      direccionComprador: data.cliente?.direccion || undefined,
      totalSinImpuestos: totales.totalSinImpuesto,
      totalDescuento: totales.totalDescuento + (data.descuentoGlobal || 0),
      totalConImpuestos: totales.ivaDesglosado.map(iv => ({
        codigo: '2',
        codigoPorcentaje: codigoPorcentajeIva(iv.tarifa),
        baseImponible: iv.baseImponible,
        tarifa: tarifaNormalizada(iv.tarifa),
        valor: iv.valor,
      })),
      importeTotal: totales.total,
      propina: data.propina || 0,
      moneda: 'DOLAR',
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
    infoAdicional: data.observaciones
      ? [{ nombre: 'Observaciones', valor: data.observaciones }]
      : [],
  };

  if (data.cliente?.email) {
    facturaData.infoAdicional.push({ nombre: 'Email', valor: data.cliente.email });
  }

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
    importe_total: totales.total,
    propina: data.propina || 0,
    moneda: 'USD',
    receptor_tipo_id: clienteTipo,
    receptor_identificacion: clienteIdent,
    receptor_razon_social: clienteNombre,
    receptor_email: data.cliente?.email || null,
    emisor_ruc: emisor.ruc,
    emisor_razon_social: emisor.razon_social,
    origen: 'POS',
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
