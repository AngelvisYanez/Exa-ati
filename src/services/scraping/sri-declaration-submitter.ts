import type { Page } from 'playwright';

const SRI_PORTAL_BASE = 'https://srienlinea.sri.gob.ec';
const DECLARACIONES_URL = `${SRI_PORTAL_BASE}/sri-en-linea/contribuyente/declaraciones`;
const FORM104_URL = `${SRI_PORTAL_BASE}/sri-en-linea/contribuyente/declaraciones/104`;

export interface DeclarationData {
  ruc: string;
  claveSri: string;
  periodo: string;
  fechaDesde: string;
  fechaHasta: string;
  casilleros: Record<string, number>;
  ivaAPagar: number;
  otp?: string;
}

export interface DeclarationResult {
  success: boolean;
  numeroTramite?: string;
  estado?: string;
  mensaje?: string;
  error?: string;
  captureFile?: string;
}

export interface SubmitDeclarationOptions {
  /** Si true, la página ya tiene sesión SRI (p. ej. SriPlaywrightScraper.login). */
  alreadyLoggedIn?: boolean;
  onProgress?: (msg: string) => Promise<void>;
}

/**
 * Presenta una Declaración de IVA (Formulario 104) al portal del SRI
 * con una Page de Playwright ya autenticada (SriPlaywrightScraper).
 */
export async function submitDeclaration(
  page: Page,
  data: DeclarationData,
  opts: SubmitDeclarationOptions = {}
): Promise<DeclarationResult> {
  const updateProgress = opts.onProgress || (async (_msg: string) => {});
  try {
    if (!opts.alreadyLoggedIn) {
      throw new Error(
        'submitDeclaration requiere sesión Playwright activa (SriPlaywrightScraper.login + alreadyLoggedIn: true).'
      );
    }

    await updateProgress('Navegando a la sección de declaraciones...');
    await page.goto(DECLARACIONES_URL, {
      waitUntil: 'domcontentloaded',
      timeout: 60000,
    });
    await page.waitForTimeout(3000);

    // 3. Look for the Formulario 104 link or button
    await updateProgress('Buscando Formulario 104...');

    // Try multiple selectors for the 104 form link
    const form104Selectors = [
      'a[href*="104"]',
      'a:has-text("104")',
      'button:has-text("104")',
      'tr:has-text("104") a',
      '.declaracion:has-text("104")',
      'a:has-text("Formulario 104")',
      'a:has-text("DECLARACIONES DEL IVA")',
    ];

    let found104 = false;
    for (const selector of form104Selectors) {
      try {
        const el = await page.$(selector);
        if (el) {
          await el.click();
          found104 = true;
          break;
        }
      } catch {
        // try next selector
      }
    }

    if (!found104) {
      // Try navigating directly to the form URL
      await page.goto(FORM104_URL, {
        waitUntil: 'domcontentloaded',
        timeout: 60000,
      });
    }

    await page.waitForTimeout(3000);

    // 4. Look for "Nuevo" or "Presentar Declaración" button
    await updateProgress('Iniciando nueva declaración...');

    const nuevoBtnSelectors = [
      'button:has-text("Nuevo")',
      'a:has-text("Nuevo")',
      'button:has-text("Presentar")',
      'a:has-text("Presentar Declaración")',
      'input[value="Nuevo"]',
      '.btn-nuevo',
      '#btn-nuevo',
    ];

    for (const selector of nuevoBtnSelectors) {
      try {
        const el = await page.$(selector);
        if (el) {
          await el.click();
          break;
        }
      } catch {
        // try next
      }
    }

    await page.waitForTimeout(3000);

    // 5. Select the period (month/year)
    await updateProgress(`Seleccionando período: ${data.periodo}...`);

    // Try to select period from dropdown or date picker
    const periodSelectors = [
      'select[name*="periodo"]',
      'select[name*="mes"]',
      'select[id*="periodo"]',
      'select[id*="mes"]',
      '#periodo',
      '#mes',
    ];

    for (const selector of periodSelectors) {
      try {
        const el = await page.$(selector);
        if (el) {
          // Extract month and year from period string
          const monthMatch = data.periodo.match(/(enero|febrero|marzo|abril|mayo|junio|julio|agosto|septiembre|setiembre|octubre|noviembre|diciembre)/i);
          const yearMatch = data.periodo.match(/(\d{4})/);

          if (monthMatch) {
            const months: Record<string, string> = {
              enero: '01', febrero: '02', marzo: '03', abril: '04',
              mayo: '05', junio: '06', julio: '07', agosto: '08',
              septiembre: '09', setiembre: '09', octubre: '10',
              noviembre: '11', diciembre: '12',
            };
            const monthVal = months[monthMatch[1].toLowerCase()];
            if (monthVal) {
              await page.selectOption(selector, monthVal);
            }
          }
          break;
        }
      } catch {
        // try next
      }
    }

    // Try to set year
    const yearSelectors = [
      'select[name*="anio"]',
      'select[name*="ano"]',
      'select[id*="anio"]',
      'select[id*="ano"]',
    ];

    const yearMatch = data.periodo.match(/(\d{4})/);
    if (yearMatch) {
      for (const selector of yearSelectors) {
        try {
          const el = await page.$(selector);
          if (el) {
            await page.selectOption(selector, yearMatch[1]);
            break;
          }
        } catch {
          // try next
        }
      }
    }

    await page.waitForTimeout(2000);

    // 6. Fill in the tax form casilleros
    await updateProgress('Llenando casilleros del formulario...');

    // Map casilleros to form field selectors
    const casilleroMapping: Record<string, string[]> = {
      '401': ['input[name*="401"]', '#casillero_401', '[id*="401"]', 'input[aria-label*="401"]'],
      '411': ['input[name*="411"]', '#casillero_411', '[id*="411"]', 'input[aria-label*="411"]'],
      '500': ['input[name*="500"]', '#casillero_500', '[id*="500"]', 'input[aria-label*="500"]'],
      '553': ['input[name*="553"]', '#casillero_553', '[id*="553"]', 'input[aria-label*="553"]'],
      '604': ['input[name*="604"]', '#casillero_604', '[id*="604"]', 'input[aria-label*="604"]'],
      '699': ['input[name*="699"]', '#casillero_699', '[id*="699"]', 'input[aria-label*="699"]'],
    };

    for (const [cod, selectors] of Object.entries(casilleroMapping)) {
      const value = data.casilleros[cod];
      if (value === undefined) continue;

      for (const selector of selectors) {
        try {
          const el = await page.$(selector);
          if (el) {
            await el.click({ clickCount: 3 });
            await el.type(value.toFixed(2), { delay: 30 });
            break;
          }
        } catch {
          // try next selector
        }
      }
    }

    await page.waitForTimeout(2000);

    // 7. CAPTCHA: espera configurable (mismo patrón que SriPlaywrightScraper)
    await updateProgress('Verificando CAPTCHA...');
    const hasCaptcha = await page.evaluate(() => {
      return (
        document.querySelector('iframe[src*="recaptcha"]') !== null ||
        document.querySelector('.g-recaptcha') !== null ||
        document.getElementById('g-recaptcha-response') !== null
      );
    });

    if (hasCaptcha) {
      const waitMs = Math.max(0, Number(process.env.SRI_CONSULTAR_WAIT_MS || 90000));
      await updateProgress(
        `CAPTCHA detectado: esperando ${Math.round(waitMs / 1000)}s (SRI_CONSULTAR_WAIT_MS) o resolución manual...`
      );
      await page.waitForTimeout(waitMs);
    }

    // 8. Accept terms and conditions
    await updateProgress('Aceptando términos...');
    const acceptSelectors = [
      'input[type="checkbox"][name*="acepto"]',
      'input[type="checkbox"][name*="accept"]',
      'input[type="checkbox"]:not([name])',
      '#acepto',
      '.acepto',
    ];

    for (const selector of acceptSelectors) {
      try {
        const el = await page.$(selector);
        if (el) {
          const isChecked = await el.isChecked();
          if (!isChecked) {
            await el.click();
          }
          break;
        }
      } catch {
        // try next
      }
    }

    await page.waitForTimeout(1000);

    // 9. Submit the declaration
    await updateProgress('Presentando declaración al SRI...');

    const submitSelectors = [
      'button:has-text("Presentar")',
      'input[value="Presentar"]',
      'button:has-text("Enviar")',
      'button[type="submit"]:has-text("Presentar")',
      '#btn-presentar',
      '.btn-presentar',
      'input[type="submit"]',
    ];

    let submitted = false;
    for (const selector of submitSelectors) {
      try {
        const el = await page.$(selector);
        if (el) {
          await el.click();
          submitted = true;
          break;
        }
      } catch {
        // try next
      }
    }

    if (!submitted) {
      return {
        success: false,
        error: 'No se encontró el botón de presentar en el formulario del SRI.',
      };
    }

    // 10. Wait for confirmation
    await updateProgress('Esperando respuesta del SRI...');
    await page.waitForTimeout(5000);

    // Check for confirmation page or modal
    const result = await page.evaluate(() => {
      const body = document.body.innerText;

      // Look for tramite number
      const tramiteMatch = body.match(
        /(?:N[uú]mero\s+de\s+[Tt]r[aá]mite|Tr[aá]mite|No\.\s*Tr[aá]mite)[:\s]*(\d[\d\-]+)/i
      );

      // Look for success message
      const hasSuccess =
        body.includes('presentada correctamente') ||
        body.includes('registrada correctamente') ||
        body.includes('declaración presentada') ||
        body.includes('enviada exitosamente') ||
        body.includes('NÃšMERO DE TRÁMITE');

      // Look for error message
      const hasError =
        body.includes('error') ||
        body.includes('rechazada') ||
        body.includes('no se pudo') ||
        body.includes('falló');

      // Look for estado
      const estadoMatch = body.match(
        /Estado[:\s]*(REGISTRADA|PRESENTADA|EN PROCESO|AUTORIZADA|RECHAZADA)/i
      );

      return {
        tramite: tramiteMatch ? tramiteMatch[1] : null,
        hasSuccess,
        hasError,
        estado: estadoMatch ? estadoMatch[1].toUpperCase() : null,
        bodySnippet: body.substring(0, 500),
      };
    });

    if (result.tramite || result.hasSuccess) {
      await updateProgress(`Declaración presentada. Trámite: ${result.tramite || 'Pendiente'}`);
      return {
        success: true,
        numeroTramite: result.tramite || undefined,
        estado: result.estado || 'PRESENTADA',
        mensaje: 'Declaración presentada correctamente al SRI',
      };
    }

    if (result.hasError) {
      return {
        success: false,
        error: `El SRI respondió con posibles errores: ${result.bodySnippet.substring(0, 200)}`,
        captureFile: result.bodySnippet,
      };
    }

    // If we can't determine the result, capture a screenshot for debugging
    return {
      success: false,
      error: 'No se pudo determinar el resultado de la presentación. Revisa el portal SRI manualmente.',
      captureFile: result.bodySnippet,
    };
  } catch (error: any) {
    return {
      success: false,
      error: error.message || 'Error desconocido al presentar declaración',
    };
  }
}
