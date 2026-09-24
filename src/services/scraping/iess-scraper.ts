import { getChromiumExecutablePath } from './chromium'

export interface IESSScraperConfig {
  /** Cédula o RUC del empleador (campo j_username del portal) */
  ruc: string
  password: string
}

export interface AportacionMensual {
  cedula: string
  nombre: string
  relacionTrabajo: string
  sueldo: number
  diasTrabajados: number
  aportePatronal: number
  aporteIndividual: number
}

const LOGIN_URL = 'https://www.iess.gob.ec/empleador-web/pages/principal.jsf'
const CONSULTA_URL =
  'https://www.iess.gob.ec/empleador-web/pages/consultas/consultaPlanillas.jsf'

const wait = (ms: number) => new Promise((r) => setTimeout(r, ms))

async function getChromiumLaunchOptions() {
  let executablePath: string | undefined
  let args: string[] = [
    '--no-sandbox',
    '--disable-setuid-sandbox',
    '--disable-dev-shm-usage',
    '--disable-web-security',
  ]
  try {
    const mod = await import('@sparticuz/chromium')
    const chromiumServerless = (mod as any).default || mod
    const execPath = await getChromiumExecutablePath()
    if (execPath) {
      executablePath = execPath
      args = [...(chromiumServerless.args || []), ...args]
    }
  } catch {
    /* local chromium */
  }

  return {
    executablePath: executablePath || undefined,
    headless: process.env.HEADLESS !== 'false',
    args,
  }
}

/**
 * Scraper del portal Empleadores IESS (empleador-web).
 * Portado de control-tributario-ec/sri_scraper/run_iess_scrape.js
 * Login: cédula (j_username) + clave (j_password) — sin captcha en este flujo.
 */
export async function scrapePlanillaIESS(
  config: IESSScraperConfig,
  periodo: number,
): Promise<AportacionMensual[]> {
  const cedula = String(config.ruc || '').trim()
  const password = String(config.password || '')
  if (!cedula || !password) {
    throw new Error('Cédula/RUC y contraseña del IESS son obligatorios.')
  }

  const periodoStr = String(periodo)
  if (!/^\d{6}$/.test(periodoStr)) {
    throw new Error('Periodo inválido. Use formato YYYYMM.')
  }
  const anio = periodoStr.substring(0, 4)
  const mes = periodoStr.substring(4, 6)
  const periodoDesde = `${anio}-${mes}`
  const periodoHasta = periodoDesde

  const { chromium } = await import('playwright')
  const launchOpts = await getChromiumLaunchOptions()
  const browser = await chromium.launch(launchOpts)

  try {
    const context = await browser.newContext({
      locale: 'es-EC',
      acceptDownloads: true,
    })
    const page = await context.newPage()

    // --- Login ---
    await page.goto(LOGIN_URL, { waitUntil: 'domcontentloaded', timeout: 60000 })
    await wait(400)

    // Cerrar sesión previa si hay botón Salir
    const hasSalir = await page.evaluate(() => {
      const links = Array.from(
        document.querySelectorAll('a, button, input[type="button"], input[type="submit"]'),
      )
      return links.some(
        (el) => ((el as HTMLElement).innerText || (el as HTMLInputElement).value || '')
          .trim()
          .toUpperCase() === 'SALIR',
      )
    })
    if (hasSalir) {
      await page.evaluate(() => {
        const links = Array.from(
          document.querySelectorAll('a, button, input[type="button"], input[type="submit"]'),
        )
        const btn = links.find(
          (el) =>
            ((el as HTMLElement).innerText || (el as HTMLInputElement).value || '')
              .trim()
              .toUpperCase() === 'SALIR',
        )
        if (btn) (btn as HTMLElement).click()
      })
      await wait(2500)
    }

    const cedulaSelector =
      'input[name="j_username"], input[id*="cedula" i], input[id*="username" i], input[id*="usuario" i]'
    await page.waitForSelector(cedulaSelector, { timeout: 20000 }).catch(() => null)
    const cedulaInput = await page.$(cedulaSelector)
    if (!cedulaInput) {
      throw new Error('No se encontró el campo de cédula en el login del IESS.')
    }
    await cedulaInput.click({ clickCount: 3 }).catch(() => {})
    await page.keyboard.type(cedula, { delay: 15 })

    const claveSelector =
      'input[name="j_password"], input[id*="clave" i], input[id*="password" i], input[type="password"]'
    const claveInput = await page.$(claveSelector)
    if (!claveInput) {
      throw new Error('No se encontró el campo de contraseña en el login del IESS.')
    }
    await claveInput.click({ clickCount: 3 }).catch(() => {})
    await page.keyboard.type(password, { delay: 15 })

    const btnSelectors = [
      'input[value="Ingresar"]',
      'button:has-text("Ingresar")',
      'input[type="submit"]',
      'button[type="submit"]',
      'a:has-text("Ingresar")',
    ]
    let clicked = false
    for (const sel of btnSelectors) {
      const btn = await page.$(sel).catch(() => null)
      if (btn) {
        await btn.click().catch(() => {})
        clicked = true
        break
      }
    }
    if (!clicked) await page.keyboard.press('Enter')

    let loggedIn = false
    for (let i = 0; i < 60; i++) {
      await wait(500)
      const bodyText = await page
        .evaluate(() => (document.body?.innerText || '').toUpperCase())
        .catch(() => '')
      if (
        bodyText.includes('SEÑOR EMPLEADOR') ||
        bodyText.includes('SE\u00d1OR EMPLEADOR') ||
        bodyText.includes('BIENVENIDO') ||
        bodyText.includes('PLANILLAS') ||
        (page.url().includes('principal') && !page.url().toLowerCase().includes('login'))
      ) {
        loggedIn = true
        break
      }
      if (
        bodyText.includes('CLAVE INCORRECTA') ||
        bodyText.includes('USUARIO NO EXISTE') ||
        (bodyText.includes('CREDENCIAL') && bodyText.includes('ERROR'))
      ) {
        throw new Error('Credenciales incorrectas. Verifique la cédula/RUC y clave del IESS.')
      }
    }
    if (!loggedIn) {
      const url = page.url()
      if (url.includes('principal') || url.includes('employer') || url.includes('empleador')) {
        loggedIn = true
      } else {
        throw new Error(
          'No se pudo verificar el inicio de sesión en el IESS. Revise credenciales o el estado del portal.',
        )
      }
    }

    // --- Consulta de planillas ---
    await page.goto(CONSULTA_URL, {
      waitUntil: 'domcontentloaded',
      timeout: 60000,
    })
    await wait(800)

    for (let i = 0; i < 40; i++) {
      const bodyText = await page
        .evaluate(() => (document.body?.innerText || '').toUpperCase())
        .catch(() => '')
      if (
        bodyText.includes('CONSULTA DE PLANILLAS') ||
        bodyText.includes('ALCANCE') ||
        bodyText.includes('CRITERIOS')
      ) {
        break
      }
      await wait(300)
    }

    // Alcance = Consolidado
    await page.evaluate(() => {
      const allOpts = Array.from(document.querySelectorAll('option, input[type="radio"]'))
      for (const opt of allOpts) {
        const txt = (
          (opt as HTMLOptionElement).innerText ||
          (opt as HTMLInputElement).value ||
          ''
        ).toUpperCase()
        if (!txt.includes('CONSOLIDADO')) continue
        if (opt.tagName === 'OPTION') {
          const sel = (opt as HTMLOptionElement).parentElement as HTMLSelectElement | null
          if (sel) {
            sel.value = (opt as HTMLOptionElement).value
            sel.dispatchEvent(new Event('change', { bubbles: true }))
          }
          return
        }
        ;(opt as HTMLInputElement).click()
        return
      }
    })
    await wait(2500)

    // Periodo Desde / Hasta
    await page.evaluate(
      ({ desde, hasta }) => {
        const inputs = Array.from(
          document.querySelectorAll('input[type="text"], input:not([type])'),
        ).filter(
          (el) =>
            (el as HTMLElement).offsetParent !== null &&
            !(el as HTMLInputElement).disabled &&
            !(el as HTMLInputElement).readOnly,
        ) as HTMLInputElement[]
        if (inputs.length < 2) return
        const desdeInp = inputs[inputs.length - 2]
        const hastaInp = inputs[inputs.length - 1]
        for (const [inp, val] of [
          [desdeInp, desde],
          [hastaInp, hasta],
        ] as const) {
          inp.focus()
          inp.value = val
          inp.dispatchEvent(new Event('input', { bubbles: true }))
          inp.dispatchEvent(new Event('change', { bubbles: true }))
        }
      },
      { desde: periodoDesde, hasta: periodoHasta },
    )
    await wait(800)

    // Aceptar / Consultar
    const aceptar = await page.evaluate(() => {
      const btns = Array.from(
        document.querySelectorAll('input[type="submit"], input[type="button"], button, a'),
      )
      const btn = btns.find((b) => {
        const t = (
          (b as HTMLElement).innerText ||
          (b as HTMLInputElement).value ||
          ''
        )
          .trim()
          .toUpperCase()
        return t === 'ACEPTAR' || t === 'CONSULTAR' || t === 'BUSCAR'
      })
      if (btn) {
        ;(btn as HTMLElement).click()
        return true
      }
      return false
    })
    if (!aceptar) {
      await page.locator('text=Aceptar').first().click().catch(() => {})
      await page.locator('text=Consultar').first().click().catch(() => {})
    }

    // Esperar fin de loading + tabla
    for (let i = 0; i < 120; i++) {
      await wait(250)
      const loading = await page
        .evaluate(() => {
          const text = document.body?.innerText?.toUpperCase() || ''
          return (
            text.includes('POR FAVOR ESPERE') || text.includes('PROCESANDO')
          )
        })
        .catch(() => false)
      if (!loading) break
    }

    let tablaOk = false
    for (let i = 0; i < 80; i++) {
      const hay = await page
        .evaluate(() => {
          const text = (document.body?.innerText || '').toUpperCase()
          if (text.includes('NO EXISTEN REGISTROS')) return 'empty'
          const rows = document.querySelectorAll(
            'table tbody tr, .ui-datatable tbody tr',
          )
          return rows.length > 0 ? 'ok' : 'wait'
        })
        .catch(() => 'wait')
      if (hay === 'ok') {
        tablaOk = true
        break
      }
      if (hay === 'empty') {
        return []
      }
      await wait(300)
    }

    if (!tablaOk) {
      throw new Error(
        `No se encontró la tabla de planillas para ${periodoDesde}. Verifique el período o descargue manualmente desde el portal.`,
      )
    }

    const resultados: AportacionMensual[] = await page.evaluate(() => {
      const parseNum = (raw: string) => {
        const cleaned = raw.replace(/[^0-9.,-]/g, '').trim()
        if (!cleaned) return 0
        if (cleaned.includes(',') && cleaned.includes('.')) {
          return parseFloat(cleaned.replace(/\./g, '').replace(',', '.')) || 0
        }
        if (cleaned.includes(',')) return parseFloat(cleaned.replace(',', '.')) || 0
        return parseFloat(cleaned) || 0
      }

      const rows = Array.from(
        document.querySelectorAll('table tbody tr, .ui-datatable tbody tr'),
      )
      const out: {
        cedula: string
        nombre: string
        relacionTrabajo: string
        sueldo: number
        diasTrabajados: number
        aportePatronal: number
        aporteIndividual: number
      }[] = []

      for (const fila of rows) {
        const celdas = Array.from(fila.querySelectorAll('td')).map((td) =>
          (td.textContent || '').trim(),
        )
        if (celdas.length < 3) continue

        // Buscar cédula (10 dígitos) en alguna celda
        let cedulaIdx = celdas.findIndex((c) => /^\d{10}(\d{3})?$/.test(c.replace(/\s/g, '')))
        if (cedulaIdx < 0) continue
        const cedula = celdas[cedulaIdx].replace(/\s/g, '')
        const nombre = celdas[cedulaIdx + 1] || celdas[1] || ''

        // Montos: tomar números de las celdas restantes
        const nums = celdas
          .slice(cedulaIdx + 2)
          .map(parseNum)
          .filter((n) => !Number.isNaN(n))

        // Heurística típica planilla: sueldo + aportes
        const sueldo = nums[0] ?? 0
        const diasTrabajados = nums.find((n) => n > 0 && n <= 31) ?? 30
        const aportePatronal = nums.length >= 3 ? nums[nums.length - 2] : 0
        const aporteIndividual = nums.length >= 2 ? nums[nums.length - 1] : 0

        if (!cedula || (!sueldo && !nombre)) continue
        // Saltar filas de totales
        if (/TOTAL/i.test(nombre) || /TOTAL/i.test(cedula)) continue

        out.push({
          cedula: cedula.slice(0, 10),
          nombre,
          relacionTrabajo: '',
          sueldo,
          diasTrabajados: diasTrabajados > 0 && diasTrabajados <= 31 ? diasTrabajados : 30,
          aportePatronal,
          aporteIndividual,
        })
      }
      return out
    })

    // Deduplicar por cédula
    const byCedula = new Map<string, AportacionMensual>()
    for (const row of resultados) {
      if (!row.cedula) continue
      const prev = byCedula.get(row.cedula)
      if (!prev || row.sueldo > prev.sueldo) byCedula.set(row.cedula, row)
    }

    return Array.from(byCedula.values())
  } finally {
    await browser.close().catch(() => {})
  }
}
