import fs from 'fs';
import path from 'path';
import xml2js from 'xml2js';
import fetch from 'node-fetch';

function getTipoDocDesc(cod: string): string {
  const mapping: Record<string, string> = {
    '01': 'Factura',
    '03': 'Liquidación de Compra',
    '04': 'Nota de Crédito',
    '05': 'Nota de Débito',
    '07': 'Comprobante de Retención',
  };
  return mapping[cod] || `Tipo ${cod}`;
}

function parseSriFloat(val: any): number {
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

function extractClaveAcceso(val: any): string | null {
  if (val === undefined || val === null) return null;
  const match = String(val).match(/\d{49}/);
  return match ? match[0] : null;
}

function extractRuc(val: any): string | null {
  if (val === undefined || val === null) return null;
  const match = String(val).match(/\d{13}/);
  return match ? match[0] : null;
}

function extractSerie(val: any): string | null {
  if (val === undefined || val === null) return null;
  const str = String(val).trim();
  if (str.length === 49 && /^\d+$/.test(str)) {
    return str.substring(24, 27) + '-' + str.substring(27, 30);
  }
  const match = str.match(/\d{3}-\d{3}/);
  return match ? match[0] : null;
}

function extractSecuencial(val: any): string | null {
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

function extractFechaEmision(val: any): string | null {
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

function mapSriTypeCode(searchTypeCode: string): string {
  const mapping: Record<string, string> = {
    '1': '01', // Factura
    '2': '03', // Liquidación de compra
    '3': '04', // Nota de Crédito
    '4': '05', // Nota de Débito
    '6': '07', // Retención
  };
  return mapping[searchTypeCode] || searchTypeCode;
}

function classifyExpense(razonSocial: string | null): string {
  if (!razonSocial) return 'Otros';
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

function cleanEmisorRazonSocial(val: any): string | null {
  if (val === undefined || val === null) return null;
  return String(val)
    .replace(/\d{13}/g, '')
    .replace(/^[\s\-\:\/]+/, '')
    .replace(/[\s\-\:\/]+$/, '')
    .trim();
}

function extractDocumentosRelacionados(compData: any, rootName: string): string | null {
  try {
    const list: string[] = [];
    if (rootName === 'notaCredito' && compData.infoNotaCredito) {
      const info = compData.infoNotaCredito;
      if (info.numDocModificado) {
        const type = getTipoDocDesc(info.codDocModificado);
        let str = `${type} ${info.numDocModificado}`;
        if (info.fechaEmisionDocSustento) {
          str += ` (${info.fechaEmisionDocSustento})`;
        }
        list.push(str);
      }
    } else if (rootName === 'notaDebito' && compData.infoNotaDebito) {
      const info = compData.infoNotaDebito;
      if (info.numDocModificado) {
        const type = getTipoDocDesc(info.codDocModificado);
        let str = `${type} ${info.numDocModificado}`;
        if (info.fechaEmisionDocSustento) {
          str += ` (${info.fechaEmisionDocSustento})`;
        }
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
            if (doc.fechaEmisionDocSustento) {
              str += ` (${doc.fechaEmisionDocSustento})`;
            }
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
            if (imp.fechaEmisionDocSustento) {
              str += ` (${imp.fechaEmisionDocSustento})`;
            }
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

function extractIva(docData: any): number {
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

async function updateComprobanteFromXml(pool: any, xmlFilePath: string, claveAcceso: string, tenantId?: string | null) {
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
    
    const rootName = Object.keys(compResult).find(k => ['factura', 'comprobanteRetencion', 'notaCredito', 'notaDebito', 'liquidacionCompra'].includes(k));
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
            ? compData.infoAdicional.campoAdicional.find((c: any) => c._ || c.value || (typeof c === 'string' && c.includes('@')))
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
    const infoDoc = compData.infoFactura || compData.infoLiquidacionCompra || compData.infoCompRetencion || compData.infoNotaCredito || compData.infoNotaDebito;
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
        const [emRows] = await pool.query(
          "SELECT id FROM emisores WHERE ruc = ? AND tenant_id = ? AND activo = 1 LIMIT 1",
          [emisorRuc, tenantId]
        );
        if (emRows && (emRows as any[]).length > 0) {
          emisorId = (emRows as any[])[0].id;
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
        tipo = COALESCE(?, tipo),
        emisor_razon_social = COALESCE(?, emisor_razon_social),
        receptor_razon_social = COALESCE(?, receptor_razon_social),
        receptor_identificacion = COALESCE(?, receptor_identificacion),
        emisor_ruc = COALESCE(?, emisor_ruc),
        subtotal_sin_impuesto = ?,
        total_iva = ?,
        importe_total = COALESCE(IF(? = 0, NULL, ?), importe_total),
        fecha_autorizacion = ?,
        numero_autorizacion = COALESCE(?, numero_autorizacion),
        receptor_email = COALESCE(?, receptor_email),
        documentos_relacionados = ?,
        tenant_id = COALESCE(tenant_id, ?),
        emisor_id = COALESCE(emisor_id, ?),
        estado = 'AUTORIZADO',
        fecha_emision = COALESCE(fecha_emision, ?),
        categoria = IF(categoria IS NULL OR categoria = 'Otros', ?, categoria),
        updated_at = NOW()
      WHERE clave_acceso = ?
    `;
    await pool.query(updateQuery, [
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
      claveAcceso
    ]);
  } catch (e: any) {
    console.error(`[Worker] Error al parsear y guardar XML para ${claveAcceso}:`, e.message);
  }
}

function parseLocalIsoDate(dateVal: any): Date {
  if (!dateVal) return new Date();
  if (dateVal instanceof Date) return dateVal;
  const parts = String(dateVal).split('T')[0].split('-');
  if (parts.length === 3) {
    return new Date(parseInt(parts[0]), parseInt(parts[1]) - 1, parseInt(parts[2]));
  }
  return new Date(dateVal);
}

function getDaysInRange(startD: Date, endD: Date): Date[] {
  const days: Date[] = [];
  const current = new Date(startD.getFullYear(), startD.getMonth(), startD.getDate());
  const limit = new Date(endD.getFullYear(), endD.getMonth(), endD.getDate());
  
  while (current <= limit) {
    days.push(new Date(current));
    current.setDate(current.getDate() + 1);
  }
  return days;
}

async function waitForDownload(downloadPath: string, extension: string, timeoutMs: number = 30000): Promise<string | null> {
  let elapsed = 0;
  const ext = extension.toLowerCase();
  while (elapsed < timeoutMs) {
    const files = fs.readdirSync(downloadPath);
    const targetFile = files.find(f => f.toLowerCase().endsWith(ext) && !f.endsWith('.crdownload') && !f.endsWith('.tmp') && !f.includes('.part'));
    if (targetFile) return path.join(downloadPath, targetFile);
    await new Promise(r => setTimeout(r, 1000));
    elapsed += 1000;
  }
  return null;
}

export async function downloadReceivedComprobantes(
  page: any,
  pool: any,
  job: any,
  updateProgress: (pool: any, id: number, message: string, status?: string) => Promise<void>,
  solveRecaptchaAntiCaptcha: any,
  trySolveRecaptcha: any
): Promise<void> {
  const startD = parseLocalIsoDate(job.fecha_desde);
  const endD = parseLocalIsoDate(job.fecha_hasta);
  const docTypeSelect = job.tipo_comprobante || '1';

  let tenantId: string | null = null;
  try {
    const [emisorRows] = await pool.query(
      "SELECT tenant_id FROM emisores WHERE ruc = ? AND activo = 1 LIMIT 1",
      [job.ruc]
    );
    if (emisorRows && (emisorRows as any[]).length > 0) {
      tenantId = (emisorRows as any[])[0].tenant_id;
    }
  } catch (err: any) {
    console.error('[Worker] Error al consultar tenantId:', err.message);
  }

  await updateProgress(pool, job.id, 'Navegando a Comprobantes Recibidos...');
  try {
    await page.goto('https://srienlinea.sri.gob.ec/tuportal-internet/accederAplicacion.jspa?redireccion=57&idGrupo=55', { 
      waitUntil: 'domcontentloaded',
      timeout: 45000
    });
  } catch (err: any) {
    if (err.message.includes('net::ERR_ABORTED') || err.message.includes('Navigation aborted')) {
      console.log('[Worker] Redirección en progreso (ERR_ABORTED ignorado)');
    } else {
      throw err;
    }
  }
  
  await updateProgress(pool, job.id, 'Esperando a que cargue la aplicación de comprobantes...');
  await page.waitForSelector('select[id*="ano"], select[name*="ano"], input[value="ruc"]', { timeout: 45000 });
  await new Promise(r => setTimeout(r, 3000));

  const daysToCheck = getDaysInRange(startD, endD);
  let xmlsDescargados = 0;
  let pdfsDescargados = 0;
  const typeCodes = docTypeSelect === 'todos' ? ['1', '2', '3', '4', '6'] : [docTypeSelect];

  const downloadsDir = path.resolve('./downloads');
  const tempPath = path.join(downloadsDir, 'temp');
  const xmlPath = path.join(downloadsDir, 'XML');
  const pdfPath = path.join(downloadsDir, 'RIDE');

  const clearTempFolder = () => {
    const tempFiles = fs.readdirSync(tempPath);
    for (const f of tempFiles) {
      try { fs.unlinkSync(path.join(tempPath, f)); } catch(e) {}
    }
  };

  const ANTICAPTCHA_KEY = process.env.ANTICAPTCHA_KEY || '';

  for (const dateObj of daysToCheck) {
    const year = dateObj.getFullYear();
    const month = dateObj.getMonth() + 1;
    const day = dateObj.getDate();
    
    const formattedDateStr = `${day.toString().padStart(2, '0')}/${month.toString().padStart(2, '0')}/${year}`;

    for (const typeCode of typeCodes) {
      const typeLabels: { [key: string]: string } = {
        '1': 'Factura',
        '2': 'Liquidación de compra',
        '3': 'Nota de Crédito',
        '4': 'Nota de Débito',
        '6': 'Retención'
      };
      const currentLabel = typeLabels[typeCode] || typeCode;
      
      await updateProgress(pool, job.id, `Buscando ${currentLabel} para el día ${formattedDateStr}...`);

      const isSelectsVisible = await page.$('select[id*="ano"], select[name*="ano"]');
      if (!isSelectsVisible) {
        const rucRadio = await page.$('input[id*="opciones:0"], input[value="ruc"]');
        if (rucRadio) {
          await rucRadio.click();
          await new Promise(r => setTimeout(r, 2000));
        }
      }

      await page.waitForSelector('select[id*="ano"]', { timeout: 15000 });
      
      await page.select('select[id*="ano"]', String(year));
      await new Promise(r => setTimeout(r, 1500));
      await page.select('select[id*="mes"]', String(month));
      await new Promise(r => setTimeout(r, 1500));
      await page.select('select[id*="dia"]', String(day));
      await new Promise(r => setTimeout(r, 1000));
      
      await page.select('select[id*="cmbTipoComprobante"]', String(typeCode));
      await new Promise(r => setTimeout(r, 1000));
      
      let searchSuccess = false;
      const MAX_SEARCH_ATTEMPTS = 5;
      for (let attempt = 0; attempt < MAX_SEARCH_ATTEMPTS; attempt++) {
        console.log(`[Worker Debug] Intento de búsqueda ${attempt + 1}/${MAX_SEARCH_ATTEMPTS}...`);

        await page.click('button[id*="btnBuscar"], button[id*="Buscar"]');
        await new Promise(r => setTimeout(r, 3000));

        console.log('[Worker Debug] Esperando resultados...');
        let state = { hasTable: false, hasNoResults: false, hasCaptchaError: false };
        try {
          await page.waitForFunction(() => {
            const bodyText = document.body.innerText;
            const hasNoResults = bodyText.includes('No se encontraron') || 
                                bodyText.includes('No existen') ||
                                bodyText.includes('No se encontraron resultados') ||
                                bodyText.includes('No existen registros');
            const hasTable = document.querySelector('#frmPrincipal\\:tablaCompRecibidos\\:tb tr, [id*="tablaCompRecibidos"] tr') !== null;
            const hasCaptchaError = bodyText.includes('Captcha incorrecta') || bodyText.includes('CAPTCHA incorrecto');
            return hasNoResults || hasTable || hasCaptchaError;
          }, { timeout: 30000 });

          state = await page.evaluate(() => {
            const bodyText = document.body.innerText;
            const hasNoResults = bodyText.includes('No se encontraron') || 
                                bodyText.includes('No existen') ||
                                bodyText.includes('No se encontraron resultados') ||
                                bodyText.includes('No existen registros');
            const hasTable = document.querySelector('#frmPrincipal\\:tablaCompRecibidos\\:tb tr, [id*="tablaCompRecibidos"] tr') !== null;
            const hasCaptchaError = bodyText.includes('Captcha incorrecta') || bodyText.includes('CAPTCHA incorrecto');
            return { hasNoResults, hasTable, hasCaptchaError };
          });
        } catch (waitErr) {
          console.log('[Worker Debug] Timeout esperando respuesta de la consulta.');
        }

        if (state.hasTable || state.hasNoResults) {
          searchSuccess = true;
          console.log(`[Worker Debug] ✅ Búsqueda exitosa. Tabla: ${state.hasTable}, Sin resultados: ${state.hasNoResults}`);
          break;
        }

        if (state.hasCaptchaError) {
          console.log(`[Worker Debug] ❌ "Captcha incorrecta" (intento ${attempt + 1}/${MAX_SEARCH_ATTEMPTS}).`);
          
          await page.evaluate(() => {
            const closeBtn = document.querySelector('.ui-messages-close, [class*="close"]');
            if (closeBtn) (closeBtn as HTMLElement).click();
          }).catch(() => {});
          await new Promise(r => setTimeout(r, 2000));

          let captchaSolved = false;
          if (ANTICAPTCHA_KEY) {
            console.log('[Worker CAPTCHA] Intentando resolver con Anti-Captcha (invisible Enterprise)...');
            captchaSolved = await solveRecaptchaAntiCaptcha(page, 'consulta_cel_recibidos');
          }
          
          if (!captchaSolved) {
            console.log('[Worker CAPTCHA] Intentando con Buster...');
            captchaSolved = await trySolveRecaptcha(page);
          }
          
          if (captchaSolved) {
            console.log('[Worker CAPTCHA] ✅ CAPTCHA resuelto. Reintentando consulta...');
          } else {
            console.log('[Worker CAPTCHA] ⚠️ No se pudo resolver el CAPTCHA. Reintentando...');
          }
          await new Promise(r => setTimeout(r, 2000));
          continue;
        }
        
        console.log(`[Worker Debug] ⚠️ Sin resultado claro (intento ${attempt + 1}/${MAX_SEARCH_ATTEMPTS}). Reintentando en 3s...`);
        await new Promise(r => setTimeout(r, 3000));
      }

      try {
        const dbgPath = path.resolve(`./downloads/search-${day}-${month}-${year}.png`);
        await page.screenshot({ path: dbgPath, fullPage: true });
        console.log(`[Worker Debug] Captura final de búsqueda guardada en: ${dbgPath}`);
      } catch (dbgErr: any) {
        console.error(`[Worker Debug] Error taking screenshot/diagnosing:`, dbgErr.message);
      }

      const noDataFound = await page.evaluate(() => {
        const bodyText = document.body.innerText;
        const hasNoResultsMsg = bodyText.includes('No se encontraron registros') || 
                                bodyText.includes('No se encontraron comprobantes') ||
                                bodyText.includes('No existen comprobantes') ||
                                bodyText.includes('No existen registros') ||
                                bodyText.includes('No se encontraron resultados');
        
        const trs = Array.from(document.querySelectorAll('#frmPrincipal\\:tablaCompRecibidos tr, [id*="tablaCompRecibidos"] tr'));
        const hasTableRows = trs.some(tr => tr.innerText.match(/\d{49}/) !== null);
        return hasNoResultsMsg && !hasTableRows;
      });

      if (noDataFound) {
        continue;
      }

      clearTempFolder();
      await page.evaluate(() => {
        const lnk = document.getElementById('frmPrincipal:lnkTxtlistado');
        if (lnk) {
          lnk.click();
        } else {
          const allLinks = Array.from(document.querySelectorAll('a'));
          const txtLink = allLinks.find(a => a.id && a.id.includes('lnkTxtlistado'));
          if (txtLink) txtLink.click();
        }
      });

      const downloadedTxt = await waitForDownload(tempPath, '.txt', 15000);
      if (downloadedTxt) {
        const txtContent = fs.readFileSync(downloadedTxt, 'utf-8');
        
        const lines = txtContent.split('\n');
        const clavesEnTxt: string[] = [];
        
        for (const line of lines) {
          const matchedClave = extractClaveAcceso(line);
          if (matchedClave) {
            clavesEnTxt.push(matchedClave);
          }
        }
        
        console.log(`[Worker] Claves encontradas en TXT listado: ${clavesEnTxt.length}`);
        
        for (const key of clavesEnTxt) {
          try {
            const [exists] = await pool.query(
              "SELECT id, estado FROM comprobantes WHERE clave_acceso = ? LIMIT 1",
              [key]
            );
            if (!exists || (exists as any[]).length === 0) {
              const rucEmisor = extractRuc(key);
              const serie = extractSerie(key);
              const secuencial = extractSecuencial(key);
              
              const insertQuery = `
                INSERT INTO comprobantes (
                  clave_acceso, tipo, emisor_ruc, serie, secuencial, estado, receptor_identificacion, tenant_id, fecha_emision, categoria
                ) VALUES (
                  ?, ?, ?, ?, ?, 'PENDIENTE', ?, ?, ?, 'Otros'
                )
              `;
              await pool.query(insertQuery, [
                key, mapSriTypeCode(typeCode), rucEmisor, serie, secuencial, job.ruc, tenantId, extractFechaEmision(key)
              ]);
              console.log(`[Worker] Comprobante pre-insertado: ${key}`);
            }
          } catch (dbErr: any) {
            console.error(`[Worker] Error pre-insertando ${key}:`, dbErr.message);
          }
        }
      }

      const tableSelector = await page.evaluate(() => {
        const primary = document.querySelector('#frmPrincipal\\:tablaCompRecibidos');
        if (primary) return '#frmPrincipal\\:tablaCompRecibidos';
        const fallback = document.querySelector('[id*="tablaCompRecibidos"]');
        if (fallback && fallback.id) {
          return '#' + fallback.id.replace(/:/g, '\\:');
        }
        return '#frmPrincipal\\:tablaCompRecibidos';
      });

      const hasRows = await page.evaluate((sel: string) => {
        const rows = Array.from(document.querySelectorAll(sel + ' tr')).filter(tr => tr.innerText.match(/\d{49}/) !== null);
        return rows.length > 0;
      }, tableSelector);

      if (!hasRows) {
        console.log('[Worker] No se encontraron filas de datos visibles en la tabla.');
        continue;
      }

      let paginaActual = 1;
      let hasNextPage = true;

      while (hasNextPage) {
        console.log(`[Worker] Procesando página ${paginaActual} de la tabla...`);

        const headers = await page.evaluate((sel: string) => {
          const cleanSel = sel.replace(/\\/g, ''); // Remove backslashes
          const selectors = [
            `${sel} thead th`,
            `[id*="tablaCompRecibidos"] thead th`,
            `${sel} tr.rf-dt-shdr th`,
            `${sel} .rf-dt-shdr th`,
            `${sel} th:not([class*="pagin"]):not([id*="pagin"])`
          ];
          for (const selector of selectors) {
            try {
              const ths = Array.from(document.querySelectorAll(selector));
              if (ths.length > 0) {
                const mapped = ths.map(th => (th as HTMLElement).innerText.trim().toUpperCase());
                const hasKeywords = mapped.some(h => h.includes('RUC') || h.includes('CLAVE') || h.includes('RAZON') || h.includes('EMISOR'));
                if (hasKeywords) {
                  return mapped;
                }
              }
            } catch (e) {}
          }
          return [];
        }, tableSelector);

        // Fallback default column indexes if dynamic headers fail
        let colIdx = {
          tipo: 1,
          rucEmisor: 2,
          emisor: 3,
          serie: -1,
          secuencial: -1,
          clave: 4,
          fechaAutorizacion: 5,
          fechaEmision: -1,
          subtotal: -1,
          iva: -1,
          total: -1,
          relacionados: -1
        };

        if (headers && headers.length > 0) {
          const detectedIdx = {
            tipo: headers.findIndex((h: string) => h.includes('TIPO') || h.includes('COMPROBANTE')),
            rucEmisor: headers.findIndex((h: string) => h.includes('RUC')),
            emisor: headers.findIndex((h: string) => h.includes('RAZON') || h.includes('RAZÓN') || h.includes('SOCIAL') || h.includes('NOMBRE')),
            serie: headers.findIndex((h: string) => h.includes('SERIE')),
            secuencial: headers.findIndex((h: string) => h.includes('SECUENCIAL') || h.includes('NÚMERO') || h.includes('NUMERO')),
            clave: headers.findIndex((h: string) => h.includes('CLAVE') || h.includes('ACCESO') || h.includes('AUTORIZA')),
            fechaAutorizacion: headers.findIndex((h: string) => h.includes('FECHA') && (h.includes('AUTORIZA') || h.includes('HORA'))),
            fechaEmision: headers.findIndex((h: string) => h.includes('FECHA') && (h.includes('EMISIO') || h.includes('EMISIÓN'))),
            subtotal: headers.findIndex((h: string) => h.includes('SIN') || h.includes('SUBTOTAL') || h.includes('NETO') || h.includes('BASE')),
            iva: headers.findIndex((h: string) => h === 'IVA' || h.includes('I.V.A.')),
            total: headers.findIndex((h: string) => h.includes('TOTAL') || h.includes('IMPORTE') || h.includes('VALOR')),
            relacionados: headers.findIndex((h: string) => h.includes('MODIFICADO') || h.includes('SUSTENTO') || h.includes('RELACIONADO'))
          };
          if (detectedIdx.clave !== -1 || detectedIdx.rucEmisor !== -1) {
            colIdx = detectedIdx;
          }
        }

        const rowCount = await page.evaluate((sel: string) => {
          const rows = Array.from(document.querySelectorAll(sel + ' tr')).filter(tr => tr.innerText.match(/\d{49}/) !== null);
          return rows.length;
        }, tableSelector);

        for (let rowIndex = 0; rowIndex < rowCount; rowIndex++) {
          const rowData = await page.evaluate((sel: string, idx: number) => {
            const rows = Array.from(document.querySelectorAll(sel + ' tr')).filter(tr => tr.innerText.match(/\d{49}/) !== null);
            if (idx >= rows.length) return null;
            const cells = rows[idx].querySelectorAll('td');
            const cellTexts = Array.from(cells).map(c => c.innerText.trim());
            return {
              textos: cellTexts,
              html: rows[idx].innerHTML
            };
          }, tableSelector, rowIndex);

          if (!rowData) continue;

          let rucEmisor = null;
          let razonSocialEmisor = null;
          let claveAcceso = null;
          let total = 0;

          const rawClave = colIdx.clave !== -1 ? rowData.textos[colIdx.clave] : null;
          claveAcceso = extractClaveAcceso(rawClave);
          
          if (!claveAcceso) {
            for (const cellTxt of rowData.textos) {
              const matchedClave = extractClaveAcceso(cellTxt);
              if (matchedClave) {
                claveAcceso = matchedClave;
                break;
              }
            }
          }

          if (!claveAcceso) continue;

          rucEmisor = (colIdx.rucEmisor !== -1 ? extractRuc(rowData.textos[colIdx.rucEmisor]) : null) || extractRuc(claveAcceso);
          razonSocialEmisor = colIdx.emisor !== -1 ? cleanEmisorRazonSocial(rowData.textos[colIdx.emisor]) : null;
          total = colIdx.total !== -1 ? parseSriFloat(rowData.textos[colIdx.total]) : 0;

          console.log(`[Row ${rowIndex + 1}] Clave: ${claveAcceso}, Emisor: ${razonSocialEmisor}, Total: ${total}`);

          const pathXmlFinal = path.join(xmlPath, `${claveAcceso}.xml`);
          const pathPdfFinal = path.join(pdfPath, `${claveAcceso}.pdf`);

          const [dbCheck] = await pool.query(
            "SELECT id, estado FROM comprobantes WHERE clave_acceso = ? LIMIT 1",
            [claveAcceso]
          );
          let recordId = null;
          let currentStatus = 'PENDIENTE';

          if (dbCheck && (dbCheck as any[]).length > 0) {
            recordId = (dbCheck as any[])[0].id;
            currentStatus = (dbCheck as any[])[0].estado;
          }

          if (!recordId) {
            const insertQuery = `
              INSERT INTO comprobantes (
                clave_acceso, tipo, emisor_ruc, emisor_razon_social,
                serie, secuencial, estado, importe_total, receptor_identificacion, tenant_id, fecha_emision, categoria
              ) VALUES (
                ?, ?, ?, ?, ?, ?, 'PENDIENTE', ?, ?, ?, ?, ?
              )
            `;
            const serie = extractSerie(claveAcceso);
            const secuencial = extractSecuencial(claveAcceso);
            await pool.query(insertQuery, [
              claveAcceso, mapSriTypeCode(typeCode), rucEmisor, razonSocialEmisor,
              serie, secuencial, total, job.ruc, tenantId, extractFechaEmision(claveAcceso), classifyExpense(razonSocialEmisor)
            ]);
          } else {
            const updateQuery = `
              UPDATE comprobantes SET
                emisor_razon_social = COALESCE(?, emisor_razon_social),
                importe_total = COALESCE(IF(? = 0, NULL, ?), importe_total),
                tenant_id = COALESCE(tenant_id, ?),
                fecha_emision = COALESCE(fecha_emision, ?),
                categoria = IF(categoria IS NULL OR categoria = 'Otros', ?, categoria),
                updated_at = NOW()
              WHERE id = ?
            `;
            await pool.query(updateQuery, [
              razonSocialEmisor, total, total, tenantId, extractFechaEmision(claveAcceso), classifyExpense(razonSocialEmisor), recordId
            ]);
          }

          const needsXml = !fs.existsSync(pathXmlFinal) || currentStatus !== 'AUTORIZADO';
          const needsPdf = !fs.existsSync(pathPdfFinal);

          if (needsXml || needsPdf) {
            let actionButtons = await page.evaluateHandle((sel: string, idx: number) => {
              const rows = Array.from(document.querySelectorAll(sel + ' tr')).filter(tr => tr.innerText.match(/\d{49}/) !== null);
              if (idx >= rows.length) return [];
              const imgs = rows[idx].querySelectorAll('a, input[type="image"], button');
              return Array.from(imgs);
            }, tableSelector, rowIndex);

            const buttonsLength = await page.evaluate((el: any) => el.length, actionButtons);
            let xmlBtn = null;
            let pdfBtn = null;

            for (let bIdx = 0; bIdx < buttonsLength; bIdx++) {
              const el = await page.evaluateHandle((btns: any, i: number) => btns[i], actionButtons, bIdx);
              const searchStr = await page.evaluate((b: any) => {
                const src = b.getAttribute('src') || '';
                const id = b.getAttribute('id') || '';
                const title = b.getAttribute('title') || '';
                const val = b.getAttribute('value') || '';
                const onclick = b.getAttribute('onclick') || '';
                return (src + id + title + val + onclick).toLowerCase();
              }, el);

              if (searchStr.includes('xml') || searchStr.includes('comprobante')) {
                xmlBtn = el;
              }
              if (searchStr.includes('pdf') || searchStr.includes('ride')) {
                pdfBtn = el;
              }
            }

            if (xmlBtn && !fs.existsSync(pathXmlFinal)) {
              clearTempFolder();
              await xmlBtn.evaluate((b: any) => b.click());
              const downloadedXml = await waitForDownload(tempPath, '.xml', 15000);
              if (downloadedXml) {
                fs.renameSync(downloadedXml, pathXmlFinal);
                xmlsDescargados++;
              }
            }

            if (pdfBtn && !fs.existsSync(pathPdfFinal)) {
              clearTempFolder();
              await pdfBtn.evaluate((b: any) => b.click());
              const downloadedPdf = await waitForDownload(tempPath, '.pdf', 15000);
              if (downloadedPdf) {
                fs.renameSync(downloadedPdf, pathPdfFinal);
                pdfsDescargados++;
              }
            }

            if (fs.existsSync(pathXmlFinal)) {
              await updateComprobanteFromXml(pool, pathXmlFinal, claveAcceso, tenantId);
            }
          }
        }

        const nextButton = await page.$('.rf-ds-btn-next:not(.rf-ds-dis), [id*="ds_next"]:not(.rf-ds-dis)');
        if (nextButton) {
          paginaActual++;
          
          const firstRowClaveBefore = await page.evaluate((sel: string) => {
            const rows = Array.from(document.querySelectorAll(sel + ' tr')).filter(tr => tr.innerText.match(/\d{49}/) !== null);
            if (rows.length === 0) return '';
            const cells = rows[0].querySelectorAll('td');
            for (const cell of Array.from(cells)) {
              const match = cell.innerText.trim().match(/\d{49}/);
              if (match) return match[0];
            }
            return '';
          }, tableSelector);

          await nextButton.click();
          
          let pageChanged = false;
          for (let attempt = 0; attempt < 10; attempt++) {
            await new Promise(r => setTimeout(r, 1000));
            const firstRowClaveAfter = await page.evaluate((sel: string) => {
              const rows = Array.from(document.querySelectorAll(sel + ' tr')).filter(tr => tr.innerText.match(/\d{49}/) !== null);
              if (rows.length === 0) return '';
              const cells = rows[0].querySelectorAll('td');
              for (const cell of Array.from(cells)) {
                const match = cell.innerText.trim().match(/\d{49}/);
                if (match) return match[0];
              }
              return '';
            }, tableSelector);
            if (firstRowClaveAfter !== firstRowClaveBefore) {
              pageChanged = true;
              break;
            }
          }

          if (!pageChanged) {
            hasNextPage = false;
          }
        } else {
          hasNextPage = false;
        }
      }
    }
  }

  await updateProgress(pool, job.id, `Trabajo finalizado. XMLs: ${xmlsDescargados}, PDFs RIDE: ${pdfsDescargados}`, 'COMPLETED');
}
