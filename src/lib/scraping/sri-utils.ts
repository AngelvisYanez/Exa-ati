import fs from 'fs';
import path from 'path';
import xml2js from 'xml2js';

export function getTipoDocDesc(cod: string): string {
  const mapping: Record<string, string> = {
    '01': 'Factura',
    '03': 'Liquidación de Compra',
    '04': 'Nota de Crédito',
    '05': 'Nota de Débito',
    '07': 'Comprobante de Retención',
  };
  return mapping[cod] || `Tipo ${cod}`;
}

export function parseSriFloat(val: any): number {
  if (val === undefined || val === null) return 0;
  let clean = String(val).replace(/[^\d.,\-]/g, '').trim();
  if (!clean) return 0;

  const hasComma = clean.includes(',');
  const hasDot = clean.includes('.');

  if (hasComma && hasDot) {
    if (clean.indexOf(',') > clean.indexOf('.')) {
      clean = clean.replace(/\./g, '').replace(',', '.');
    } else {
      clean = clean.replace(/,/g, '');
    }
  } else if (hasComma) {
    clean = clean.replace(',', '.');
  }

  return parseFloat(clean) || 0;
}

export function extractClaveAcceso(val: any): string | null {
  if (val === undefined || val === null) return null;
  const match = String(val).match(/\d{49}/);
  return match ? match[0] : null;
}

export function extractRuc(val: any): string | null {
  if (val === undefined || val === null) return null;
  const match = String(val).match(/\d{13}/);
  return match ? match[0] : null;
}

export function extractSerie(val: any): string | null {
  if (val === undefined || val === null) return null;
  const str = String(val).trim();
  if (str.length === 49 && /^\d+$/.test(str)) {
    return str.substring(24, 27) + '-' + str.substring(27, 30);
  }
  const match = str.match(/\d{3}-\d{3}/);
  return match ? match[0] : null;
}

export function extractSecuencial(val: any): string | null {
  if (val === undefined || val === null) return null;
  const str = String(val).trim();
  if (!str) return null;
  if (str.length === 49 && /^\d+$/.test(str)) {
    return str.substring(30, 39);
  }
  if (str.includes('-')) {
    const parts = str.split('-');
    return parts[parts.length - 1].padStart(9, '0');
  }
  const digitsMatch = str.match(/\d+/);
  return digitsMatch ? digitsMatch[0].padStart(9, '0') : null;
}

export function extractFechaEmision(val: any): string | null {
  if (val === undefined || val === null) return null;
  const str = String(val).trim();
  if (str.length === 49 && /^\d+$/.test(str)) {
    const d = str.substring(0, 2);
    const m = str.substring(2, 4);
    const y = str.substring(4, 8);
    return `${y}-${m}-${d}`;
  }
  return null;
}

export function mapSriTypeCode(searchTypeCode: string): string {
  const mapping: Record<string, string> = {
    '1': '01',
    '2': '03',
    '3': '04',
    '4': '05',
    '6': '07',
  };
  return mapping[searchTypeCode] || searchTypeCode;
}

export function classifyExpense(razonSocial: string | null): string {
  if (!razonSocial) return 'Otros';
  const r = razonSocial.toLowerCase();
  if (r.includes('favorita') || r.includes('supermaxi') || r.includes('aliment') || r.includes('supermercado')) return 'Alimentación';
  if (r.includes('farmacia') || r.includes('hospital') || r.includes('salud') || r.includes('medico')) return 'Salud';
  if (r.includes('universidad') || r.includes('colegio') || r.includes('educa')) return 'Educación';
  if (r.includes('inmobiliaria') || r.includes('arriendo') || r.includes('vivienda')) return 'Vivienda';
  if (r.includes('ropa') || r.includes('textil') || r.includes('moda')) return 'Vestimenta';
  if (r.includes('telecom') || r.includes('claro') || r.includes('cnt') || r.includes('internet')) return 'Negocio/Servicios';
  return 'Otros';
}

export function cleanEmisorRazonSocial(val: any): string | null {
  if (val === undefined || val === null) return null;
  return String(val)
    .replace(/\d{13}/g, '')
    .replace(/^[\s\-\:\/]+/, '')
    .replace(/[\s\-\:\/]+$/, '')
    .trim();
}

export function extractDocumentosRelacionados(compData: any, rootName: string): string | null {
  try {
    const list: string[] = [];
    if (rootName === 'notaCredito' && compData.infoNotaCredito) {
      const info = compData.infoNotaCredito;
      if (info.numDocModificado) {
        const type = getTipoDocDesc(info.codDocModificado);
        let str = `${type} ${info.numDocModificado}`;
        if (info.fechaEmisionDocSustento) str += ` (${info.fechaEmisionDocSustento})`;
        list.push(str);
      }
    } else if (rootName === 'notaDebito' && compData.infoNotaDebito) {
      const info = compData.infoNotaDebito;
      if (info.numDocModificado) {
        const type = getTipoDocDesc(info.codDocModificado);
        let str = `${type} ${info.numDocModificado}`;
        if (info.fechaEmisionDocSustento) str += ` (${info.fechaEmisionDocSustento})`;
        list.push(str);
      }
    } else if (rootName === 'comprobanteRetencion') {
      if (compData.docsSustento && compData.docsSustento.docSustento) {
        const docs = Array.isArray(compData.docsSustento.docSustento)
          ? compData.docsSustento.docSustento
          : [compData.docsSustento.docSustento];
        for (const doc of docs) {
          if (doc.numDocSustento) {
            const type = getTipoDocDesc(doc.codDocSustento);
            let str = `${type} ${doc.numDocSustento}`;
            if (doc.fechaEmisionDocSustento) str += ` (${doc.fechaEmisionDocSustento})`;
            if (!list.includes(str)) list.push(str);
          }
        }
      }
      if (compData.impuestos && compData.impuestos.impuesto) {
        const imps = Array.isArray(compData.impuestos.impuesto)
          ? compData.impuestos.impuesto
          : [compData.impuestos.impuesto];
        for (const imp of imps) {
          if (imp.numDocSustento) {
            const type = getTipoDocDesc(imp.codDocSustento || '01');
            let str = `${type} ${imp.numDocSustento}`;
            if (imp.fechaEmisionDocSustento) str += ` (${imp.fechaEmisionDocSustento})`;
            if (!list.includes(str)) list.push(str);
          }
        }
      }
    }
    return list.length > 0 ? list.join(', ') : null;
  } catch (e) {
    console.error('Error extracting related docs:', e);
    return null;
  }
}

export function extractIva(docData: any): number {
  if (!docData) return 0;
  const totalConImpuestos = docData.totalConImpuestos;
  if (totalConImpuestos && totalConImpuestos.totalImpuesto) {
    const imps = Array.isArray(totalConImpuestos.totalImpuesto)
      ? totalConImpuestos.totalImpuesto
      : [totalConImpuestos.totalImpuesto];
    const ivaImp = imps.find((imp: any) => imp.codigo === '2');
    if (ivaImp) return parseFloat(ivaImp.valor) || 0;
  }
  const impuestos = docData.impuestos;
  if (impuestos && impuestos.impuesto) {
    const imps = Array.isArray(impuestos.impuesto)
      ? impuestos.impuesto
      : [impuestos.impuesto];
    const ivaImp = imps.find((imp: any) => imp.codigo === '2');
    if (ivaImp) return parseFloat(ivaImp.valor) || 0;
  }
  return 0;
}

export function parseLocalIsoDate(dateVal: any): Date {
  if (!dateVal) return new Date();
  if (dateVal instanceof Date) return dateVal;
  const parts = String(dateVal).split('T')[0].split('-');
  if (parts.length === 3) {
    return new Date(parseInt(parts[0]), parseInt(parts[1]) - 1, parseInt(parts[2]));
  }
  return new Date(dateVal);
}

export function getDaysInRange(startD: Date, endD: Date): Date[] {
  const days: Date[] = [];
  const current = new Date(startD.getFullYear(), startD.getMonth(), startD.getDate());
  const limit = new Date(endD.getFullYear(), endD.getMonth(), endD.getDate());
  while (current <= limit) {
    days.push(new Date(current));
    current.setDate(current.getDate() + 1);
  }
  return days;
}

export async function waitForDownload(
  downloadPath: string,
  extension: string,
  timeoutMs: number = 30000
): Promise<string | null> {
  let elapsed = 0;
  const ext = extension.toLowerCase();
  while (elapsed < timeoutMs) {
    const files = fs.readdirSync(downloadPath);
    const targetFile = files.find(
      f => f.toLowerCase().endsWith(ext) && !f.endsWith('.crdownload') && !f.endsWith('.tmp') && !f.includes('.part')
    );
    if (targetFile) return path.join(downloadPath, targetFile);
    await new Promise(r => setTimeout(r, 1000));
    elapsed += 1000;
  }
  return null;
}

export interface DbLike {
  queryOne(sql: string, params?: any[]): Promise<any | null>;
  query(sql: string, params?: any[]): Promise<{ rows: any[]; rowCount: number }>;
}

export async function updateComprobanteFromXml(
  db: DbLike,
  xmlFilePath: string,
  claveAcceso: string,
  tenantId?: string | null
) {
  try {
    if (!fs.existsSync(xmlFilePath)) return;
    const xmlContent = fs.readFileSync(xmlFilePath, 'utf-8');

    const parser = new xml2js.Parser({ explicitArray: false, ignoreAttrs: true });
    const result = await parser.parseStringPromise(xmlContent);

    let autorizacion = result.autorizacion;
    let comproXml = xmlContent;
    let fechaAutorizacionStr = null;
    let numeroAutorizacionStr = claveAcceso;

    if (autorizacion) {
      fechaAutorizacionStr = autorizacion.fechaAutorizacion;
      numeroAutorizacionStr = autorizacion.numeroAutorizacion || claveAcceso;
      if (autorizacion.comprobante) {
        comproXml = autorizacion.comprobante;
      }
    }

    let compResult = result;
    if (autorizacion && autorizacion.comprobante) {
      const innerParser = new xml2js.Parser({ explicitArray: false, ignoreAttrs: true });
      compResult = await innerParser.parseStringPromise(comproXml);
    }

    const rootName = Object.keys(compResult).find(k =>
      ['factura', 'comprobanteRetencion', 'notaCredito', 'notaDebito', 'liquidacionCompra'].includes(k)
    );
    if (!rootName) {
      console.log(`[Worker] No se encontró raíz del comprobante en XML para ${claveAcceso}`);
      return;
    }

    const compData = compResult[rootName];
    const infoTributaria = compData.infoTributaria;

    let emisorRazonSocial = infoTributaria?.razonSocial || null;
    let emisorRuc = infoTributaria?.ruc || null;
    let receptorRazonSocial = null;
    let receptorIdentificacion = null;
    let subtotalSinImpuesto = 0;
    let totalIva = 0;
    let importeTotal = 0;
    let receptorEmail = null;

    if (rootName === 'factura') {
      const infoFactura = compData.infoFactura;
      receptorRazonSocial = infoFactura?.razonSocialReceptor || null;
      receptorIdentificacion = infoFactura?.identificacionReceptor || null;
      subtotalSinImpuesto = parseFloat(infoFactura?.totalSinImpuestos) || 0;
      importeTotal = parseFloat(infoFactura?.importeTotal) || 0;
      totalIva = extractIva(infoFactura);

      receptorEmail = compData.infoAdicional?.campoAdicional
        ? (Array.isArray(compData.infoAdicional.campoAdicional)
            ? compData.infoAdicional.campoAdicional.find(
                (c: any) => c._ || c.value || (typeof c === 'string' && c.includes('@'))
              )
            : compData.infoAdicional.campoAdicional)
        : null;
      if (receptorEmail && typeof receptorEmail === 'object') {
        receptorEmail = receptorEmail._ || receptorEmail.value || null;
      }
    } else if (rootName === 'liquidacionCompra') {
      const infoLiquidacion = compData.infoLiquidacionCompra;
      receptorRazonSocial = infoLiquidacion?.razonSocialReceptor || null;
      receptorIdentificacion = infoLiquidacion?.identificacionReceptor || null;
      subtotalSinImpuesto = parseFloat(infoLiquidacion?.totalSinImpuestos) || 0;
      importeTotal = parseFloat(infoLiquidacion?.importeTotal) || 0;
      totalIva = extractIva(infoLiquidacion);
    } else if (rootName === 'comprobanteRetencion') {
      const infoRetencion = compData.infoCompRetencion;
      receptorRazonSocial = infoRetencion?.razonSocialSujetoRetenido || null;
      receptorIdentificacion = infoRetencion?.identificacionSujetoRetenido || null;
    } else if (rootName === 'notaCredito') {
      const infoNC = compData.infoNotaCredito;
      receptorRazonSocial = infoNC?.razonSocialReceptor || null;
      receptorIdentificacion = infoNC?.identificacionReceptor || null;
      subtotalSinImpuesto = parseFloat(infoNC?.totalSinImpuestos) || 0;
      importeTotal = parseFloat(infoNC?.valorModificacion) || 0;
      totalIva = extractIva(infoNC);
    } else if (rootName === 'notaDebito') {
      const infoND = compData.infoNotaDebito;
      receptorRazonSocial = infoND?.razonSocialReceptor || null;
      receptorIdentificacion = infoND?.identificacionReceptor || null;
      subtotalSinImpuesto = parseFloat(infoND?.totalSinImpuestos) || 0;
      importeTotal = parseFloat(infoND?.valor) || 0;
      totalIva = extractIva(infoND);
    }

    const documentosRelacionados = extractDocumentosRelacionados(compData, rootName);

    let fechaEmisionFormatted = null;
    const infoDoc =
      compData.infoFactura ||
      compData.infoLiquidacionCompra ||
      compData.infoCompRetencion ||
      compData.infoNotaCredito ||
      compData.infoNotaDebito;
    if (infoDoc && infoDoc.fechaEmision) {
      const parts = String(infoDoc.fechaEmision).split('/');
      if (parts.length === 3) {
        fechaEmisionFormatted = `${parts[2]}-${parts[1]}-${parts[0]}`;
      } else {
        fechaEmisionFormatted = String(infoDoc.fechaEmision);
      }
    }
    if (!fechaEmisionFormatted || isNaN(Date.parse(fechaEmisionFormatted))) {
      fechaEmisionFormatted = extractFechaEmision(claveAcceso);
    }

    let fechaAutorizacionFormatted = null;
    if (fechaAutorizacionStr) {
      if (fechaAutorizacionStr.includes('T')) {
        fechaAutorizacionFormatted = fechaAutorizacionStr.replace('T', ' ').split('.')[0].substring(0, 19);
      } else {
        const parts = fechaAutorizacionStr.split(' ');
        if (parts.length >= 2) {
          const dateParts = parts[0].split('/');
          if (dateParts.length === 3) {
            fechaAutorizacionFormatted = `${dateParts[2]}-${dateParts[1]}-${dateParts[0]} ${parts[1]}`;
          }
        }
      }
    }

    if (fechaAutorizacionFormatted && isNaN(Date.parse(fechaAutorizacionFormatted))) {
      fechaAutorizacionFormatted = null;
    }

    let emisorId: string | null = null;
    if (emisorRuc && tenantId) {
      try {
        const emisor = await db.queryOne(
          "SELECT id FROM emisores WHERE ruc = $1 AND tenant_id = $2 AND activo = true",
          [emisorRuc, tenantId]
        );
        if (emisor) {
          emisorId = emisor.id;
        }
      } catch (e) {}
    }

    let xmlTypeCode = '01';
    if (rootName === 'factura') xmlTypeCode = '01';
    else if (rootName === 'liquidacionCompra') xmlTypeCode = '03';
    else if (rootName === 'notaCredito') xmlTypeCode = '04';
    else if (rootName === 'notaDebito') xmlTypeCode = '05';
    else if (rootName === 'comprobanteRetencion') xmlTypeCode = '07';

    console.log(`[Worker] Actualizando detalles del comprobante ${claveAcceso} en BD...`);
    const updateQuery = `
      UPDATE comprobantes SET
        tipo = COALESCE($1, tipo),
        emisor_razon_social = COALESCE($2, emisor_razon_social),
        receptor_razon_social = COALESCE($3, receptor_razon_social),
        receptor_identificacion = COALESCE($4, receptor_identificacion),
        emisor_ruc = COALESCE($5, emisor_ruc),
        subtotal_sin_impuesto = $6,
        total_iva = $7,
        importe_total = COALESCE(CASE WHEN $8 = 0 THEN NULL ELSE $9 END, importe_total),
        fecha_autorizacion = $10,
        numero_autorizacion = COALESCE($11, numero_autorizacion),
        receptor_email = COALESCE($12, receptor_email),
        documentos_relacionados = $13,
        tenant_id = COALESCE(tenant_id, $14),
        emisor_id = COALESCE(emisor_id, $15),
        estado = 'AUTORIZADO',
        fecha_emision = COALESCE(fecha_emision, $16),
        categoria = CASE WHEN categoria IS NULL OR categoria = 'Otros' THEN $17 ELSE categoria END,
        updated_at = NOW()
      WHERE clave_acceso = $18
    `;
    await db.query(updateQuery, [
      xmlTypeCode,
      emisorRazonSocial,
      receptorRazonSocial,
      receptorIdentificacion,
      emisorRuc,
      subtotalSinImpuesto,
      totalIva,
      importeTotal,
      importeTotal,
      fechaAutorizacionFormatted,
      numeroAutorizacionStr,
      receptorEmail,
      documentosRelacionados,
      tenantId || null,
      emisorId || null,
      fechaEmisionFormatted,
      classifyExpense(emisorRazonSocial),
      claveAcceso,
    ]);
  } catch (e: any) {
    console.error(`[Worker] Error al parsear y guardar XML para ${claveAcceso}:`, e.message);
  }
}

export async function clickButtonByText(page: any, text: string): Promise<void> {
  const el = await page.evaluateHandle((searchText: string) => {
    const buttons = Array.from(document.querySelectorAll('button, input[type="submit"], input[type="button"], a.btn, span[role="button"]'));
    const found = buttons.find(el => {
      const t = (el as HTMLElement).textContent?.trim().toLowerCase() || (el as HTMLInputElement).value?.toLowerCase();
      return t?.includes(searchText.toLowerCase());
    });
    return found || null;
  }, text);

  if (!el || el.asElement() === null) {
    console.warn(`[clickButtonByText] Button with text "${text}" not found`);
    return;
  }

  const box = await el.asElement()!.boundingBox();
  if (!box) {
    console.warn(`[clickButtonByText] Button "${text}" has no bounding box`);
    return;
  }

  const x = box.x + box.width / 2 + (Math.random() - 0.5) * 8;
  const y = box.y + box.height / 2 + (Math.random() - 0.5) * 8;

  await page.mouse.move(x, y, { steps: 3 + Math.floor(Math.random() * 5) });
  await new Promise(r => setTimeout(r, 30 + Math.random() * 80));
  await page.mouse.click(x, y);
}

export async function realisticClick(page: any, selector: string): Promise<void> {
  const el = await page.$(selector);
  if (!el) {
    console.warn(`[realisticClick] Selector not found: ${selector}`);
    return;
  }
  const box = await el.boundingBox();
  if (!box) {
    console.warn(`[realisticClick] Element has no bounding box: ${selector}`);
    return;
  }

  const x = box.x + box.width / 2 + (Math.random() - 0.5) * 8;
  const y = box.y + box.height / 2 + (Math.random() - 0.5) * 8;

  await page.mouse.move(x, y, { steps: 3 + Math.floor(Math.random() * 5) });
  await new Promise(r => setTimeout(r, 30 + Math.random() * 80));
  await page.mouse.click(x, y);
}
