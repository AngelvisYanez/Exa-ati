import { db } from './db';
import { sriSoapClient } from './sri-soap-client';
import {
  parseXmlComprobante,
  saveAutorizadoXml,
  upsertComprobanteFromParsed,
} from './comprobante-importer';
import { buildSyncMessage, type SyncModo } from './sync-utils';

const PENDING_STATES = ['PENDIENTE', 'FIRMADO', 'EN PROCESO', 'EN_PROCESO', 'DEVUELTA', 'ENVIADO', 'RECHAZADO'];
const DELAY_MS = parseInt(process.env.SRI_REQUEST_DELAY_MS || '150', 10);
const BATCH_SIZE = 50;
const MAX_LIMIT = parseInt(process.env.SRI_SYNC_MAX_LIMIT || '500', 10);
const MAX_PERIOD_SYNC = parseInt(process.env.SRI_SYNC_PERIOD_MAX || '2000', 10);

function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function extractRuc(claveAcceso: string): string {
  return claveAcceso.substring(10, 23);
}

export type SyncOptions = {
  estados?: string[];
  limite?: number;
  reintentar?: boolean;
  fechaDesde?: string;
  fechaHasta?: string;
  modo?: 'completo' | 'pendientes' | 'emitidos' | 'recibidos';
  clavesAcceso?: string[];
};

type SyncDetalle = {
  claveAcceso: string;
  estadoAnterior: string;
  estadoSri: string;
  accion: string;
};

function buildSyncQueryParts(tenantId: string, userRuc: string, options: SyncOptions) {
  const conditions = ['(c.tenant_id = ? OR c.receptor_identificacion = ? OR c.emisor_ruc = ?)'];
  const params: (string | number)[] = [tenantId, userRuc, userRuc];

  const modo = options.modo || 'completo';
  if (modo === 'emitidos') {
    conditions.push('c.emisor_ruc = ?');
    params.push(userRuc);
  } else if (modo === 'recibidos') {
    conditions.push('c.receptor_identificacion = ?');
    conditions.push('(c.emisor_ruc IS NULL OR c.emisor_ruc != ?)');
    params.push(userRuc, userRuc);
  } else if (modo === 'pendientes') {
    const estados = options.estados || PENDING_STATES;
    conditions.push(`c.estado IN (${estados.map(() => '?').join(', ')})`);
    params.push(...estados);
  } else if (options.estados?.length) {
    conditions.push(`c.estado IN (${options.estados.map(() => '?').join(', ')})`);
    params.push(...options.estados);
  } else {
    // Evitar re-consultar comprobantes ya autorizados con XML guardado
    conditions.push(`NOT (c.estado = 'AUTORIZADO' AND cx.id IS NOT NULL)`);
  }

  if (options.fechaDesde) {
    conditions.push('c.fecha_emision >= ?');
    params.push(options.fechaDesde);
  }
  if (options.fechaHasta) {
    conditions.push('c.fecha_emision <= ?');
    params.push(options.fechaHasta);
  }

  return { conditions, params };
}

function hasPeriodFilter(options: SyncOptions): boolean {
  return Boolean(options.fechaDesde || options.fechaHasta);
}

async function countComprobantesForSync(
  tenantId: string,
  userRuc: string,
  options: SyncOptions
): Promise<number> {
  const { conditions, params } = buildSyncQueryParts(tenantId, userRuc, options);
  const row = await db.queryOne<{ total: number }>(
    `SELECT COUNT(*) AS total
     FROM comprobantes c
     LEFT JOIN comprobante_xmls cx ON cx.comprobante_id = c.id AND cx.tipo = 'autorizado'
     WHERE ${conditions.join(' AND ')}`,
    params
  );
  return row?.total ?? 0;
}

async function fetchAllComprobantesForSync(
  tenantId: string,
  userRuc: string,
  options: SyncOptions,
  maxRows: number
) {
  const { conditions, params } = buildSyncQueryParts(tenantId, userRuc, options);
  const modo = options.modo || 'completo';
  const orderBy = hasPeriodFilter(options)
    ? 'c.fecha_emision ASC, c.secuencial ASC, c.id ASC'
    : modo === 'pendientes'
      ? 'c.updated_at ASC, c.id ASC'
      : '(cx.id IS NULL) DESC, CASE c.estado WHEN \'PENDIENTE\' THEN 1 WHEN \'FIRMADO\' THEN 2 WHEN \'ENVIADO\' THEN 3 WHEN \'DEVUELTA\' THEN 4 ELSE 5 END, c.updated_at ASC, c.id ASC';

  return db.queryAll<any>(
    `SELECT c.id, c.clave_acceso, c.secuencial, c.tipo, c.estado, c.fecha_emision, c.emisor_ruc,
            cx.id AS tiene_xml
     FROM comprobantes c
     LEFT JOIN comprobante_xmls cx ON cx.comprobante_id = c.id AND cx.tipo = 'autorizado'
     WHERE ${conditions.join(' AND ')}
     ORDER BY ${orderBy}
     LIMIT ?`,
    [...params, maxRows]
  );
}

async function fetchComprobantesBatch(
  tenantId: string,
  userRuc: string,
  options: SyncOptions,
  offset: number,
  batchLimit: number
) {
  const { conditions, params } = buildSyncQueryParts(tenantId, userRuc, options);
  params.push(batchLimit, offset);

  return db.queryAll<any>(
    `SELECT c.id, c.clave_acceso, c.secuencial, c.tipo, c.estado, c.fecha_emision, c.emisor_ruc,
            cx.id AS tiene_xml
     FROM comprobantes c
     LEFT JOIN comprobante_xmls cx ON cx.comprobante_id = c.id AND cx.tipo = 'autorizado'
     WHERE ${conditions.join(' AND ')}
     ORDER BY (cx.id IS NULL) DESC, CASE c.estado WHEN 'PENDIENTE' THEN 1 WHEN 'FIRMADO' THEN 2 WHEN 'ENVIADO' THEN 3 WHEN 'DEVUELTA' THEN 4 ELSE 5 END, c.updated_at ASC, c.id ASC
     LIMIT ? OFFSET ?`,
    params
  );
}

async function procesarComprobanteSri(
  comp: any,
  tenantId: string,
  userRuc: string
): Promise<{ detalle: SyncDetalle; actualizado: boolean; importado: boolean; xmlGuardado: boolean }> {
  const estadoAnterior = comp.estado;
  let actualizado = false;
  let importado = false;
  let xmlGuardado = false;

  const respuestaSri = await sriSoapClient.autorizarComprobante(comp.clave_acceso);
  let estadoSri = 'NO EXISTE';
  let accion = 'SIN_CAMBIOS';

  if (respuestaSri.autorizaciones?.autorizacion) {
    const auth = Array.isArray(respuestaSri.autorizaciones.autorizacion)
      ? respuestaSri.autorizaciones.autorizacion[0]
      : respuestaSri.autorizaciones.autorizacion;

    estadoSri = auth.estado || 'DESCONOCIDO';

    if (auth.estado === 'AUTORIZADO') {
      let comprobanteId = comp.id;

      if (auth.comprobante) {
        try {
          const parsed = await parseXmlComprobante(
            typeof auth.comprobante === 'string' ? auth.comprobante : String(auth.comprobante)
          );
          const upsert = await upsertComprobanteFromParsed(parsed, tenantId, userRuc, {
            estado: auth.estado,
            fechaAutorizacion: auth.fechaAutorizacion,
            numeroAutorizacion: auth.numeroAutorizacion,
          });
          comprobanteId = upsert.id;
          if (upsert.action === 'importado') importado = true;
          else actualizado = true;
        } catch {
          await db.query(
            `UPDATE comprobantes SET
              estado = 'AUTORIZADO', estado_sri = 'AUTORIZADO',
              fecha_autorizacion = ?, numero_autorizacion = ?, updated_at = NOW()
             WHERE id = ?`,
            [
              auth.fechaAutorizacion ? new Date(auth.fechaAutorizacion) : new Date(),
              auth.numeroAutorizacion || comp.clave_acceso,
              comp.id,
            ]
          );
          actualizado = true;
        }
      } else {
        await db.query(
          `UPDATE comprobantes SET
            estado = 'AUTORIZADO', estado_sri = 'AUTORIZADO',
            fecha_autorizacion = ?, numero_autorizacion = ?, updated_at = NOW()
           WHERE id = ?`,
          [
            auth.fechaAutorizacion ? new Date(auth.fechaAutorizacion) : new Date(),
            auth.numeroAutorizacion || comp.clave_acceso,
            comp.id,
          ]
        );
        actualizado = true;
      }

      if (auth.comprobante && comprobanteId) {
        const ruc = comp.emisor_ruc || extractRuc(comp.clave_acceso);
        const fecha = comp.fecha_emision ? new Date(comp.fecha_emision) : new Date();
        const xml =
          typeof auth.comprobante === 'string' ? auth.comprobante : String(auth.comprobante);
        await saveAutorizadoXml(comprobanteId, ruc, comp.clave_acceso, fecha, xml);
        xmlGuardado = true;
      }

      accion = importado ? 'IMPORTADO' : actualizado ? 'ACTUALIZADO' : 'SIN_CAMBIOS';
    } else if (['NO AUTORIZADO', 'RECHAZADO', 'DEVUELTA'].includes(auth.estado)) {
      await db.query(
        `UPDATE comprobantes SET estado = ?, estado_sri = ?, updated_at = NOW() WHERE id = ?`,
        [auth.estado, auth.estado, comp.id]
      );
      actualizado = true;
      accion = 'ACTUALIZADO';
    }
  }

  return {
    detalle: { claveAcceso: comp.clave_acceso, estadoAnterior, estadoSri, accion },
    actualizado,
    importado,
    xmlGuardado,
  };
}

async function importarClaveDesdeSri(claveAcceso: string, tenantId: string, userRuc: string) {
  const existing = await db.queryOne<any>(
    'SELECT id, estado FROM comprobantes WHERE clave_acceso = ?',
    [claveAcceso]
  );

  const respuestaSri = await sriSoapClient.autorizarComprobante(claveAcceso);
  if (!respuestaSri.autorizaciones?.autorizacion) {
    return {
      claveAcceso,
      estadoAnterior: existing?.estado || 'NUEVO',
      estadoSri: 'NO EXISTE',
      accion: 'NO_ENCONTRADO',
      actualizado: false,
      importado: false,
      xmlGuardado: false,
    };
  }

  const auth = Array.isArray(respuestaSri.autorizaciones.autorizacion)
    ? respuestaSri.autorizaciones.autorizacion[0]
    : respuestaSri.autorizaciones.autorizacion;

  if (auth.estado !== 'AUTORIZADO' || !auth.comprobante) {
    return {
      claveAcceso,
      estadoAnterior: existing?.estado || 'NUEVO',
      estadoSri: auth.estado || 'DESCONOCIDO',
      accion: 'NO_AUTORIZADO',
      actualizado: false,
      importado: false,
      xmlGuardado: false,
    };
  }

  const parsed = await parseXmlComprobante(
    typeof auth.comprobante === 'string' ? auth.comprobante : String(auth.comprobante)
  );
  const upsert = await upsertComprobanteFromParsed(parsed, tenantId, userRuc, {
    estado: auth.estado,
    fechaAutorizacion: auth.fechaAutorizacion,
    numeroAutorizacion: auth.numeroAutorizacion,
  });

  const xml = typeof auth.comprobante === 'string' ? auth.comprobante : String(auth.comprobante);
  await saveAutorizadoXml(
    upsert.id,
    parsed.rucEmisor,
    claveAcceso,
    parsed.fechaEmision,
    xml
  );

  return {
    claveAcceso,
    estadoAnterior: existing?.estado || 'NUEVO',
    estadoSri: 'AUTORIZADO',
    accion: upsert.action === 'importado' ? 'IMPORTADO' : 'ACTUALIZADO',
    actualizado: upsert.action === 'actualizado',
    importado: upsert.action === 'importado',
    xmlGuardado: true,
  };
}

export async function sincronizarConSri(
  tenantId: string,
  userRuc: string,
  options: SyncOptions = {}
) {
  const periodoActivo = hasPeriodFilter(options);
  const totalEnPeriodo = periodoActivo
    ? await countComprobantesForSync(tenantId, userRuc, options)
    : null;

  const limiteGlobal = periodoActivo
    ? Math.min(totalEnPeriodo || 0, MAX_PERIOD_SYNC)
    : Math.min(options.limite || MAX_LIMIT, MAX_LIMIT);

  const detalle: SyncDetalle[] = [];
  let actualizados = 0;
  let importados = 0;
  let xmlsGuardados = 0;
  let errores = 0;
  let totalProcesados = 0;

  let pending: any[] = [];
  let sriNoDisponible = false;

  if (periodoActivo) {
    if ((totalEnPeriodo || 0) === 0) {
      const empty = {
        procesados: 0,
        actualizados: 0,
        importados: 0,
        xmlsGuardados: 0,
        errores: 0,
        detalle: [],
        syncedCount: 0,
        modo: (options.modo || 'completo') as SyncModo,
        totalEnPeriodo: 0,
        fechaDesde: options.fechaDesde || null,
        fechaHasta: options.fechaHasta || null,
        truncado: false,
        warning: 'NO_LOCAL_DOCUMENTS',
      };
      return { ...empty, message: buildSyncMessage(empty) };
    }
    pending = await fetchAllComprobantesForSync(tenantId, userRuc, options, limiteGlobal);
  } else {
    let offset = 0;
    let hasMore = true;
    while (hasMore && totalProcesados + pending.length < limiteGlobal) {
      const batchLimit = Math.min(BATCH_SIZE, limiteGlobal - totalProcesados - pending.length);
      const batch = await fetchComprobantesBatch(tenantId, userRuc, options, offset, batchLimit);
      if (batch.length === 0) break;
      pending.push(...batch);
      if (batch.length < batchLimit) hasMore = false;
      offset += batchLimit;
    }
  }

  for (let i = 0; i < pending.length; i++) {
    const comp = pending[i];

    if (sriNoDisponible) {
      errores++;
      detalle.push({
        claveAcceso: comp.clave_acceso,
        estadoAnterior: comp.estado,
        estadoSri: 'ERROR',
        accion: 'SRI no disponible (omitido)',
      });
      totalProcesados++;
      continue;
    }

    try {
      const result = await procesarComprobanteSri(comp, tenantId, userRuc);
      detalle.push(result.detalle);
      if (result.actualizado) actualizados++;
      if (result.importado) importados++;
      if (result.xmlGuardado) xmlsGuardados++;
    } catch (err: any) {
      const msg = err.message || 'Error SOAP';
      if (/Sin conexión al SRI|WSDL/i.test(msg)) {
        sriNoDisponible = true;
      }
      errores++;
      detalle.push({
        claveAcceso: comp.clave_acceso,
        estadoAnterior: comp.estado,
        estadoSri: 'ERROR',
        accion: msg,
      });
    }

    totalProcesados++;
    if (i < pending.length - 1 && !sriNoDisponible) await delay(DELAY_MS);
  }

  // Importar claves adicionales solicitadas (compras/ventas conocidas)
  const clavesExtra = (options.clavesAcceso || []).filter(
    (c) => typeof c === 'string' && c.length === 49 && !detalle.some((d) => d.claveAcceso === c)
  );

  for (let i = 0; i < clavesExtra.length && totalProcesados < limiteGlobal; i++) {
    try {
      const result = await importarClaveDesdeSri(clavesExtra[i], tenantId, userRuc);
      detalle.push({
        claveAcceso: result.claveAcceso,
        estadoAnterior: result.estadoAnterior,
        estadoSri: result.estadoSri,
        accion: result.accion,
      });
      if (result.actualizado) actualizados++;
      if (result.importado) importados++;
      if (result.xmlGuardado) xmlsGuardados++;
      totalProcesados++;
    } catch (err: any) {
      errores++;
      detalle.push({
        claveAcceso: clavesExtra[i],
        estadoAnterior: 'NUEVO',
        estadoSri: 'ERROR',
        accion: err.message || 'Error al importar',
      });
    }
    if (i < clavesExtra.length - 1) await delay(DELAY_MS);
  }

  const result = {
    procesados: totalProcesados,
    actualizados,
    importados,
    xmlsGuardados,
    errores,
    detalle,
    syncedCount: actualizados + importados,
    modo: (options.modo || 'completo') as SyncModo,
    totalEnPeriodo,
    fechaDesde: options.fechaDesde || null,
    fechaHasta: options.fechaHasta || null,
    truncado: periodoActivo && (totalEnPeriodo || 0) > limiteGlobal,
    warning:
      sriNoDisponible
        ? 'SRI_UNAVAILABLE'
        : totalProcesados === 0 && !periodoActivo
          ? 'NO_LOCAL_DOCUMENTS'
          : undefined,
  };
  return { ...result, message: buildSyncMessage(result) };
}
