import { db } from './db';

export type SyncModo = 'completo' | 'pendientes' | 'emitidos' | 'recibidos';

export type SyncResult = {
  procesados: number;
  actualizados: number;
  importados: number;
  xmlsGuardados: number;
  errores: number;
  detalle: Array<{
    claveAcceso: string;
    estadoAnterior: string;
    estadoSri: string;
    accion: string;
  }>;
  syncedCount: number;
  modo: SyncModo;
  totalEnPeriodo: number | null;
  fechaDesde: string | null;
  fechaHasta: string | null;
  truncado: boolean;
  warning?: string;
  message?: string;
};

export async function persistSyncResult(tenantId: string, result: SyncResult) {
  const usesPostgres = Boolean(process.env.DATABASE_URL);
  if (usesPostgres) {
    await db.query(
      `INSERT INTO tenant_settings (tenant_id, last_sync_at, last_sync_result, updated_at)
       VALUES ($1, NOW(), $2, NOW())
       ON CONFLICT (tenant_id) DO UPDATE SET last_sync_at = NOW(), last_sync_result = EXCLUDED.last_sync_result, updated_at = NOW()`,
      [tenantId, JSON.stringify(result)]
    );
  } else {
    await db.query(
      `INSERT INTO tenant_settings (tenant_id, last_sync_at, last_sync_result, updated_at)
       VALUES (?, NOW(), ?, NOW())
       ON DUPLICATE KEY UPDATE last_sync_at = NOW(), last_sync_result = VALUES(last_sync_result), updated_at = NOW()`,
      [tenantId, JSON.stringify(result)]
    );
  }
}

export function buildSyncMessage(result: SyncResult): string {
  if (result.warning === 'NO_LOCAL_DOCUMENTS') {
    return 'No hay comprobantes en la base de datos para sincronizar. Emite facturas o importa XML de compras.';
  }

  if (result.warning === 'SRI_UNAVAILABLE') {
    return 'No se pudo conectar con los servidores del SRI (celcer/cel.sri.gob.ec). Verifica tu conexión a internet o firewall.';
  }

  const periodo =
    result.totalEnPeriodo != null
      ? ` del período ${result.fechaDesde || '…'} – ${result.fechaHasta || '…'}`
      : '';

  const base = `Sync ${result.modo}${periodo}: ${result.procesados} consultados`;
  const total =
    result.totalEnPeriodo != null ? ` de ${result.totalEnPeriodo}` : '';
  const stats = `${result.importados} importados, ${result.actualizados} actualizados, ${result.xmlsGuardados} XML guardados`;
  const trunc = result.truncado ? ` (límite ${result.procesados}/${result.totalEnPeriodo})` : '';
  const errs = result.errores > 0 ? `, ${result.errores} errores` : '';

  return `${base}${total}, ${stats}${errs}${trunc}.`;
}
