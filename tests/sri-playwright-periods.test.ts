import { describe, it, expect } from 'vitest';
import {
  parseJobCalendarDate,
  lastDayOfMonth,
  buildSearchPeriods,
} from '../src/services/scraping/sri-playwright-scraper';

describe('parseJobCalendarDate', () => {
  it('parsea YYYY-MM-DD sin shift de zona horaria', () => {
    expect(parseJobCalendarDate('2026-03-01')).toEqual({ year: 2026, month: 3, day: 1 });
    expect(parseJobCalendarDate('2026-03-31')).toEqual({ year: 2026, month: 3, day: 31 });
  });

  it('usa componentes UTC de Date (DATE como midnight UTC)', () => {
    expect(parseJobCalendarDate(new Date('2026-03-01T00:00:00.000Z'))).toEqual({
      year: 2026,
      month: 3,
      day: 1,
    });
  });
});

describe('buildSearchPeriods', () => {
  it('recibidos + mes completo → un período con day=0 (Todos)', () => {
    const start = { year: 2026, month: 3, day: 1 };
    const end = { year: 2026, month: 3, day: lastDayOfMonth(2026, 3) };
    expect(buildSearchPeriods(start, end, 'recibidos')).toEqual([
      { year: 2026, month: 3, day: 0 },
    ]);
  });

  it('emitidos + mes completo → un día por cada día del mes', () => {
    const start = { year: 2026, month: 2, day: 1 };
    const end = { year: 2026, month: 2, day: lastDayOfMonth(2026, 2) };
    const periods = buildSearchPeriods(start, end, 'emitidos');
    expect(periods).toHaveLength(28);
    expect(periods[0]).toEqual({ year: 2026, month: 2, day: 1 });
    expect(periods[27]).toEqual({ year: 2026, month: 2, day: 28 });
  });

  it('rango parcial → día a día', () => {
    const periods = buildSearchPeriods(
      { year: 2026, month: 3, day: 10 },
      { year: 2026, month: 3, day: 12 },
      'recibidos',
    );
    expect(periods).toEqual([
      { year: 2026, month: 3, day: 10 },
      { year: 2026, month: 3, day: 11 },
      { year: 2026, month: 3, day: 12 },
    ]);
  });
});
