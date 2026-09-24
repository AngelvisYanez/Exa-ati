import { NextRequest, NextResponse } from 'next/server'
import { verifyAuth, requireTenantId } from '@/services/sri-api/auth-helper'
import { scrapePlanillaIESS } from '@/services/scraping/iess-scraper'
import { SriPlaywrightScraper } from '@/services/scraping/sri-playwright-scraper'
import { scrapeDeclaracionesPresentadas } from '@/services/scraping/sri-playwright-declaraciones'
import { upsertPlanilla } from '@/services/control-tributario/services/planillas.service'
import { recalcularPeriodoDesdeComprobantes } from '@/services/control-tributario/services/mensual.service'
import { periodoToDateRange } from '@/services/scraping/sri-scrape-actions'
import { encryption } from '@/services/sri-api/encryption'
import { db } from '@/services/sri-api/db'

function normalizePeriodo(periodo: unknown): number | null {
  if (periodo == null || periodo === '') return null
  const s = String(periodo).replace(/-/g, '')
  if (!/^\d{6}$/.test(s)) return null
  const month = parseInt(s.substring(4, 6), 10)
  if (month < 1 || month > 12) return null
  return parseInt(s, 10)
}

async function resolveClave(ruc: string, password?: string): Promise<string | null> {
  if (password) return password
  const emisor = await db.queryOne<any>(
    'SELECT clave_sri_encrypted FROM emisores WHERE ruc = $1 AND activo = true',
    [ruc]
  )
  if (!emisor?.clave_sri_encrypted) return null
  try {
    return await encryption.decrypt(emisor.clave_sri_encrypted)
  } catch {
    return emisor.clave_sri_encrypted
  }
}

export async function POST(req: NextRequest) {
  let scraper: SriPlaywrightScraper | null = null
  try {
    const user = await verifyAuth(req)
    const tenantId = requireTenantId(user)
    const body = await req.json()
    const { fuente, ruc, usuario, password } = body
    const periodo = normalizePeriodo(body.periodo)

    if (!fuente || !periodo) {
      return NextResponse.json(
        { message: 'fuente y periodo (YYYYMM) requeridos' },
        { status: 400 },
      )
    }

    const results: any[] = []
    const errores: string[] = []

    const idEmpleador = String(ruc || usuario || '').trim()
    if (!idEmpleador) {
      return NextResponse.json(
        {
          message:
            fuente === 'IESS'
              ? 'Cédula o RUC del empleador IESS requerido'
              : 'ruc requerido para scraping',
        },
        { status: 400 },
      )
    }

    if (fuente === 'IESS') {
      const clave = String(password || '')
      if (!clave) {
        return NextResponse.json(
          { message: 'Contraseña del portal IESS requerida' },
          { status: 400 },
        )
      }

      const aportaciones = await scrapePlanillaIESS(
        { ruc: idEmpleador, password: clave },
        periodo,
      )

      for (const emp of aportaciones) {
        await upsertPlanilla(tenantId, periodo, {
          cedula: emp.cedula,
          nombreCompleto: emp.nombre,
          sueldo: emp.sueldo,
          diasTrabajados: emp.diasTrabajados,
        })
      }

      results.push({
        tipo: 'IESS',
        registros: aportaciones.length,
        persistido: true,
      })
    }

    if (fuente === 'SRI' || fuente === 'EXA') {
      const claveSri = await resolveClave(idEmpleador, password)
      if (!claveSri) {
        return NextResponse.json(
          { message: 'Contraseña SRI requerida (body.password o emisor con clave vinculada)' },
          { status: 400 },
        )
      }

      const { fecha_desde, fecha_hasta } = periodoToDateRange(periodo)
      const noopProgress = async () => {}

      scraper = new SriPlaywrightScraper()
      await scraper.init()
      const ok = await scraper.login(idEmpleador, claveSri, async (m) => {
        console.log('[CT Scrapear]', m)
      })
      if (!ok) {
        return NextResponse.json(
          { message: 'No se pudo iniciar sesión en el portal SRI' },
          { status: 500 },
        )
      }

      const wantRet =
        body.retencionesRecibidas !== false ||
        body.retencionesEmitidas !== false ||
        body.retenciones === true
      const wantDecl = body.declaraciones !== false

      if (wantRet) {
        try {
          const retJob = {
            id: `ct-ret-${periodo}`,
            ruc: idEmpleador,
            tenant_id: tenantId,
            fecha_desde,
            fecha_hasta,
            tipo_comprobante: '6',
          }
          if (body.retencionesRecibidas !== false) {
            await scraper.runMassDownload(retJob, noopProgress as any, 'recibidos')
          }
          if (body.retencionesEmitidas !== false) {
            await scraper.runMassDownload(retJob, noopProgress as any, 'emitidos')
          }
          results.push({
            tipo: 'RETENCIONES',
            registros: 1,
            persistido: true,
            detalle: 'Comprobantes tipo 6 descargados vía Playwright',
          })
        } catch (e: any) {
          errores.push(`Retenciones: ${e.message}`)
        }
      }

      if (wantDecl) {
        try {
          const page = scraper.getPage()
          if (!page) throw new Error('Página no disponible')
          const declaraciones = await scrapeDeclaracionesPresentadas({
            page,
            tenantId,
            ruc: idEmpleador,
            log: async (m) => console.log('[CT Decl]', m),
            periodo,
          })
          results.push({
            tipo: 'DECLARACIONES',
            registros: declaraciones.length,
            persistido: declaraciones.length > 0,
          })
        } catch (e: any) {
          errores.push(`Declaraciones: ${e.message}`)
        }
      }
    }

    if (periodo && idEmpleador) {
      await recalcularPeriodoDesdeComprobantes(tenantId, idEmpleador, periodo).catch((e) => {
        console.warn('[Scrapear] Recalculación post-scraping falló:', e.message)
      })
    }

    return NextResponse.json({
      success: true,
      results,
      errores: errores.length > 0 ? errores : undefined,
    })
  } catch (error: any) {
    const isBrowserError =
      error.message?.includes('Executable') ||
      error.message?.includes('Playwright') ||
      error.message?.includes('npx playwright install')
    const msg = isBrowserError
      ? 'El scraper con navegador headless requiere configurar SCRAPELESS_API_KEY o instalar Chromium binario en el servidor.'
      : error.message || 'Error al ejecutar scraper'

    return NextResponse.json({ message: msg, details: error.message }, { status: 500 })
  } finally {
    if (scraper) await scraper.close().catch(() => {})
  }
}
