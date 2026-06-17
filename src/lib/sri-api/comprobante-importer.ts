import { db } from './db';
import { xmlBuilder } from './xml-builder';

export type ParsedComprobante = {
  tipo: string;
  claveAcceso: string;
  rucEmisor: string;
  razonSocialEmisor: string;
  secuencial: string;
  serie: string;
  ambiente: string;
  receptorIdentificacion: string;
  receptorRazonSocial: string;
  receptorEmail: string;
  totalSinImpuestos: number;
  totalDescuento: number;
  totalIva: number;
  importeTotal: number;
  fechaEmision: Date;
  categoria: string;
};

function classifyExpense(razonSocial: string): string {
  const r = razonSocial.toLowerCase();
  if (r.includes('favorita') || r.includes('supermaxi') || r.includes('aliment') || r.includes('supermercado')) {
    return 'Alimentación';
  }
  if (r.includes('farmacia') || r.includes('hospital') || r.includes('salud') || r.includes('medico')) {
    return 'Salud';
  }
  if (r.includes('universidad') || r.includes('colegio') || r.includes('educa')) {
    return 'Educación';
  }
  if (r.includes('inmobiliaria') || r.includes('arriendo') || r.includes('vivienda')) {
    return 'Vivienda';
  }
  if (r.includes('ropa') || r.includes('textil') || r.includes('moda')) {
    return 'Vestimenta';
  }
  if (r.includes('telecom') || r.includes('claro') || r.includes('cnt') || r.includes('internet')) {
    return 'Negocio/Servicios';
  }
  return 'Otros';
}

export async function parseXmlComprobante(xmlString: string): Promise<ParsedComprobante> {
  let parsed: any = await xmlBuilder.parseXml(xmlString);

  if (parsed.autorizacion?.comprobante) {
    const comp = parsed.autorizacion.comprobante;
    parsed = typeof comp === 'string' ? await xmlBuilder.parseXml(comp) : comp;
  }

  let tipo = '';
  let infoTributaria: any = null;
  let infoDoc: any = null;

  if (parsed.factura) {
    tipo = '01';
    infoTributaria = parsed.factura.infoTributaria;
    infoDoc = parsed.factura.infoFactura;
  } else if (parsed.comprobanteRetencion) {
    tipo = '07';
    infoTributaria = parsed.comprobanteRetencion.infoTributaria;
    infoDoc = parsed.comprobanteRetencion.infoCompRetencion;
  } else if (parsed.notaCredito) {
    tipo = '04';
    infoTributaria = parsed.notaCredito.infoTributaria;
    infoDoc = parsed.notaCredito.infoNotaCredito;
  } else if (parsed.notaDebito) {
    tipo = '05';
    infoTributaria = parsed.notaDebito.infoTributaria;
    infoDoc = parsed.notaDebito.infoNotaDebito;
  } else {
    throw new Error('Tipo de comprobante no soportado en el XML');
  }

  if (!infoTributaria || !infoDoc) {
    throw new Error('Estructura XML inválida');
  }

  const claveAcceso = infoTributaria.claveAcceso;
  const rucEmisor = infoTributaria.ruc;
  const razonSocialEmisor = infoTributaria.razonSocial;
  const secuencial = infoTributaria.secuencial;
  const serie = `${infoTributaria.estab}-${infoTributaria.ptoEmi}`;
  const ambiente = infoTributaria.ambiente || '1';

  let receptorIdentificacion = '';
  let receptorRazonSocial = '';
  let receptorEmail = '';

  if (tipo === '01' || tipo === '04') {
    receptorIdentificacion = infoDoc.identificacionComprador || '';
    receptorRazonSocial = infoDoc.razonSocialComprador || '';
    receptorEmail = infoDoc.correoElectronico || '';
  } else if (tipo === '07') {
    receptorIdentificacion = infoDoc.identificacionSujetoRetenido || '';
    receptorRazonSocial = infoDoc.razonSocialSujetoRetenido || '';
    receptorEmail = infoDoc.correoElectronico || '';
  } else if (tipo === '05') {
    receptorIdentificacion = infoDoc.identificacionComprador || '';
    receptorRazonSocial = infoDoc.razonSocialComprador || '';
  }

  const totalSinImpuestos = parseFloat(infoDoc.totalSinImpuestos) || 0;
  const totalDescuento = parseFloat(infoDoc.totalDescuento) || 0;
  const importeTotal = parseFloat(infoDoc.importeTotal) || parseFloat(infoDoc.valorTotal) || 0;
  const totalIva =
    parseFloat(infoDoc.totalIva) ||
    (tipo === '01' ? Math.max(0, importeTotal - totalSinImpuestos) : 0);

  let fechaEmision = new Date();
  if (infoDoc.fechaEmision) {
    const parts = String(infoDoc.fechaEmision).split('/');
    if (parts.length === 3) {
      fechaEmision = new Date(parseInt(parts[2], 10), parseInt(parts[1], 10) - 1, parseInt(parts[0], 10));
    } else {
      fechaEmision = new Date(infoDoc.fechaEmision);
    }
  }

  return {
    tipo,
    claveAcceso,
    rucEmisor,
    razonSocialEmisor,
    secuencial,
    serie,
    ambiente,
    receptorIdentificacion,
    receptorRazonSocial,
    receptorEmail,
    totalSinImpuestos,
    totalDescuento,
    totalIva,
    importeTotal,
    fechaEmision,
    categoria: classifyExpense(razonSocialEmisor),
  };
}

export async function upsertComprobanteFromParsed(
  data: ParsedComprobante,
  tenantId: string,
  userRuc: string,
  auth?: { estado: string; fechaAutorizacion?: string; numeroAutorizacion?: string }
) {
  if (data.rucEmisor !== userRuc && data.receptorIdentificacion !== userRuc) {
    throw new Error('El comprobante no pertenece a este contribuyente');
  }

  const emisor = await db.queryOne<any>(
    'SELECT id FROM emisores WHERE ruc = ? AND tenant_id = ? AND activo = true',
    [data.rucEmisor, tenantId]
  );

  const existing = await db.queryOne<any>(
    'SELECT id, estado FROM comprobantes WHERE clave_acceso = ?',
    [data.claveAcceso]
  );

  const estado = auth?.estado === 'AUTORIZADO' ? 'AUTORIZADO' : auth?.estado || 'AUTORIZADO';
  const fechaAuth = auth?.fechaAutorizacion ? new Date(auth.fechaAutorizacion) : new Date();
  const numeroAuth = auth?.numeroAutorizacion || data.claveAcceso;

  if (existing) {
    await db.query(
      `UPDATE comprobantes SET
        tipo = COALESCE(tipo, ?),
        serie = ?,
        secuencial = ?,
        ambiente = ?,
        fecha_emision = ?,
        estado = ?,
        estado_sri = ?,
        fecha_autorizacion = ?,
        numero_autorizacion = ?,
        total_sin_impuesto = ?,
        subtotal_sin_impuesto = ?,
        total_iva = ?,
        total_descuento = ?,
        importe_total = ?,
        receptor_identificacion = ?,
        receptor_razon_social = ?,
        receptor_email = ?,
        emisor_ruc = ?,
        emisor_razon_social = ?,
        categoria = COALESCE(categoria, ?),
        tenant_id = ?,
        updated_at = NOW()
       WHERE id = ?`,
      [
        data.tipo,
        data.serie,
        data.secuencial,
        data.ambiente,
        data.fechaEmision.toISOString().split('T')[0],
        estado,
        estado,
        fechaAuth,
        numeroAuth,
        data.totalSinImpuestos,
        data.totalSinImpuestos,
        data.totalIva,
        data.totalDescuento,
        data.importeTotal,
        data.receptorIdentificacion,
        data.receptorRazonSocial,
        data.receptorEmail,
        data.rucEmisor,
        data.razonSocialEmisor,
        data.categoria,
        tenantId,
        existing.id,
      ]
    );
    return { action: 'actualizado' as const, id: existing.id, claveAcceso: data.claveAcceso };
  }

  await db.query(
    `INSERT INTO comprobantes (
      emisor_id, tipo, serie, secuencial, ambiente, clave_acceso, fecha_emision,
      estado, estado_sri, fecha_autorizacion, numero_autorizacion,
      total_sin_impuesto, subtotal_sin_impuesto, total_iva, total_descuento, importe_total,
      receptor_identificacion, receptor_razon_social, receptor_email,
      emisor_ruc, emisor_razon_social, categoria, tenant_id
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      emisor?.id || null,
      data.tipo,
      data.serie,
      data.secuencial,
      data.ambiente,
      data.claveAcceso,
      data.fechaEmision.toISOString().split('T')[0],
      estado,
      estado,
      fechaAuth,
      numeroAuth,
      data.totalSinImpuestos,
      data.totalSinImpuestos,
      data.totalIva,
      data.totalDescuento,
      data.importeTotal,
      data.receptorIdentificacion,
      data.receptorRazonSocial,
      data.receptorEmail,
      data.rucEmisor,
      data.razonSocialEmisor,
      data.categoria,
      tenantId,
    ]
  );

  const inserted = await db.queryOne<any>(
    'SELECT id FROM comprobantes WHERE clave_acceso = ?',
    [data.claveAcceso]
  );

  return { action: 'importado' as const, id: inserted?.id, claveAcceso: data.claveAcceso };
}

export async function saveAutorizadoXml(comprobanteId: string, ruc: string, claveAcceso: string, fecha: Date, xmlContent: string) {
  const { xmlStorage } = await import('./xml-storage');
  const autorizadoPath = xmlStorage.saveXml(ruc, claveAcceso, fecha, 'autorizado', xmlContent);

  try {
    await db.upsertComprobanteXml(comprobanteId, 'autorizado', autorizadoPath);
  } catch {
    // Fallback para esquemas legacy con la columna xml_autorizado_path en base de datos local
    const usesPostgres = Boolean(process.env.DATABASE_URL);
    if (usesPostgres) {
      await db.query(
        `INSERT INTO comprobante_xmls (comprobante_id, xml_autorizado_path)
         VALUES ($1, $2)
         ON CONFLICT (comprobante_id) DO UPDATE SET xml_autorizado_path = EXCLUDED.xml_autorizado_path`,
        [comprobanteId, autorizadoPath]
      ).catch(() => undefined);
    } else {
      await db.query(
        `INSERT INTO comprobante_xmls (comprobante_id, xml_autorizado_path)
         VALUES (?, ?)
         ON DUPLICATE KEY UPDATE xml_autorizado_path = VALUES(xml_autorizado_path)`,
        [comprobanteId, autorizadoPath]
      ).catch(() => undefined);
    }
  }

  return autorizadoPath;
}
