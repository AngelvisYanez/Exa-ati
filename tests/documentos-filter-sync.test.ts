import { describe, expect, it } from 'vitest'
import {
  DOCUMENTOS_FILTER_SOURCE,
  buildFilterScrapePayload,
  isDocumentosFilterJob,
  jobDateKey,
  planDocumentosFilterSync,
  scrapeTargetForView,
  shouldSyncDocumentosFilter,
  type FilterScrapeJob,
} from '@/lib/documentos-filter-sync'

const RUC = '1790016919001'
const FILTER_OPTIONS = { connection_mode: 'playwright', source: DOCUMENTOS_FILTER_SOURCE }

function job(over: Partial<FilterScrapeJob> = {}): FilterScrapeJob {
  return {
    id: 1,
    ruc: RUC,
    fecha_desde: '2026-09-01',
    fecha_hasta: '2026-09-30',
    tipo_comprobante: 'todos',
    action_type: 'DOWNLOAD_BOTH',
    status: 'PENDING',
    options: FILTER_OPTIONS,
    ...over,
  }
}

describe('shouldSyncDocumentosFilter', () => {
  it('exige ambas fechas y un rango válido', () => {
    expect(shouldSyncDocumentosFilter('', '')).toBe(false)
    expect(shouldSyncDocumentosFilter('2026-09-01', '')).toBe(false)
    expect(shouldSyncDocumentosFilter('2026-09-30', '2026-09-01')).toBe(false)
    expect(shouldSyncDocumentosFilter('2026-09-01', '2026-09-30')).toBe(true)
    expect(shouldSyncDocumentosFilter('2026-09-01', '2026-09-01')).toBe(true)
  })
})

describe('scrapeTargetForView', () => {
  it('mapea la pestaña al action del portal', () => {
    expect(scrapeTargetForView('emitidos')).toEqual({
      action_type: 'DOWNLOAD_EMITTED',
      tipo_comprobante: 'todos',
    })
    expect(scrapeTargetForView('recibidos')).toEqual({
      action_type: 'DOWNLOAD_RECEIVED',
      tipo_comprobante: 'todos',
    })
    expect(scrapeTargetForView('retenciones')).toEqual({
      action_type: 'SCRAPE_RETENCIONES',
      tipo_comprobante: '6',
    })
    expect(scrapeTargetForView('todos')).toEqual({
      action_type: 'DOWNLOAD_BOTH',
      tipo_comprobante: 'todos',
    })
  })
})

describe('buildFilterScrapePayload', () => {
  it('marca el job para poder cancelarlo al cambiar el filtro', () => {
    expect(buildFilterScrapePayload({
      ruc: RUC,
      from: '2026-09-01',
      to: '2026-09-30',
      view: 'recibidos',
    })).toEqual({
      ruc: RUC,
      fecha_desde: '2026-09-01',
      fecha_hasta: '2026-09-30',
      tipo_comprobante: 'todos',
      action_type: 'DOWNLOAD_RECEIVED',
      options: FILTER_OPTIONS,
    })
  })

  it('las retenciones piden solo el tipo 6', () => {
    const payload = buildFilterScrapePayload({
      ruc: RUC,
      from: '2026-01-01',
      to: '2026-12-31',
      view: 'retenciones',
    })
    expect(payload.action_type).toBe('SCRAPE_RETENCIONES')
    expect(payload.tipo_comprobante).toBe('6')
    expect(payload.options.source).toBe('documentos-filter')
  })
})

describe('planDocumentosFilterSync', () => {
  const params = {
    ruc: RUC,
    from: '2026-09-01',
    to: '2026-09-30',
    view: 'todos' as const,
  }

  it('no duplica un job de filtro igual que ya está en curso', () => {
    const plan = planDocumentosFilterSync([
      job({ fecha_desde: '2026-09-01T00:00:00.000Z', status: 'PROCESSING' }),
    ], params)
    expect(plan).toEqual({ enqueue: false, cancelIds: [] })
  })

  it('al cambiar el filtro cancela el job anterior y encola el nuevo', () => {
    const plan = planDocumentosFilterSync([
      job({ id: 8, action_type: 'DOWNLOAD_EMITTED', status: 'PROCESSING' }),
    ], params)
    expect(plan).toEqual({ enqueue: true, cancelIds: ['8'] })
  })

  it('no cancela la descarga de una sola clave ni jobs ya terminados', () => {
    const plan = planDocumentosFilterSync([
      job({
        id: 3,
        status: 'PROCESSING',
        options: { connection_mode: 'playwright', clavesAcceso: ['0108202601179001691900120010010000001231234567819'] },
      }),
      job({ id: 4, status: 'COMPLETED' }),
      job({ id: 5, status: 'CANCELLED', action_type: 'DOWNLOAD_RECEIVED' }),
    ], params)
    expect(plan).toEqual({ enqueue: true, cancelIds: [] })
  })

  it('reconoce options guardadas como texto y fechas ISO', () => {
    expect(jobDateKey('2026-09-01T05:00:00.000Z')).toBe('2026-09-01')
    expect(jobDateKey(null)).toBe('')
    expect(isDocumentosFilterJob(JSON.stringify(FILTER_OPTIONS))).toBe(true)
    expect(isDocumentosFilterJob('no-json')).toBe(false)
    expect(isDocumentosFilterJob({ clavesAcceso: ['x'] })).toBe(false)

    const plan = planDocumentosFilterSync([
      job({
        id: 12,
        options: JSON.stringify(FILTER_OPTIONS),
        fecha_desde: '2026-08-01T00:00:00.000Z',
        fecha_hasta: '2026-08-31',
      }),
    ], params)
    expect(plan.cancelIds).toEqual(['12'])
    expect(plan.enqueue).toBe(true)
  })
})
