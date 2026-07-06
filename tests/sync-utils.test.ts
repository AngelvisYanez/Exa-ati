import { describe, it, expect } from 'vitest';
import { buildSyncMessage } from '../src/lib/sri-api/sync-utils';

describe('buildSyncMessage', () => {
  const baseResult = {
    procesados: 100,
    actualizados: 30,
    importados: 20,
    xmlsGuardados: 15,
    errores: 0,
    detalle: [],
    syncedCount: 50,
    modo: 'completo' as const,
    totalEnPeriodo: null,
    fechaDesde: null,
    fechaHasta: null,
    truncado: false,
  };

  it('mensaje normal sin totalEnPeriodo', () => {
    const msg = buildSyncMessage(baseResult);
    expect(msg).toContain('100 consultados');
    expect(msg).toContain('20 importados');
    expect(msg).toContain('30 actualizados');
    expect(msg).toContain('15 XML guardados');
  });

  it('incluye total del período cuando existe', () => {
    const msg = buildSyncMessage({ ...baseResult, totalEnPeriodo: 200, fechaDesde: '2026-01-01', fechaHasta: '2026-01-31' });
    expect(msg).toContain('200');
    expect(msg).toContain('2026-01-01');
    expect(msg).toContain('2026-01-31');
  });

  it('señala truncado cuando aplica', () => {
    const msg = buildSyncMessage({ ...baseResult, truncado: true, totalEnPeriodo: 500 });
    expect(msg).toContain('límite');
    expect(msg).toContain('500');
  });

  it('incluye errores si > 0', () => {
    const msg = buildSyncMessage({ ...baseResult, errores: 5 });
    expect(msg).toContain('5 errores');
  });

  it('no incluye errores si es 0', () => {
    const msg = buildSyncMessage(baseResult);
    expect(msg).not.toContain('errores');
  });

  it('mensaje para NO_LOCAL_DOCUMENTS', () => {
    const msg = buildSyncMessage({ ...baseResult, warning: 'NO_LOCAL_DOCUMENTS' });
    expect(msg).toBe('No hay comprobantes en la base de datos para sincronizar. Emite facturas o importa XML de compras.');
  });

  it('mensaje para SRI_UNAVAILABLE', () => {
    const msg = buildSyncMessage({ ...baseResult, warning: 'SRI_UNAVAILABLE' });
    expect(msg).toContain('No se pudo conectar con los servidores del SRI');
  });

  it('incluye modo en el mensaje', () => {
    const msg = buildSyncMessage({ ...baseResult, modo: 'recibidos' });
    expect(msg).toContain('recibidos');
  });
});
