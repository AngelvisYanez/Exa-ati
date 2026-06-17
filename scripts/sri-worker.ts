import 'dotenv/config';
import puppeteer from 'puppeteer-extra';
import StealthPlugin from 'puppeteer-extra-plugin-stealth';
import mysql from 'mysql2/promise';
import fs from 'fs';
import path from 'path';
import xml2js from 'xml2js';
import fetch from 'node-fetch';
// @ts-ignore
import ac from '@antiadmin/anticaptchaofficial';

puppeteer.use(StealthPlugin());

const ANTICAPTCHA_KEY = process.env.ANTICAPTCHA_KEY || '';
if (ANTICAPTCHA_KEY) {
  console.log('[Worker] ✅ ANTICAPTCHA_KEY configurado. Se usará resolución de CAPTCHA oficial.');
} else {
  console.log('[Worker] ⚠️  No se encontró ANTICAPTCHA_KEY en .env.local. Se usará modo manual como fallback.');
}

const lockFilePath = path.resolve(process.cwd(), 'sri-worker.lock');

function acquireLock() {
  if (fs.existsSync(lockFilePath)) {
    try {
      const existingPid = parseInt(fs.readFileSync(lockFilePath, 'utf8').trim(), 10);
      if (existingPid) {
        process.kill(existingPid, 0);
        console.log(`[Worker] El worker ya se encuentra en ejecución (PID: ${existingPid}). Saliendo.`);
        process.exit(0);
      }
    } catch (e: any) {
      console.log('[Worker] Se detectó un archivo de bloqueo huérfano. Reclamando el bloqueo.');
    }
  }
  
  fs.writeFileSync(lockFilePath, String(process.pid), 'utf8');
  
  const cleanup = () => {
    try {
      if (fs.existsSync(lockFilePath)) {
        const storedPid = parseInt(fs.readFileSync(lockFilePath, 'utf8').trim(), 10);
        if (storedPid === process.pid) {
          fs.unlinkSync(lockFilePath);
          console.log('[Worker] Cerradura liberada correctamente.');
        }
      }
    } catch (e) {}
  };
  
  process.on('exit', cleanup);
  process.on('SIGINT', () => { cleanup(); process.exit(0); });
  process.on('SIGTERM', () => { cleanup(); process.exit(0); });
}

acquireLock();

const getDbConnection = async () => {
  return await mysql.createConnection({
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '3306', 10),
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'db_sri',
  });
};

async function updateProgress(pool: any, jobId: number, message: string, status?: string) {
  console.log(`[Job ${jobId}] ${message}`);
  let query = "UPDATE scraping_jobs SET progress_message = ?, updated_at = NOW() WHERE id = ?";
  let params = [message, jobId];
  if (status) {
    query = "UPDATE scraping_jobs SET progress_message = ?, status = ?, updated_at = NOW() WHERE id = ?";
    params = [message, status, jobId];
  }
  await pool.query(query, params);
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

function parseLocalIsoDate(dateVal: any): Date {
  if (!dateVal) return new Date();
  if (dateVal instanceof Date) return dateVal;
  const parts = String(dateVal).split('T')[0].split('-');
  if (parts.length === 3) {
    return new Date(parseInt(parts[0]), parseInt(parts[1]) - 1, parseInt(parts[2]));
  }
  return new Date(dateVal);
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

async function trySolveRecaptcha(page: any): Promise<boolean> {
  try {
    const frames = page.frames();
    const challengeFrame = frames.find((f: any) => 
      f.url().includes('api2/bframe') || 
      f.url().includes('recaptcha/api2/anchor') || 
      f.name().includes('c-') || 
      f.url().includes('bframe')
    );
    
    if (!challengeFrame) {
      return false;
    }
    
    const solverBtn = await challengeFrame.$('#solver-button');
    if (solverBtn) {
      console.log('[Worker] ¡Buster detectado! Intentando resolver CAPTCHA automáticamente...');
      await solverBtn.click();
      await new Promise(r => setTimeout(r, 6000));
      return true;
    }
  } catch (e: any) {
    console.error('[Worker] Error al intentar resolver recaptcha con Buster:', e.message);
  }
  return false;
}

/**
 * Sobrescribe grecaptcha.enterprise.execute para que devuelva un token
 * pre-resuelto de Anti-Captcha. El SRI usa reCAPTCHA Enterprise invisible
 * y llama a grecaptcha.enterprise.execute() desde su función executeRecaptcha().
 */
async function overrideGrecaptchaEnterprise(page: any, token: string): Promise<void> {
  await page.evaluate((tokenVal: string) => {
    const ta = document.getElementById('g-recaptcha-response') as HTMLTextAreaElement;
    if (ta) {
      ta.value = tokenVal;
    }

    if (typeof (window as any).grecaptcha === 'undefined') {
      (window as any).grecaptcha = {};
    }
    const g = (window as any).grecaptcha;
    if (!g.enterprise) {
      g.enterprise = {};
    }
    g.enterprise.execute = function() {
      return Promise.resolve(tokenVal);
    };
    g.enterprise.ready = function(cb: any) {
      if (typeof cb === 'function') cb();
    };

    if (typeof (window as any).executeRecaptcha === 'function') {
      (window as any).executeRecaptcha = function() {
        const ta2 = document.getElementById('g-recaptcha-response') as HTMLTextAreaElement;
        if (ta2) ta2.value = tokenVal;
        return tokenVal;
      };
    }
  }, token);
}

/**
 * Resuelve el reCAPTCHA Enterprise invisible usando Anti-Captcha.
 * Obtiene un token válido y sobrescribe grecaptcha.enterprise.execute
 * para que las próximas llamadas a executeRecaptcha() usen nuestro token.
 */
async function solveRecaptchaAntiCaptcha(page: any, action?: string): Promise<boolean> {
  const apiKey = process.env.ANTICAPTCHA_KEY;
  if (!apiKey) {
    console.log('[Worker CAPTCHA] No hay ANTICAPTCHA_KEY configurado. No se puede resolver por anticaptcha.');
    return false;
  }

  ac.setAPIKey(apiKey);
  ac.setSoftId(0);

  try {
    console.log(`[Worker CAPTCHA] Iniciando resolución con Anti-Captcha${action ? ` (action: ${action})` : ''}...`);

    const sitekey = '6LdukTQsAAAAAIcciM4GZq4ibeyplUhmWvlScuQE';
    const currentUrl = await page.url();

    const payload: any = {};
    if (action) {
      payload.s = action;
    }

    const token = await ac.solveRecaptchaV2EnterpriseProxyless(currentUrl, sitekey, payload);

    if (!token) {
      console.log('[Worker CAPTCHA] ❌ Anti-Captcha no devolvió token.');
      return false;
    }

    console.log('[Worker CAPTCHA] ✅ Token obtenido. Inyectando mock de grecaptcha.enterprise.execute...');
    await overrideGrecaptchaEnterprise(page, token);

    return true;
  } catch (e: any) {
    console.error(`[Worker CAPTCHA] ❌ Error en Anti-Captcha: ${e.message}`);
    return false;
  }
}

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
      // 1.234,56 -> 1234.56
      clean = clean.replace(/\./g, '').replace(',', '.');
    } else {
      // 1,234.56 -> 1234.56
      clean = clean.replace(/,/g, '');
    }
  } else if (hasComma) {
    // 123,45 -> 123.45
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
  const match = String(val).match(/\d{3}-\d{3}/);
  return match ? match[0] : null;
}

function extractSecuencial(val: any): string | null {
  if (val === undefined || val === null) return null;
  const str = String(val).trim();
  if (!str) return null;
  if (str.includes('-')) {
    const parts = str.split('-');
    return parts[parts.length - 1].padStart(9, '0');
  }
  const digitsMatch = str.match(/\d+/);
  return digitsMatch ? digitsMatch[0].padStart(9, '0') : null;
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
      // Check for version 2.0 docsSustento
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
      // Check for version 1.0 impuestos
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
  // Para factura, liquidacionCompra, notaCredito: totalConImpuestos.totalImpuesto
  const totalConImpuestos = docData.totalConImpuestos;
  if (totalConImpuestos && totalConImpuestos.totalImpuesto) {
    const imps = Array.isArray(totalConImpuestos.totalImpuesto)
      ? totalConImpuestos.totalImpuesto
      : [totalConImpuestos.totalImpuesto];
    const ivaImp = imps.find((imp: any) => imp.codigo === '2');
    if (ivaImp) return parseFloat(ivaImp.valor) || 0;
  }
  // Para notaDebito: impuestos.impuesto
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
    
    console.log(`[Worker] Actualizando detalles del comprobante ${claveAcceso} en BD...`);
    const updateQuery = `
      UPDATE comprobantes SET
        emisor_razon_social = COALESCE(?, emisor_razon_social),
        receptor_razon_social = COALESCE(?, receptor_razon_social),
        receptor_identificacion = COALESCE(?, receptor_identificacion),
        emisor_ruc = COALESCE(?, emisor_ruc),
        subtotal_sin_impuesto = ?,
        total_iva = ?,
        importe_total = COALESCE(CASE WHEN ? = 0 THEN NULL ELSE ? END, importe_total),
        fecha_autorizacion = ?,
        numero_autorizacion = COALESCE(?, numero_autorizacion),
        receptor_email = COALESCE(?, receptor_email),
        documentos_relacionados = ?,
        tenant_id = COALESCE(tenant_id, ?),
        emisor_id = COALESCE(emisor_id, ?),
        updated_at = NOW()
      WHERE clave_acceso = ?
    `;
    await pool.query(updateQuery, [
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
      claveAcceso
    ]);
  } catch (e: any) {
    console.error(`[Worker] Error al parsear y guardar XML para ${claveAcceso}:`, e.message);
  }
}

async function runWorker() {
  console.log('👷 Iniciando SriWorker en modo polling y background...');

  let pool;
  try {
    pool = await getDbConnection();
  } catch (err) {
    console.error("Error conectando a BD:", err);
    process.exit(1);
  }

  while (true) {
    let job = null;
    let browser = null;
    let page: any = null;
    
    try {
      const [rows] = await pool.query("SELECT * FROM scraping_jobs WHERE status = 'PENDING' ORDER BY created_at ASC LIMIT 1");
      const jobs = rows as any[];
      
      if (!jobs || jobs.length === 0) {
        await new Promise(res => setTimeout(res, 10000));
        continue;
      }
      
      job = jobs[0];
      
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

      const startD = parseLocalIsoDate(job.fecha_desde);
      const endD = parseLocalIsoDate(job.fecha_hasta);
      const docTypeSelect = job.tipo_comprobante || '1';
      
      const dateRangeStr = `${startD.toISOString().split('T')[0]} al ${endD.toISOString().split('T')[0]}`;
      
      await updateProgress(pool, job.id, `Iniciando trabajo [Tipo: ${docTypeSelect}] para el rango: ${dateRangeStr}`, 'PROCESSING');

      const isHeadless = process.env.HEADLESS !== 'false';
      
      const busterPath = path.resolve('./scripts/buster');
      const launchArgs = [
        '--no-sandbox', 
        '--disable-setuid-sandbox', 
        '--disable-dev-shm-usage',
        '--disable-blink-features=AutomationControlled'
      ];

      if (fs.existsSync(busterPath)) {
        launchArgs.push(`--disable-extensions-except=${busterPath}`);
        launchArgs.push(`--load-extension=${busterPath}`);
      }

      browser = await puppeteer.launch({
        headless: isHeadless ? 'shell' as any : false,
        defaultViewport: null,
        userDataDir: path.resolve('./browser_session'),
        executablePath: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
        args: launchArgs
      });

      page = await browser.newPage();
      await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36');
      
      page.on('console', (msg: any) => {
        console.log(`[Browser Console] [${msg.type()}] ${msg.text()}`);
      });
      page.on('pageerror', (err: any) => {
        console.error(`[Browser PageError] ${err.message}`);
      });
      page.on('requestfailed', (req: any) => {
        console.log(`[Browser ReqFailed] ${req.url()} - ${req.failure()?.errorText || 'unknown'}`);
      });
      
      const downloadsDir = path.resolve('./downloads');
      const tempPath = path.join(downloadsDir, 'temp');
      const xmlPath = path.join(downloadsDir, 'XML');
      const pdfPath = path.join(downloadsDir, 'RIDE');
      
      if (!fs.existsSync(downloadsDir)) fs.mkdirSync(downloadsDir, { recursive: true });
      if (!fs.existsSync(tempPath)) fs.mkdirSync(tempPath, { recursive: true });
      if (!fs.existsSync(xmlPath)) fs.mkdirSync(xmlPath, { recursive: true });
      if (!fs.existsSync(pdfPath)) fs.mkdirSync(pdfPath, { recursive: true });

      const clearTempFolder = () => {
        const tempFiles = fs.readdirSync(tempPath);
        for (const f of tempFiles) {
          try { fs.unlinkSync(path.join(tempPath, f)); } catch(e) {}
        }
      };

      const client = await page.target().createCDPSession();
      await client.send('Page.setDownloadBehavior', {
        behavior: 'allow',
        downloadPath: tempPath,
      });

      await updateProgress(pool, job.id, 'Comprobando sesión en el SRI...');
      await page.goto('https://srienlinea.sri.gob.ec/sri-en-linea/contribuyente/perfil', {
        waitUntil: 'domcontentloaded',
        timeout: 45000
      });
      await page.waitForSelector('body', { timeout: 10000 }).catch(() => {});

      // Esperar activamente para verificar si redirige al login o si carga el perfil
      await updateProgress(pool, job.id, 'Esperando respuesta del portal de sesión...');
      // Esperamos 5 segundos a que se estabilicen las redirecciones de red e inicio del router Keycloak
      await new Promise(r => setTimeout(r, 5000));
      
      const currentUrl = page.url();
      const hasInput = await page.$('input#usuario, input#username, input[name="username"], input[name="usuario"]') !== null;
      let needsLogin = currentUrl.includes('login') || currentUrl.includes('openid-connect/auth') || hasInput;

      if (needsLogin) {
        await updateProgress(pool, job.id, 'No hay sesión activa. Iniciando sesión...');
        
        const userSelector = await page.waitForSelector('input#usuario, input#username, input[name="username"], input[name="usuario"]', { timeout: 45000 });
        if (userSelector) {
          await new Promise(r => setTimeout(r, 1500));
          try {
            await page.evaluate(() => { 
              const input = document.querySelector('input#usuario, input#username, input[name="username"], input[name="usuario"]') as HTMLInputElement;
              if (input) input.value = ''; 
            });
          } catch (e) {}
          await userSelector.type(job.ruc, { delay: 50 });
        }
        
        const passSelector = await page.$('input#password, input[name="password"]');
        if (passSelector) {
          try {
            await page.evaluate(() => { 
              const input = document.querySelector('input#password, input[name="password"]') as HTMLInputElement;
              if (input) input.value = ''; 
            });
          } catch (e) {}
          await passSelector.type(job.clave_sri, { delay: 50 });
        }

        if (isHeadless) {
          await updateProgress(pool, job.id, 'Obteniendo token CAPTCHA antes del login...');
          
          if (ANTICAPTCHA_KEY) {
            await solveRecaptchaAntiCaptcha(page);
          }
          
          await updateProgress(pool, job.id, 'Haciendo clic en ingresar...');
          await page.click('button[type="submit"], input[type="submit"], button#kc-login, .btn-primary, input#kc-login').catch(() => {});
          
          // Esperamos hasta 20 segundos a que la URL cambie (éxito de login)
          let loggedIn = false;
          for (let attempt = 0; attempt < 20; attempt++) {
            const busterTriggered = await trySolveRecaptcha(page);
            if (busterTriggered) {
              await page.click('button[type="submit"], input[type="submit"], button#kc-login, .btn-primary, input#kc-login').catch(() => {});
            }
            await new Promise(r => setTimeout(r, 1000));
            const currentUrl = page.url();
            if (!currentUrl.includes('login') && !currentUrl.includes('openid-connect/auth')) {
              loggedIn = true;
              break;
            }
          }
          if (!loggedIn) {
             throw new Error(
               "El login en segundo plano falló o requiere resolver un CAPTCHA. " +
               "Por favor, ejecuta temporalmente el worker de forma visible para iniciar sesión manualmente una vez (ejecuta: $env:HEADLESS='false'; npm run worker:sri o pon HEADLESS=false en tu .env). " +
               "Una vez iniciada la sesión, se guardará en la carpeta './browser_session' y podrás volver al modo headless."
             );
          }
        } else {
          await updateProgress(pool, job.id, 'Modo interactivo: Resuelve el CAPTCHA y haz clic en Ingresar en la ventana del navegador...');
          
          if (ANTICAPTCHA_KEY) {
            await solveRecaptchaAntiCaptcha(page);
          }
          
          let loggedIn = false;
          for (let attempt = 0; attempt < 120; attempt++) {
            const busterTriggered = await trySolveRecaptcha(page);
            if (busterTriggered) {
              await page.click('button[type="submit"], input[type="submit"], button#kc-login, .btn-primary, input#kc-login').catch(() => {});
            }
            await new Promise(r => setTimeout(r, 1000));
            const currentUrl = page.url();
            if (!currentUrl.includes('login') && !currentUrl.includes('openid-connect/auth')) {
              loggedIn = true;
              break;
            }
          }
          if (!loggedIn) {
             throw new Error(
               "No se detectó el inicio de sesión en los 120 segundos de espera. Por favor, reintenta."
             );
          }
        }
        await updateProgress(pool, job.id, '✅ Sesión iniciada correctamente.');
      } else {
        await updateProgress(pool, job.id, '✅ Sesión previa detectada. Usuario ya logeado.');
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

      // Lista de tipos de comprobante a buscar
      const typeCodes = docTypeSelect === 'todos' ? ['1', '2', '3', '4', '6'] : [docTypeSelect];

      for (const dateObj of daysToCheck) {
        const year = dateObj.getFullYear();
        const month = dateObj.getMonth() + 1; // 1-indexed
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

          // Activar búsqueda por RUC/Periodo si no se ven los selects de año/mes/día
          const isSelectsVisible = await page.$('select[id*="ano"], select[name*="ano"]');
          if (!isSelectsVisible) {
            const rucRadio = await page.$('input[id*="opciones:0"], input[value="ruc"]');
            if (rucRadio) {
              await rucRadio.click();
              await new Promise(r => setTimeout(r, 2000));
            }
          }

          await page.waitForSelector('select[id*="ano"]', { timeout: 15000 });
          
          // Seleccionar Año, Mes, Día
          await page.select('select[id*="ano"]', String(year));
          await new Promise(r => setTimeout(r, 1500)); // Esperar recarga AJAX del año
          await page.select('select[id*="mes"]', String(month));
          await new Promise(r => setTimeout(r, 1500)); // Esperar recarga AJAX del mes
          await page.select('select[id*="dia"]', String(day));
          await new Promise(r => setTimeout(r, 1000));
          
          // Seleccionar Tipo de Comprobante
          await page.select('select[id*="cmbTipoComprobante"]', String(typeCode));
          await new Promise(r => setTimeout(r, 1000));
          
          // Intentar consultar con reintentos (hasta 5 intentos)
          // Flujo principal: clic en Consultar → esperar resultado → si falla reintentar
          // Solo intenta resolver CAPTCHA si aparece un desafío visible
          let searchSuccess = false;
          const MAX_SEARCH_ATTEMPTS = 5;
          for (let attempt = 0; attempt < MAX_SEARCH_ATTEMPTS; attempt++) {
            console.log(`[Worker Debug] Intento de búsqueda ${attempt + 1}/${MAX_SEARCH_ATTEMPTS}...`);

            // Clic en consultar
            await page.click('button[id*="btnBuscar"], button[id*="Buscar"]');
            await new Promise(r => setTimeout(r, 3000));

            // Esperar a que carguen los resultados, aparezca error de captcha, o timeout
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

            // ✅ Éxito: tabla con datos o mensaje de "no hay resultados"
            if (state.hasTable || state.hasNoResults) {
              searchSuccess = true;
              console.log(`[Worker Debug] ✅ Búsqueda exitosa. Tabla: ${state.hasTable}, Sin resultados: ${state.hasNoResults}`);
              break;
            }

            // ❌ Error de CAPTCHA: resolver con Anti-Captcha (invisible Enterprise) o Buster como fallback
            if (state.hasCaptchaError) {
              console.log(`[Worker Debug] ❌ "Captcha incorrecta" (intento ${attempt + 1}/${MAX_SEARCH_ATTEMPTS}).`);
              
              // Cerrar mensaje de error si es posible
              await page.evaluate(() => {
                const closeBtn = document.querySelector('.ui-messages-close, [class*="close"]');
                if (closeBtn) (closeBtn as HTMLElement).click();
              }).catch(() => {});
              await new Promise(r => setTimeout(r, 2000));

              // Intentar resolver con Anti-Captcha (funciona con Enterprise invisible,
              // que NO muestra iframes bframe visibles)
              let captchaSolved = false;
              if (ANTICAPTCHA_KEY) {
                console.log('[Worker CAPTCHA] Intentando resolver con Anti-Captcha (invisible Enterprise)...');
                captchaSolved = await solveRecaptchaAntiCaptcha(page, 'consulta_cel_recibidos');
              }
              
              // Fallback a Buster por si acaso hay un challenge visible (checkbox v2)
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
            
            // ⚠️ Estado no claro (timeout u otro): reintentar
            console.log(`[Worker Debug] ⚠️ Sin resultado claro (intento ${attempt + 1}/${MAX_SEARCH_ATTEMPTS}). Reintentando en 3s...`);
            await new Promise(r => setTimeout(r, 3000));
          }

          // Debug screenshot y html inspect final
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
            
            const hasTableRows = document.querySelector('#frmPrincipal\\:tablaCompRecibidos\\:tb tr.rf-dt-r, [id*="tablaCompRecibidos"] tbody tr.rf-dt-r') !== null;
            return hasNoResultsMsg && !hasTableRows;
          });

          if (noDataFound) {
            continue; // No hay registros para este día/tipo
          }

          // --- PASO 1: Descargar listado TXT ---
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
            const lines = txtContent.split(/\r?\n/);
            let headerLineIndex = -1;
            for (let i = 0; i < lines.length; i++) {
              const line = lines[i];
              if (line.toUpperCase().includes('CLAVE') && line.toUpperCase().includes('COMPROBANTE')) {
                headerLineIndex = i;
                break;
              }
            }
            
            if (headerLineIndex === -1) {
              for (let i = 0; i < lines.length; i++) {
                const parts = lines[i].split('\t');
                if (parts.length >= 5 && parts.some(p => p.toUpperCase().includes('CLAVE'))) {
                  headerLineIndex = i;
                  break;
                }
              }
            }

            if (headerLineIndex !== -1) {
              let delimiter = '\t';
              const headerLine = lines[headerLineIndex];
              if (headerLine.includes(';')) delimiter = ';';
              else if (headerLine.includes(',') && !headerLine.includes('\t')) delimiter = ',';

              const headers = headerLine.split(delimiter).map(h => h.trim().toUpperCase());
              
              const colIdx = {
                tipo: headers.findIndex(h => h.includes('COMPROBANTE') || h.includes('TIPO')),
                serie: headers.findIndex(h => h.includes('SERIE')),
                secuencial: headers.findIndex(h => h.includes('SECUENCIAL') || h.includes('NUMERO') || h.includes('NÚMERO')),
                rucEmisor: headers.findIndex(h => h.includes('RUC')),
                emisor: headers.findIndex(h => h.includes('RAZON') || h.includes('RAZÓN') || h.includes('SOCIAL') || h.includes('NOMBRE')),
                fechaEmision: headers.findIndex(h => h.includes('FECHA') && (h.includes('EMISIO') || h.includes('EMISIÓN'))),
                fechaAutorizacion: headers.findIndex(h => h.includes('FECHA') && h.includes('AUTORIZA')),
                clave: headers.findIndex(h => h.includes('CLAVE') || h.includes('ACCESO')),
                subtotal: headers.findIndex(h => h.includes('SIN') || h.includes('SUBTOTAL') || h.includes('NETO') || h.includes('BASE')),
                iva: headers.findIndex(h => h === 'IVA' || h.includes('I.V.A.')),
                total: headers.findIndex(h => h.includes('TOTAL') || h.includes('IMPORTE') || h.includes('VALOR')),
                relacionados: headers.findIndex(h => h.includes('MODIFICADO') || h.includes('SUSTENTO') || h.includes('RELACIONADO'))
              };
              
              let insertedCount = 0;
              for (let i = headerLineIndex + 1; i < lines.length; i++) {
                const line = lines[i].trim();
                if (!line) continue;
                const cells = line.split(delimiter).map(c => c.trim());
                if (cells.length < 5) continue;

                const idxClave = colIdx.clave !== -1 ? colIdx.clave : 3;
                const rawClave = cells[idxClave];
                const claveAcceso = extractClaveAcceso(rawClave);
                if (!claveAcceso) {
                  continue;
                }

                const emisorRuc = (colIdx.rucEmisor !== -1 ? extractRuc(cells[colIdx.rucEmisor]) : null) || claveAcceso.substring(10, 23);
                const emisorRazonSocial = colIdx.emisor !== -1 ? cleanEmisorRazonSocial(cells[colIdx.emisor]) : null;
                
                const tipoCode = colIdx.tipo !== -1 ? cells[colIdx.tipo] : null;
                const tipo = tipoCode ? (
                  tipoCode.includes('Factura') ? '01' : 
                  (tipoCode.includes('Retención') || tipoCode.includes('Retencion') || tipoCode.includes('Reten')) ? '07' : 
                  (tipoCode.includes('Crédito') || tipoCode.includes('Credito')) ? '04' : 
                  (tipoCode.includes('Débito') || tipoCode.includes('Debito')) ? '05' : 
                  (tipoCode.includes('Liquidación') || tipoCode.includes('Liquidacion')) ? '03' : 
                  claveAcceso.substring(8, 10)
                ) : claveAcceso.substring(8, 10);
                
                const rawSerie = colIdx.serie !== -1 ? cells[colIdx.serie] : null;
                const serie = extractSerie(rawSerie) || (claveAcceso.substring(24, 30).substring(0, 3) + '-' + claveAcceso.substring(24, 30).substring(3, 6));
                
                const secuencial = (colIdx.secuencial !== -1 ? extractSecuencial(cells[colIdx.secuencial]) : null) || claveAcceso.substring(30, 39);
                
                const fechaEmisionStr = colIdx.fechaEmision !== -1 ? cells[colIdx.fechaEmision] : null;
                let fechaEmision = null;
                if (fechaEmisionStr) {
                  const parts = fechaEmisionStr.split('/');
                  if (parts.length === 3) {
                    fechaEmision = `${parts[2]}-${parts[1]}-${parts[0]}`;
                  }
                }
                if (!fechaEmision) {
                  const dayVal = claveAcceso.substring(0, 2);
                  const mVal = claveAcceso.substring(2, 4);
                  const yVal = claveAcceso.substring(4, 8);
                  fechaEmision = `${yVal}-${mVal}-${dayVal}`;
                }

                const fechaAutorizacionStr = colIdx.fechaAutorizacion !== -1 ? cells[colIdx.fechaAutorizacion] : null;
                let fechaAutorizacionFormatted = null;
                if (fechaAutorizacionStr) {
                  const cleanFechaAuto = fechaAutorizacionStr.replace(/\s+/g, ' ').trim();
                  const parts = cleanFechaAuto.split(' ');
                  if (parts.length >= 2) {
                    const dateParts = parts[0].split('/');
                    if (dateParts.length === 3) {
                      fechaAutorizacionFormatted = `${dateParts[2]}-${dateParts[1]}-${dateParts[0]} ${parts[1]}`;
                    }
                  }
                }

                const subtotalSinImpuesto = colIdx.subtotal !== -1 ? parseSriFloat(cells[colIdx.subtotal]) : 0.00;
                const totalIva = colIdx.iva !== -1 ? parseSriFloat(cells[colIdx.iva]) : 0.00;
                const importeTotal = colIdx.total !== -1 ? parseSriFloat(cells[colIdx.total]) : 0.00;
                const documentosRelacionados = colIdx.relacionados !== -1 ? cells[colIdx.relacionados] : null;

                let emisorId: string | null = null;
                if (tenantId) {
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

                const insertQuery = `
                  INSERT INTO comprobantes 
                    (clave_acceso, tipo, serie, secuencial, estado, fecha_emision, numero_autorizacion, importe_total, receptor_identificacion, emisor_ruc, tenant_id, emisor_id, emisor_razon_social, fecha_autorizacion, subtotal_sin_impuesto, total_iva, documentos_relacionados)
                  VALUES 
                    (?, ?, ?, ?, 'AUTORIZADO', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                  ON DUPLICATE KEY UPDATE 
                    importe_total = VALUES(importe_total),
                    estado = 'AUTORIZADO',
                    tenant_id = COALESCE(tenant_id, VALUES(tenant_id)),
                    emisor_id = COALESCE(emisor_id, VALUES(emisor_id)),
                    emisor_razon_social = COALESCE(emisor_razon_social, VALUES(emisor_razon_social)),
                    fecha_autorizacion = COALESCE(fecha_autorizacion, VALUES(fecha_autorizacion)),
                    subtotal_sin_impuesto = VALUES(subtotal_sin_impuesto),
                    total_iva = VALUES(total_iva),
                    documentos_relacionados = COALESCE(documentos_relacionados, VALUES(documentos_relacionados)),
                    updated_at = NOW()
                `;
                await pool.query(insertQuery, [
                  claveAcceso,
                  tipo,
                  serie,
                  secuencial,
                  fechaEmision,
                  claveAcceso,
                  importeTotal,
                  job.ruc,
                  emisorRuc,
                  tenantId,
                  emisorId,
                  emisorRazonSocial,
                  fechaAutorizacionFormatted,
                  subtotalSinImpuesto,
                  totalIva,
                  documentosRelacionados
                ]);
                insertedCount++;
              }
              await updateProgress(pool, job.id, `Sincronizados ${insertedCount} registros de ${currentLabel} en la BD para ${formattedDateStr}.`);
            }
            try { fs.unlinkSync(downloadedTxt); } catch (e) {}
          }

          // --- PASO 2: Descargar XML y PDFs RIDE desde la Tabla ---
          let hasNextPage = true;
          let paginaActual = 1;

          while (hasNextPage) {
            // Esperamos dinámicamente a que aparezca la tabla de comprobantes con filas cargadas
            await page.waitForFunction(() => {
              const tables = Array.from(document.querySelectorAll('table'));
              for (const table of tables) {
                const headers = Array.from(table.querySelectorAll('th')).map(th => th.innerText.trim().toUpperCase());
                if (headers.length === 0) {
                  const firstRow = table.querySelector('tr');
                  if (firstRow) {
                    const cells = Array.from(firstRow.querySelectorAll('td')).map(td => td.innerText.trim().toUpperCase());
                    headers.push(...cells);
                  }
                }
                const hasRuc = headers.some(h => h.includes('RUC') || (h.includes('RAZON') || h.includes('RAZÓN') || h.includes('SOCIAL') || h.includes('EMISOR')));
                const hasClave = headers.some(h => h.includes('CLAVE') || h.includes('ACCESO') || h.includes('AUTORIZA'));
                const hasTipo = headers.some(h => h.includes('TIPO') || h.includes('COMPROBANTE'));
                
                if (hasRuc && hasClave && hasTipo) {
                  const rows = table.querySelectorAll('tbody tr, tr:not(:first-child)');
                  if (rows.length > 0) return true;
                }
              }
              return false;
            }, { timeout: 15000 }).catch(() => {});

            // Detectar la tabla y sus cabeceras dinámicamente
            const tableInfo = await page.evaluate(() => {
              const tables = Array.from(document.querySelectorAll('table'));
              for (const table of tables) {
                const headers = Array.from(table.querySelectorAll('th')).map(th => th.innerText.trim().toUpperCase());
                if (headers.length === 0) {
                  const firstRow = table.querySelector('tr');
                  if (firstRow) {
                    const cells = Array.from(firstRow.querySelectorAll('td')).map(td => td.innerText.trim().toUpperCase());
                    headers.push(...cells);
                  }
                }
                const hasRuc = headers.some(h => h.includes('RUC') || (h.includes('RAZON') || h.includes('RAZÓN') || h.includes('SOCIAL') || h.includes('EMISOR')));
                const hasClave = headers.some(h => h.includes('CLAVE') || h.includes('ACCESO') || h.includes('AUTORIZA'));
                const hasTipo = headers.some(h => h.includes('TIPO') || h.includes('COMPROBANTE'));
                
                if (hasRuc && hasClave && hasTipo) {
                  let selector = '';
                  if (table.id) {
                    selector = `#${table.id.replace(/:/g, '\\:')}`;
                  } else {
                    const allTables = Array.from(document.querySelectorAll('table'));
                    const idx = allTables.indexOf(table);
                    selector = `table:nth-of-type(${idx + 1})`;
                  }
                  return { selector, headers };
                }
              }
              return null;
            });

            let tableSelector = '#frmPrincipal\\:tablaCompRecibidos';
            let headers: string[] = [];
            if (tableInfo) {
              tableSelector = tableInfo.selector;
              headers = tableInfo.headers;
              console.log(`[Worker] Tabla detectada dinámicamente: ${tableSelector}`);
            } else {
              headers = await page.evaluate(() => {
                const ths = Array.from(document.querySelectorAll(
                  '#frmPrincipal\\:tablaCompRecibidos thead th, ' +
                  '[id*="tablaCompRecibidos"] thead th, ' +
                  '.rf-dt-shdr th, ' +
                  '.ui-state-default th'
                ));
                return ths.map(th => (th as HTMLElement).innerText.trim().toUpperCase());
              });
            }

            const rows = await page.$$(`${tableSelector} tbody tr, ${tableSelector} tr:not(:first-child)`);
            console.log(`[Worker] Procesando ${rows.length} filas en la tabla.`);
            
            for (let i = 0; i < rows.length; i++) {
              const row = rows[i];
              const cells = await row.$$eval('td', (tds: any[]) => tds.map((td: any) => td.innerText.trim()));
              if (cells.length < 5) continue;
              
              const colIdx = {
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

              const claveIndex = colIdx.clave !== -1 ? colIdx.clave : 3;
              const rawClave = cells[claveIndex];
              const claveAcceso = extractClaveAcceso(rawClave);
              if (!claveAcceso) {
                continue;
              }

              // Extraer datos de la fila de la tabla de forma robusta
              const emisorRuc = (colIdx.rucEmisor !== -1 ? extractRuc(cells[colIdx.rucEmisor]) : null) || claveAcceso.substring(10, 23);
              const emisorRazonSocial = colIdx.emisor !== -1 ? cleanEmisorRazonSocial(cells[colIdx.emisor]) : null;

              const tipoCode = colIdx.tipo !== -1 ? cells[colIdx.tipo] : null;
              const tipo = tipoCode ? (
                tipoCode.includes('Factura') ? '01' : 
                (tipoCode.includes('Retención') || tipoCode.includes('Retencion') || tipoCode.includes('Reten')) ? '07' : 
                (tipoCode.includes('Crédito') || tipoCode.includes('Credito')) ? '04' : 
                (tipoCode.includes('Débito') || tipoCode.includes('Debito')) ? '05' : 
                (tipoCode.includes('Liquidación') || tipoCode.includes('Liquidacion')) ? '03' : 
                claveAcceso.substring(8, 10)
              ) : claveAcceso.substring(8, 10);

              const rawSerie = colIdx.serie !== -1 ? cells[colIdx.serie] : null;
              const serie = extractSerie(rawSerie) || (claveAcceso.substring(24, 30).substring(0, 3) + '-' + claveAcceso.substring(24, 30).substring(3, 6));

              const secuencial = (colIdx.secuencial !== -1 ? extractSecuencial(cells[colIdx.secuencial]) : null) || claveAcceso.substring(30, 39);

              const fechaEmisionStr = colIdx.fechaEmision !== -1 ? cells[colIdx.fechaEmision] : null;
              let fechaEmision = null;
              if (fechaEmisionStr) {
                const parts = fechaEmisionStr.trim().split('/');
                if (parts.length === 3) {
                  fechaEmision = `${parts[2]}-${parts[1]}-${parts[0]}`;
                }
              }
              if (!fechaEmision) {
                const dayVal = claveAcceso.substring(0, 2);
                const mVal = claveAcceso.substring(2, 4);
                const yVal = claveAcceso.substring(4, 8);
                fechaEmision = `${yVal}-${mVal}-${dayVal}`;
              }

              const rawFechaAuto = colIdx.fechaAutorizacion !== -1 ? cells[colIdx.fechaAutorizacion] : null;
              let fechaAutorizacionFormatted = null;
              if (rawFechaAuto) {
                const cleanFechaAuto = rawFechaAuto.replace(/\s+/g, ' ').trim();
                const parts = cleanFechaAuto.split(' ');
                if (parts.length >= 2) {
                  const dateParts = parts[0].split('/');
                  if (dateParts.length === 3) {
                    fechaAutorizacionFormatted = `${dateParts[2]}-${dateParts[1]}-${dateParts[0]} ${parts[1]}`;
                  }
                }
              }

              const subtotalSinImpuesto = colIdx.subtotal !== -1 ? parseSriFloat(cells[colIdx.subtotal]) : 0.00;
              const totalIva = colIdx.iva !== -1 ? parseSriFloat(cells[colIdx.iva]) : 0.00;
              const importeTotal = colIdx.total !== -1 ? parseSriFloat(cells[colIdx.total]) : 0.00;
              const documentosRelacionados = colIdx.relacionados !== -1 ? cells[colIdx.relacionados] : null;

              let emisorId: string | null = null;
              if (tenantId) {
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

              // Guardar preventivamente
              const domInsertQuery = `
                INSERT INTO comprobantes 
                  (clave_acceso, tipo, serie, secuencial, estado, fecha_emision, numero_autorizacion, importe_total, receptor_identificacion, emisor_ruc, tenant_id, emisor_id, emisor_razon_social, fecha_autorizacion, subtotal_sin_impuesto, total_iva, documentos_relacionados)
                VALUES 
                  (?, ?, ?, ?, 'AUTORIZADO', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                ON DUPLICATE KEY UPDATE 
                  importe_total = VALUES(importe_total),
                  estado = 'AUTORIZADO',
                  tenant_id = COALESCE(tenant_id, VALUES(tenant_id)),
                  emisor_id = COALESCE(emisor_id, VALUES(emisor_id)),
                  emisor_razon_social = COALESCE(emisor_razon_social, VALUES(emisor_razon_social)),
                  fecha_autorizacion = COALESCE(fecha_autorizacion, VALUES(fecha_autorizacion)),
                  subtotal_sin_impuesto = VALUES(subtotal_sin_impuesto),
                  total_iva = VALUES(total_iva),
                  documentos_relacionados = COALESCE(documentos_relacionados, VALUES(documentos_relacionados)),
                  updated_at = NOW()
              `;
              await pool.query(domInsertQuery, [
                claveAcceso,
                tipo,
                serie,
                secuencial,
                fechaEmision,
                claveAcceso,
                importeTotal,
                job.ruc,
                emisorRuc,
                tenantId,
                emisorId,
                emisorRazonSocial,
                fechaAutorizacionFormatted,
                subtotalSinImpuesto,
                totalIva,
                documentosRelacionados
              ]);

              const pathXmlFinal = path.join(xmlPath, `${claveAcceso}.xml`);
              const pathPdfFinal = path.join(pdfPath, `${claveAcceso}.pdf`);

              // Si ya tenemos ambos, saltar descarga (pero asegurar detalles en BD)
              if (fs.existsSync(pathXmlFinal) && fs.existsSync(pathPdfFinal)) {
                await updateComprobanteFromXml(pool, pathXmlFinal, claveAcceso, tenantId);
                continue;
              }

              // Buscar los botones de descarga de XML y PDF RIDE en la fila de manera robusta
              const clickables = await row.$$('a, [role="button"], img, input[type="image"]');
              let xmlBtn = null;
              let pdfBtn = null;

              for (const el of clickables) {
                const innerHTML = await page.evaluate((e: any) => e.innerHTML || '', el);
                const title = await page.evaluate((e: any) => e.getAttribute('title') || '', el);
                const id = await page.evaluate((e: any) => e.getAttribute('id') || '', el);
                const alt = await page.evaluate((e: any) => e.getAttribute('alt') || '', el);
                const src = await page.evaluate((e: any) => e.getAttribute('src') || '', el);
                
                const searchStr = `${innerHTML} ${title} ${id} ${alt} ${src}`.toLowerCase();
                
                if (searchStr.includes('xml')) {
                  xmlBtn = el;
                }
                if (searchStr.includes('pdf') || searchStr.includes('ride')) {
                  pdfBtn = el;
                }
              }

              // Descargar XML
              if (xmlBtn && !fs.existsSync(pathXmlFinal)) {
                clearTempFolder();
                await xmlBtn.evaluate((b: any) => b.click());
                const downloadedXml = await waitForDownload(tempPath, '.xml', 15000);
                if (downloadedXml) {
                  fs.renameSync(downloadedXml, pathXmlFinal);
                  xmlsDescargados++;
                }
              }

              // Descargar PDF
              if (pdfBtn && !fs.existsSync(pathPdfFinal)) {
                clearTempFolder();
                await pdfBtn.evaluate((b: any) => b.click());
                const downloadedPdf = await waitForDownload(tempPath, '.pdf', 15000);
                if (downloadedPdf) {
                  fs.renameSync(downloadedPdf, pathPdfFinal);
                  pdfsDescargados++;
                }
              }

              // Asegurar que actualizamos los detalles en BD usando el XML
              if (fs.existsSync(pathXmlFinal)) {
                await updateComprobanteFromXml(pool, pathXmlFinal, claveAcceso, tenantId);
              }
            }

            // Chequear paginador de RichFaces
            const nextButton = await page.$('.rf-ds-btn-next:not(.rf-ds-dis), [id*="ds_next"]:not(.rf-ds-dis)');
            if (nextButton) {
              paginaActual++;
              
              const firstRowClaveBefore = await page.evaluate((sel: string) => {
                const firstRow = document.querySelector(`${sel} tbody tr, ${sel} tr:not(:first-child)`);
                if (!firstRow) return '';
                const cells = firstRow.querySelectorAll('td');
                for (const cell of Array.from(cells)) {
                  const match = cell.innerText.trim().match(/\d{49}/);
                  if (match) return match[0];
                }
                return cells.length >= 4 ? cells[3].innerText.trim() : '';
              }, tableSelector);

              await nextButton.click();
              
              let pageChanged = false;
              for (let attempt = 0; attempt < 10; attempt++) {
                await new Promise(r => setTimeout(r, 1000));
                const firstRowClaveAfter = await page.evaluate((sel: string) => {
                  const firstRow = document.querySelector(`${sel} tbody tr, ${sel} tr:not(:first-child)`);
                  if (!firstRow) return '';
                  const cells = firstRow.querySelectorAll('td');
                  for (const cell of Array.from(cells)) {
                    const match = cell.innerText.trim().match(/\d{49}/);
                    if (match) return match[0];
                  }
                  return cells.length >= 4 ? cells[3].innerText.trim() : '';
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

    } catch (error: any) {
      console.error(`[Job ${job?.id || '?'}] Error en el worker:`, error.message);
      if (page) {
        try {
          const errScreenshotPath = path.resolve(`./downloads/worker-error-${job?.id || 'unknown'}.png`);
          await page.screenshot({ path: errScreenshotPath, fullPage: true });
          console.error(`[Job ${job?.id || '?'}] Captura de pantalla del error guardada en: ${errScreenshotPath}`);
          console.error(`[Job ${job?.id || '?'}] URL del error: ${page.url()}`);
        } catch (e: any) {
          console.error(`[Job ${job?.id || '?'}] No se pudo tomar captura del error:`, e.message);
        }
      }
      if (job) {
        await updateProgress(pool, job.id, `Error crítico: ${error.message}`, 'ERROR');
      }
      await new Promise(res => setTimeout(res, 10000));
    } finally {
      if (browser) {
        await browser.close().catch(() => {});
      }
    }
    
    await new Promise(res => setTimeout(res, 5000));
  }
}

runWorker().catch(err => {
  console.error("Fallo crítico en Worker:", err);
  process.exit(1);
});
