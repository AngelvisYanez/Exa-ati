import fs from 'fs';
import path from 'path';
import {

  getTipoDocDesc, parseSriFloat, extractClaveAcceso, extractRuc, extractSerie,
  extractSecuencial, extractFechaEmision, mapSriTypeCode, classifyExpense,
  cleanEmisorRazonSocial, extractDocumentosRelacionados, extractIva,
  parseLocalIsoDate, getDaysInRange, waitForDownload,
  updateComprobanteFromXml, realisticClick, clickButtonByText, type DbLike,
} from '../../../src/lib/scraping/sri-utils';

function toMysqlPlaceholders(sql: string): string {
  return sql.replace(/\$(\d+)/g, '?');
}

function makeDbAdapter(pool: any): DbLike {
  return {
    queryOne: async (sql, params) => {
      const [rows] = await pool.query(toMysqlPlaceholders(sql), params);
      return Array.isArray(rows) && rows.length > 0 ? rows[0] : null;
    },
    query: async (sql, params) => {
      const [rows] = await pool.query(toMysqlPlaceholders(sql), params);
      return { rows: Array.isArray(rows) ? rows : [], rowCount: Array.isArray(rows) ? rows.length : 0 };
    },
  };
}

export async function downloadReceivedComprobantes(
  page: any,
  pool: any,
  job: any,
  updateProgress: (pool: any, id: number, message: string, status?: string) => Promise<void>,
  solveRecaptchaAntiCaptcha: any,
  trySolveRecaptcha: any
): Promise<void> {
  const db = makeDbAdapter(pool);
  const startD = parseLocalIsoDate(job.fecha_desde);
  const endD = parseLocalIsoDate(job.fecha_hasta);
  const docTypeSelect = job.tipo_comprobante || '1';

  let tenantId: string | null = null;
  try {
    const emisorRow = await db.queryOne(
      "SELECT tenant_id FROM emisores WHERE ruc = $1 AND activo = true LIMIT 1",
      [job.ruc]
    );
    if (emisorRow) {
      tenantId = emisorRow.tenant_id;
    }
  } catch (err: any) {
    console.error('[Worker] Error al consultar tenantId:', err.message);
  }

  await updateProgress(pool, job.id, 'Navegando a Comprobantes Recibidos...');
  try {
    await page.goto('https://srienlinea.sri.gob.ec/tuportal-internet/accederAplicacion.jspa?redireccion=57&idGrupo=55', { 
      waitUntil: 'domcontentloaded',
      timeout: 120000
    });
  } catch (err: any) {
    if (err.message.includes('net::ERR_ABORTED') || err.message.includes('Navigation aborted')) {
      console.log('[Worker] Redirección en progreso (ERR_ABORTED ignorado)');
    } else {
      throw err;
    }
  }
  
  await updateProgress(pool, job.id, 'Esperando a que cargue la aplicación de comprobantes...');
  await page.waitForSelector('select[id*="ano"], select[name*="ano"], input[value="ruc"]', { timeout: 120000 });
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

      await page.waitForSelector('select[id*="ano"]', { timeout: 30000 });
      
      await page.select('select[id*="ano"]', String(year));
      await new Promise(r => setTimeout(r, 1500));
      await page.select('select[id*="mes"]', String(month));
      await new Promise(r => setTimeout(r, 1500));
      await page.select('select[id*="dia"]', String(day));
      await new Promise(r => setTimeout(r, 1000));
      
      await page.select('select[id*="cmbTipoComprobante"]', String(typeCode));
      await new Promise(r => setTimeout(r, 1000));
      
      let searchSuccess = false;
      let captchaWasHandled = false;
      const MAX_SEARCH_ATTEMPTS = 5;
      for (let attempt = 0; attempt < MAX_SEARCH_ATTEMPTS; attempt++) {
        console.log(`[Worker Debug] Intento de búsqueda ${attempt + 1}/${MAX_SEARCH_ATTEMPTS}...`);

        // Si el frame se desprendió entre intentos (Buster/CAPTCHA causa navegación),
        // re-navegamos a la página de comprobantes
        try {
          await page.evaluate(() => 1);
        } catch {
          console.log('[Worker Debug] Frame detached, re-navegando a comprobantes...');
          await page.goto('https://srienlinea.sri.gob.ec/tuportal-internet/accederAplicacion.jspa?redireccion=57&idGrupo=55', { 
            waitUntil: 'domcontentloaded',
            timeout: 60000
          }).catch(() => {});
          await page.waitForSelector('select[id*="ano"], body', { timeout: 30000 }).catch(() => {});
          await new Promise(r => setTimeout(r, 3000));
        }

        // Limpiar filas de la consulta anterior y mensajes para evitar falsos positivos
        await page.evaluate(() => {
          const rows = document.querySelectorAll('#frmPrincipal\\:tablaCompRecibidos tr, [id*="tablaCompRecibidos"] tr');
          rows.forEach(tr => tr.remove());
          const msgs = document.querySelectorAll('.ui-messages, .rf-msg, .ui-message, [id*="mensaje"], [id*="mensajes"]');
          msgs.forEach(m => m.remove());
        }).catch(() => {});

        // Pre-resolver CAPTCHA con Anti-Captcha antes del clic
        if (ANTICAPTCHA_KEY) {
          console.log('[Worker CAPTCHA] Pre-resolviendo CAPTCHA con Anti-Captcha antes de buscar...');
          await solveRecaptchaAntiCaptcha(page, 'consulta_cel_recibidos');
        }

        let searchBtn;
        try {
          searchBtn = await page.$('button[id*="btnConsultar"], button[id*="btnBuscar"], button[id*="Consultar"], button[id*="Buscar"]');
        } catch {
          console.log('[Worker Debug] Frame detached en searchBtn, saltando reintento...');
          continue;
        }
        if (searchBtn) {
          await realisticClick(page, 'button[id*="btnConsultar"], button[id*="btnBuscar"], button[id*="Consultar"], button[id*="Buscar"]');
        } else {
          await clickButtonByText(page, 'Consultar');
        }
        await new Promise(r => setTimeout(r, 3000));

        // Detectar y resolver CAPTCHA activo (Buster se usa DESPUÉS del clic)
        const hasChallenge = await page.evaluate(() => {
          const frames = Array.from(document.querySelectorAll('iframe'));
          return frames.some(f => f.src.includes('api2/bframe') || f.src.includes('bframe') || f.name.includes('c-'));
        }).catch(() => false);
        if (hasChallenge) {
          console.log('[Worker CAPTCHA] Se detectó popup de CAPTCHA activo en la búsqueda. Resolviendo...');
          let solved = false;
          if (ANTICAPTCHA_KEY) {
            solved = await solveRecaptchaAntiCaptcha(page, 'consulta_cel_recibidos');
          }
          if (!solved) {
            solved = await trySolveRecaptcha(page);
          }
          if (solved) {
            console.log('[Worker CAPTCHA] ✅ CAPTCHA resuelto. Re-enviando búsqueda vía PrimeFaces.ab...');
            captchaWasHandled = true;
            await new Promise(r => setTimeout(r, 2000));
            await page.evaluate(() => {
              try {
                (window as any).PrimeFaces?.ab?.({source: 'frmPrincipal:btnBuscar'});
              } catch (e) {
                const form = document.getElementById('frmPrincipal') as HTMLFormElement;
                if (form) form.submit();
              }
            }).catch((err: any) => {
              console.log('[Worker CAPTCHA] Error en re-submit:', err.message);
            });
            await new Promise(r => setTimeout(r, 6000));
          } else {
            console.log('[Worker CAPTCHA] ⚠️ No se pudo resolver el CAPTCHA.');
            await new Promise(r => setTimeout(r, 4000));
          }
        }

        console.log('[Worker Debug] Esperando resultados...');
        let state = { hasTable: false, hasNoResults: false, hasCaptchaError: false };
        try {
          await page.waitForFunction(() => {
            const bodyText = document.body.innerText;
            const hasNoResults = bodyText.includes('No se encontraron') || 
                                bodyText.includes('No existen') ||
                                bodyText.includes('No se encontraron resultados') ||
                                bodyText.includes('No existen registros');
            const hasTable = document.querySelector(
              '#frmPrincipal\\:tablaCompRecibidos table.rf-dt-bdy tr, #frmPrincipal\\:tablaCompRecibidos tr, [id*="tablaCompRecibidos"] tr, #frmPrincipal\\:tablaCompRecibidos table tr'
            ) !== null;
            const hasCaptchaError = bodyText.includes('Captcha incorrecta') || bodyText.includes('CAPTCHA incorrecto');
            return hasNoResults || hasTable || hasCaptchaError;
          }, { timeout: 15000 });

          state = await page.evaluate(() => {
            const bodyText = document.body.innerText;
            const hasNoResults = bodyText.includes('No se encontraron') || 
                                bodyText.includes('No existen') ||
                                bodyText.includes('No se encontraron resultados') ||
                                bodyText.includes('No existen registros');
            const hasTable = document.querySelector(
              '#frmPrincipal\\:tablaCompRecibidos table.rf-dt-bdy tr, #frmPrincipal\\:tablaCompRecibidos tr, [id*="tablaCompRecibidos"] tr, #frmPrincipal\\:tablaCompRecibidos table tr'
            ) !== null;
            const hasCaptchaError = bodyText.includes('Captcha incorrecta') || bodyText.includes('CAPTCHA incorrecto');
            return { hasNoResults, hasTable, hasCaptchaError };
          });
        } catch (waitErr) {
          console.log('[Worker Debug] Timeout esperando respuesta de la consulta.');
          const bodyPreview = await page.evaluate(() => document.body?.innerText?.substring(0, 500)).catch(() => 'N/A');
          console.log(`[Worker Debug] Diagnóstico - body text:\n${bodyPreview}`);
          try {
            const dbgPath = path.resolve(`./downloads/debug-${year}${month}${day}-${attempt}.png`);
            await page.screenshot({ path: dbgPath });
            console.log(`[Worker Debug] Screenshot guardado en: ${dbgPath}`);
          } catch {}
          if (captchaWasHandled) {
            console.log('[Worker Debug] CAPTCHA ya resuelto y re-submit hecho. Asumiendo sin resultados.');
            break;
          }
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
        const lowerBody = bodyText.toLowerCase();
        const hasNoResultsMsg = lowerBody.includes('no se encontraron registros') || 
                                lowerBody.includes('no se encontraron comprobantes') ||
                                lowerBody.includes('no existen comprobantes') ||
                                lowerBody.includes('no existen registros') ||
                                lowerBody.includes('no se encontraron resultados') ||
                                lowerBody.includes('no existen datos') ||
                                lowerBody.includes('parametos ingresado') ||
                                lowerBody.includes('parámetros ingresados');
        
        const trs = Array.from(document.querySelectorAll('#frmPrincipal\\:tablaCompRecibidos tr, [id*="tablaCompRecibidos"] tr'));
        const hasTableRows = trs.some(tr => (tr as HTMLElement).innerText.match(/\d{49}/) !== null);
        return hasNoResultsMsg && !hasTableRows;
      });

      if (noDataFound) {
        const msgNoData = `No se encontraron datos para ${currentLabel} el día ${formattedDateStr}`;
        await updateProgress(pool, job.id, msgNoData);

        try {
          await db.query(
            `INSERT INTO auditoria (usuario_email, tenant_id, accion, recurso, descripcion, datos_nuevos, exitoso)
             VALUES ($1, $2, 'SCRAPING_NO_DATA', 'comprobantes', $3, $4, true)`,
            [
              'worker@system.local',
              tenantId,
              msgNoData,
              JSON.stringify({ ruc: job.ruc, fecha: formattedDateStr, tipo: typeCode })
            ]
          );
        } catch (e: any) {
          console.error('[Worker] Error al guardar auditoria de no-data:', e.message);
        }
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
            const exists = await db.queryOne(
              "SELECT id, estado FROM comprobantes WHERE clave_acceso = $1 LIMIT 1",
              [key]
            );
            if (!exists) {
              const rucEmisor = extractRuc(key);
              const serie = extractSerie(key);
              const secuencial = extractSecuencial(key);

              await db.query(
                `INSERT INTO comprobantes (
                  clave_acceso, tipo, emisor_ruc, serie, secuencial, estado, receptor_identificacion, tenant_id, fecha_emision, categoria
                ) VALUES (
                  $1, $2, $3, $4, $5, 'PENDIENTE', $6, $7, $8, 'Otros'
                )`,
                [key, mapSriTypeCode(typeCode), rucEmisor, serie, secuencial, job.ruc, tenantId, extractFechaEmision(key)]
              );
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
        const rows = Array.from(document.querySelectorAll(sel + ' tr')).filter(tr => (tr as HTMLElement).innerText.match(/\d{49}/) !== null);
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
          const rows = Array.from(document.querySelectorAll(sel + ' tr')).filter(tr => (tr as HTMLElement).innerText.match(/\d{49}/) !== null);
          return rows.length;
        }, tableSelector);

        for (let rowIndex = 0; rowIndex < rowCount; rowIndex++) {
          const rowData = await page.evaluate((sel: string, idx: number) => {
            const rows = Array.from(document.querySelectorAll(sel + ' tr')).filter(tr => (tr as HTMLElement).innerText.match(/\d{49}/) !== null);
            if (idx >= rows.length) return null;
            const cells = rows[idx].querySelectorAll('td');
            const cellTexts = Array.from(cells).map(c => (c as HTMLElement).innerText.trim());
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

          const dbCheck = await db.queryOne(
            "SELECT id, estado FROM comprobantes WHERE clave_acceso = $1 LIMIT 1",
            [claveAcceso]
          );
          let recordId = null;
          let currentStatus = 'PENDIENTE';

          if (dbCheck) {
            recordId = dbCheck.id;
            currentStatus = dbCheck.estado;
          }

          if (!recordId) {
            const serie = extractSerie(claveAcceso);
            const secuencial = extractSecuencial(claveAcceso);
            await db.query(
              `INSERT INTO comprobantes (
                clave_acceso, tipo, emisor_ruc, emisor_razon_social,
                serie, secuencial, estado, importe_total, receptor_identificacion, tenant_id, fecha_emision, categoria
              ) VALUES (
                $1, $2, $3, $4, $5, $6, 'PENDIENTE', $7, $8, $9, $10, $11
              )`,
              [
                claveAcceso, mapSriTypeCode(typeCode), rucEmisor, razonSocialEmisor,
                serie, secuencial, total, job.ruc, tenantId, extractFechaEmision(claveAcceso), classifyExpense(razonSocialEmisor)
              ]
            );
          } else {
            await db.query(
              `UPDATE comprobantes SET
                emisor_razon_social = COALESCE($1, emisor_razon_social),
                importe_total = COALESCE(CASE WHEN $2 = 0 THEN NULL ELSE $3 END, importe_total),
                tenant_id = COALESCE(tenant_id, $4),
                fecha_emision = COALESCE(fecha_emision, $5),
                categoria = CASE WHEN categoria IS NULL OR categoria = 'Otros' THEN $6 ELSE categoria END,
                updated_at = NOW()
              WHERE id = $7`,
              [
                razonSocialEmisor, total, total, tenantId, extractFechaEmision(claveAcceso), classifyExpense(razonSocialEmisor), recordId
              ]
            );
          }

          const needsXml = !fs.existsSync(pathXmlFinal) || currentStatus !== 'AUTORIZADO';
          const needsPdf = !fs.existsSync(pathPdfFinal);

          if (needsXml || needsPdf) {
            let actionButtons = await page.evaluateHandle((sel: string, idx: number) => {
              const rows = Array.from(document.querySelectorAll(sel + ' tr')).filter(tr => (tr as HTMLElement).innerText.match(/\d{49}/) !== null);
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
              await updateComprobanteFromXml(db, pathXmlFinal, claveAcceso, tenantId);
            }
          }

          if (colIdx.relacionados !== -1 && rowData.textos[colIdx.relacionados]) {
            try {
              const relCellHtml = await page.evaluate(
                (sel: string, idx: number, relCol: number) => {
                  const rows = Array.from(document.querySelectorAll(sel + ' tr'))
                    .filter(tr => (tr as HTMLElement).innerText.match(/\d{49}/) !== null);
                  if (idx >= rows.length) return null;
                  const cells = rows[idx].querySelectorAll('td');
                  if (relCol < 0 || relCol >= cells.length) return null;
                  return cells[relCol].innerHTML;
                },
                tableSelector, rowIndex, colIdx.relacionados
              );
              if (relCellHtml && /<a\s/i.test(relCellHtml)) {
                console.log(`[Worker] Abriendo modal relacionado (fila ${rowIndex + 1})...`);
                const relLinkRect = await page.evaluate(
                  (sel: string, idx: number, relCol: number) => {
                    const rows = Array.from(document.querySelectorAll(sel + ' tr'))
                      .filter(tr => (tr as HTMLElement).innerText.match(/\d{49}/) !== null);
                    if (idx >= rows.length) return null;
                    const cells = rows[idx].querySelectorAll('td');
                    if (relCol < 0 || relCol >= cells.length) return null;
                    const link = cells[relCol].querySelector('a');
                    if (!link) return null;
                    const r = link.getBoundingClientRect();
                    return { x: r.x + window.scrollX, y: r.y + window.scrollY, w: r.width, h: r.height };
                  },
                  tableSelector, rowIndex, colIdx.relacionados
                );
                if (relLinkRect) {
                  const cx = relLinkRect.x + relLinkRect.w / 2 + (Math.random() - 0.5) * 4;
                  const cy = relLinkRect.y + relLinkRect.h / 2 + (Math.random() - 0.5) * 4;
                  await page.mouse.move(cx, cy, { steps: 3 + Math.floor(Math.random() * 4) });
                  await new Promise(r => setTimeout(r, 40 + Math.random() * 60));
                  await page.mouse.click(cx, cy);
                  await new Promise(r => setTimeout(r, 3000));
                  try {
                    await page.waitForSelector(
                      '.rf-pp-cnt, .ui-dialog-content, [role="dialog"], div[id*="popup"]:not([style*="none"]), div[id*="dlg"]:not([style*="none"])',
                      { timeout: 15000 }
                    );
                  } catch { }
                  const relatedClave = await page.evaluate(() => {
                    const modal = document.querySelector(
                      '.rf-pp-cnt, .ui-dialog-content, [role="dialog"], div[id*="popup"], div[id*="dlg"]'
                    );
                    if (!modal) return null;
                    const text = (modal as HTMLElement).innerText;
                    const match = text.match(/\d{49}/);
                    return match ? match[0] : null;
                  });
                  if (relatedClave && relatedClave !== claveAcceso) {
                    console.log(`[Worker] Relacionado: ${relatedClave}`);
                    const relExists = await db.queryOne(
                      'SELECT id, estado FROM comprobantes WHERE clave_acceso = $1 LIMIT 1',
                      [relatedClave]
                    );
                    if (!relExists) {
                      await db.query(
                        `INSERT INTO comprobantes (clave_acceso, tipo, emisor_ruc, serie, secuencial, estado, receptor_identificacion, tenant_id, fecha_emision, categoria)
                         VALUES ($1, $2, $3, $4, $5, 'PENDIENTE', $6, $7, $8, 'Otros')`,
                        [relatedClave, mapSriTypeCode(typeCode), extractRuc(relatedClave), extractSerie(relatedClave), extractSecuencial(relatedClave), job.ruc, tenantId, extractFechaEmision(relatedClave)]
                      );
                    }
                    const relPathXml = path.join(xmlPath, `${relatedClave}.xml`);
                    const relPathPdf = path.join(pdfPath, `${relatedClave}.pdf`);
                    if (!fs.existsSync(relPathXml) || !fs.existsSync(relPathPdf)) {
                      const relBtns = await page.evaluate(() => {
                        const modal = document.querySelector(
                          '.rf-pp-cnt, .ui-dialog-content, [role="dialog"], div[id*="popup"], div[id*="dlg"]'
                        );
                        if (!modal) return [];
                        const btns = modal.querySelectorAll('a, input[type="image"], button');
                        return Array.from(btns).map((b, i) => ({
                          index: i,
                          src: (b as HTMLElement).getAttribute('src') || '',
                          id: (b as HTMLElement).getAttribute('id') || '',
                          title: (b as HTMLElement).getAttribute('title') || '',
                          text: (b as HTMLElement).textContent?.trim().toLowerCase() || '',
                          href: (b as HTMLAnchorElement).href || '',
                        }));
                      });
                      const relXmlBtn = relBtns.find((b: any) => (b.src + b.id + b.title + b.text + b.href).toLowerCase().includes('xml') || b.text.includes('comprobante'));
                      const relPdfBtn = relBtns.find((b: any) => (b.src + b.id + b.title + b.text + b.href).toLowerCase().includes('pdf') || b.text.includes('ride'));
                      if (relXmlBtn && !fs.existsSync(relPathXml)) {
                        clearTempFolder();
                        await page.evaluate((idx: number) => {
                          const modal = document.querySelector('.rf-pp-cnt, .ui-dialog-content, [role="dialog"], div[id*="popup"], div[id*="dlg"]');
                          if (!modal) return;
                          const btns = modal.querySelectorAll('a, input[type="image"], button');
                          if (idx < btns.length) (btns[idx] as HTMLElement).click();
                        }, relXmlBtn.index);
                        const dl = await waitForDownload(tempPath, '.xml', 15000);
                        if (dl) { fs.renameSync(dl, relPathXml); xmlsDescargados++; }
                      }
                      if (relPdfBtn && !fs.existsSync(relPathPdf)) {
                        clearTempFolder();
                        await page.evaluate((idx: number) => {
                          const modal = document.querySelector('.rf-pp-cnt, .ui-dialog-content, [role="dialog"], div[id*="popup"], div[id*="dlg"]');
                          if (!modal) return;
                          const btns = modal.querySelectorAll('a, input[type="image"], button');
                          if (idx < btns.length) (btns[idx] as HTMLElement).click();
                        }, relPdfBtn.index);
                        const dl = await waitForDownload(tempPath, '.pdf', 15000);
                        if (dl) { fs.renameSync(dl, relPathPdf); pdfsDescargados++; }
                      }
                      if (fs.existsSync(relPathXml)) {
                        await updateComprobanteFromXml(db, relPathXml, relatedClave, tenantId);
                      }
                    }
                  }
                  try {
                    await page.evaluate(() => {
                      const cb = document.querySelector<HTMLElement>('.rf-pp-btn-close, .ui-dialog-titlebar-close, a[class*="close"], button[class*="close"], .ui-messages-close');
                      if (cb) cb.click();
                    });
                    await new Promise(r => setTimeout(r, 1500));
                  } catch { }
                }
              }
            } catch (relErr: any) {
              console.error(`[Worker] Error procesando relacionado:`, relErr.message);
            }
          }
        }

        const nextButton = await page.$('.rf-ds-btn-next:not(.rf-ds-dis), [id*="ds_next"]:not(.rf-ds-dis)');
        if (nextButton) {
          paginaActual++;
          
          const firstRowClaveBefore = await page.evaluate((sel: string) => {
            const rows = Array.from(document.querySelectorAll(sel + ' tr')).filter(tr => (tr as HTMLElement).innerText.match(/\d{49}/) !== null);
            if (rows.length === 0) return '';
            const cells = rows[0].querySelectorAll('td');
            for (const cell of Array.from(cells)) {
              const match = (cell as HTMLElement).innerText.trim().match(/\d{49}/);
              if (match) return match[0];
            }
            return '';
          }, tableSelector);

          await nextButton.click();
          
          let pageChanged = false;
          for (let attempt = 0; attempt < 10; attempt++) {
            await new Promise(r => setTimeout(r, 1000));
            const firstRowClaveAfter = await page.evaluate((sel: string) => {
              const rows = Array.from(document.querySelectorAll(sel + ' tr')).filter(tr => (tr as HTMLElement).innerText.match(/\d{49}/) !== null);
              if (rows.length === 0) return '';
              const cells = rows[0].querySelectorAll('td');
              for (const cell of Array.from(cells)) {
                const match = (cell as HTMLElement).innerText.trim().match(/\d{49}/);
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
