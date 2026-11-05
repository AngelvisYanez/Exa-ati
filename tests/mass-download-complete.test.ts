import { describe, expect, it } from 'vitest'
import {
  isMassDownloadFullySynced,
  type MassDownloadSummary,
} from '@/services/scraping/sri-playwright-scraper'

function base(over: Partial<MassDownloadSummary> = {}): MassDownloadSummary {
  return {
    found: 0,
    xmls: 0,
    pdfs: 0,
    xmlsExist: 0,
    pdfsExist: 0,
    xmlsSynced: 0,
    xmlsFailed: 0,
    targetsExpected: null,
    targetsMissing: 0,
    missingClaves: [],
    ...over,
  }
}

describe('isMassDownloadFullySynced', () => {
  it('COMPLETED masivo solo si todos los encontrados tienen XML en sistema', () => {
    expect(isMassDownloadFullySynced(base({ found: 3, xmlsSynced: 3 }))).toBe(true)
    expect(isMassDownloadFullySynced(base({ found: 3, xmlsSynced: 2, xmlsFailed: 1 }))).toBe(false)
    expect(isMassDownloadFullySynced(base({ found: 0 }))).toBe(true)
  })

  it('COMPLETED puntual solo si todas las claves objetivo quedaron en sistema', () => {
    expect(
      isMassDownloadFullySynced(
        base({ found: 1, xmlsSynced: 1, targetsExpected: 1, targetsMissing: 0 }),
      ),
    ).toBe(true)
    expect(
      isMassDownloadFullySynced(
        base({
          found: 1,
          xmlsSynced: 0,
          xmlsFailed: 1,
          targetsExpected: 1,
          targetsMissing: 0,
        }),
      ),
    ).toBe(false)
    expect(
      isMassDownloadFullySynced(
        base({
          found: 0,
          xmlsSynced: 0,
          xmlsFailed: 1,
          targetsExpected: 1,
          targetsMissing: 1,
          missingClaves: ['x'.repeat(49)],
        }),
      ),
    ).toBe(false)
  })
})
