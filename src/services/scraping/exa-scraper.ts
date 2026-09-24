/**
 * @deprecated EXA stub scrapers (invented URLs). Replaced by Playwright:
 * - Declaraciones → `sri-playwright-declaraciones.ts`
 * - Retenciones → `SriPlaywrightScraper` tipo comprobante `6`
 * Do not use from API routes.
 */
import { CaptchaProvider, solveCaptcha } from './captcha-solver'

export interface EXAScraperConfig {
  ruc: string
  usuario: string
  password: string
  captchaProvider: CaptchaProvider
  captchaApiKey?: string
}

export interface DeclaracionSRI {
  formulario: string
  periodo: number
  fechaDeclaracion: string
  valorPagado: number
  estado: string
}

export interface RetencionRecibida {
  rucEmisor: string
  nombreEmisor: string
  tipoComprobante: string
  numeroComprobante: string
  baseImponible: number
  impuesto: string
  porcentaje: number
  valorRetenido: number
  periodo: number
}

export interface RetencionEmitida {
  ruc: string
  nombre: string
  tipoComprobante: string
  numeroComprobante: string
  baseImponible: number
  impuesto: string
  porcentaje: number
  valorRetenido: number
  periodo: number
}

import { getChromiumExecutablePath } from './chromium'

async function getChromiumLaunchOptions() {
  let executablePath: string | undefined;
  let args: string[] = ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage', '--disable-web-security'];
  try {
    const mod = await import('@sparticuz/chromium');
    const chromiumServerless = mod.default || mod;
    const execPath = await getChromiumExecutablePath();
    if (execPath) {
      executablePath = execPath;
      args = [...(chromiumServerless.args || []), ...args];
    }
  } catch (e) {}

  return {
    executablePath: executablePath || undefined,
    headless: process.env.HEADLESS !== 'false',
    args,
  };
}

export async function scrapeDeclaracionesEXA(
  config: EXAScraperConfig,
  desdePeriodo: number,
  hastaPeriodo: number,
): Promise<DeclaracionSRI[]> {
  const { chromium } = await import('playwright')
  const launchOpts = await getChromiumLaunchOptions()

  const browser = await chromium.launch(launchOpts)

  try {
    const context = await browser.newContext({ locale: 'es-EC' })
    const page = await context.newPage()

    await page.goto('https://srienlinea.sri.gob.ec/declaraciones', { waitUntil: 'networkidle' })
    await loginSRI(page, config)
    await page.goto('https://srienlinea.sri.gob.ec/declaraciones/consultar', { waitUntil: 'networkidle' })

    await page.fill('#desdePeriodo', String(desdePeriodo))
    await page.fill('#hastaPeriodo', String(hastaPeriodo))
    await page.click('#btnConsultar')
    await page.waitForSelector('#tablaDeclaraciones', { timeout: 20000 })

    return page.evaluate(() => {
      const filas = document.querySelectorAll('#tablaDeclaraciones tbody tr')
      return Array.from(filas).map(fila => {
        const celdas = fila.querySelectorAll('td')
        return {
          formulario: celdas[0]?.textContent?.trim() ?? '',
          periodo: parseInt(celdas[1]?.textContent?.trim() ?? '0', 10),
          fechaDeclaracion: celdas[2]?.textContent?.trim() ?? '',
          valorPagado: parseFloat(celdas[3]?.textContent?.replace(/[^0-9.,]/g, '').replace(',', '.') ?? '0'),
          estado: celdas[4]?.textContent?.trim() ?? '',
        }
      })
    })
  } finally {
    await browser.close()
  }
}

export async function scrapeRetencionesRecibidas(
  config: EXAScraperConfig,
  periodo: number,
): Promise<RetencionRecibida[]> {
  const { chromium } = await import('playwright')

  const launchOpts = await getChromiumLaunchOptions()
  const browser = await chromium.launch(launchOpts)

  try {
    const context = await browser.newContext({ locale: 'es-EC' })
    const page = await context.newPage()

    await page.goto('https://srienlinea.sri.gob.ec/retenciones', { waitUntil: 'networkidle' })
    await loginSRI(page, config)

    await page.goto('https://srienlinea.sri.gob.ec/retenciones/recibidas', { waitUntil: 'networkidle' })

    const periodoStr = String(periodo)
    await page.fill('#periodo', periodoStr)
    await page.click('#btnConsultar')
    await page.waitForSelector('#tablaRetenciones', { timeout: 20000 })

    return page.evaluate(() => {
      const filas = document.querySelectorAll('#tablaRetenciones tbody tr')
      return Array.from(filas).map(fila => {
        const celdas = fila.querySelectorAll('td')
        return {
          rucEmisor: celdas[0]?.textContent?.trim() ?? '',
          nombreEmisor: celdas[1]?.textContent?.trim() ?? '',
          tipoComprobante: celdas[2]?.textContent?.trim() ?? '',
          numeroComprobante: celdas[3]?.textContent?.trim() ?? '',
          baseImponible: parseFloat(celdas[4]?.textContent?.replace(/[^0-9.,]/g, '').replace(',', '.') ?? '0'),
          impuesto: celdas[5]?.textContent?.trim() ?? '',
          porcentaje: parseFloat(celdas[6]?.textContent?.replace('%', '').trim() ?? '0'),
          valorRetenido: parseFloat(celdas[7]?.textContent?.replace(/[^0-9.,]/g, '').replace(',', '.') ?? '0'),
          periodo,
        }
      })
    })
  } finally {
    await browser.close()
  }
}

export async function scrapeRetencionesEmitidas(
  config: EXAScraperConfig,
  periodo: number,
): Promise<RetencionEmitida[]> {
  const { chromium } = await import('playwright')

  const launchOpts = await getChromiumLaunchOptions()
  const browser = await chromium.launch(launchOpts)

  try {
    const context = await browser.newContext({ locale: 'es-EC' })
    const page = await context.newPage()

    await page.goto('https://srienlinea.sri.gob.ec/retenciones', { waitUntil: 'networkidle' })
    await loginSRI(page, config)

    await page.goto('https://srienlinea.sri.gob.ec/retenciones/emitidas', { waitUntil: 'networkidle' })

    const periodoStr = String(periodo)
    await page.fill('#periodo', periodoStr)
    await page.click('#btnConsultar')
    await page.waitForSelector('#tablaRetEmitidas', { timeout: 20000 })

    return page.evaluate(() => {
      const filas = document.querySelectorAll('#tablaRetEmitidas tbody tr')
      return Array.from(filas).map(fila => {
        const celdas = fila.querySelectorAll('td')
        return {
          ruc: celdas[0]?.textContent?.trim() ?? '',
          nombre: celdas[1]?.textContent?.trim() ?? '',
          tipoComprobante: celdas[2]?.textContent?.trim() ?? '',
          numeroComprobante: celdas[3]?.textContent?.trim() ?? '',
          baseImponible: parseFloat(celdas[4]?.textContent?.replace(/[^0-9.,]/g, '').replace(',', '.') ?? '0'),
          impuesto: celdas[5]?.textContent?.trim() ?? '',
          porcentaje: parseFloat(celdas[6]?.textContent?.replace('%', '').trim() ?? '0'),
          valorRetenido: parseFloat(celdas[7]?.textContent?.replace(/[^0-9.,]/g, '').replace(',', '.') ?? '0'),
          periodo,
        }
      })
    })
  } finally {
    await browser.close()
  }
}

async function loginSRI(page: any, config: EXAScraperConfig): Promise<void> {
  await page.fill('#txtRuc', config.ruc)
  await page.fill('#txtUsuario', config.usuario)
  await page.fill('#txtPassword', config.password)

  const captchaImage = await page.locator('#imgCaptcha').screenshot({ type: 'png' })
  const captchaBase64 = captchaImage.toString('base64')

  const captchaText = await solveCaptcha(captchaBase64, {
    provider: config.captchaProvider,
    apiKey: config.captchaApiKey,
  })

  await page.fill('#txtCaptcha', captchaText)
  await page.click('#btnIngresar')
  await page.waitForLoadState('networkidle')
}
