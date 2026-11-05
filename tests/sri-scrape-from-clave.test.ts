import { describe, it, expect } from 'vitest'
import {
  buildScrapePayloadForClave,
  fechaEmisionFromClave,
  mapClaveTipoToScraperTipo,
  tipoFromClave,
} from '../src/lib/sri-scrape-from-clave'

const CLAVE = '0108202601179001691900120010010000001231234567819'

describe('sri-scrape-from-clave', () => {
  it('extrae fecha y tipo desde la clave', () => {
    expect(fechaEmisionFromClave(CLAVE)).toBe('2026-08-01')
    expect(tipoFromClave(CLAVE)).toBe('01')
    expect(mapClaveTipoToScraperTipo('01')).toBe('1')
    expect(mapClaveTipoToScraperTipo('07')).toBe('6')
  })

  it('arma payload de descarga emitida', () => {
    const payload = buildScrapePayloadForClave({
      claveAcceso: CLAVE,
      rucPortal: '1790016919001',
      esEmitido: true,
    })
    expect(payload).toEqual({
      ruc: '1790016919001',
      fecha_desde: '2026-08-01',
      fecha_hasta: '2026-08-01',
      tipo_comprobante: '1',
      action_type: 'DOWNLOAD_EMITTED',
      options: {
        connection_mode: 'playwright',
        clavesAcceso: [CLAVE],
      },
    })
  })

  it('arma payload de descarga recibida', () => {
    const payload = buildScrapePayloadForClave({
      claveAcceso: CLAVE,
      rucPortal: '0999999999001',
      esEmitido: false,
    })
    expect(payload?.action_type).toBe('DOWNLOAD_RECEIVED')
  })

  it('rechaza claves inválidas', () => {
    expect(
      buildScrapePayloadForClave({
        claveAcceso: '123',
        rucPortal: '1790016919001',
        esEmitido: true,
      })
    ).toBeNull()
  })
})
