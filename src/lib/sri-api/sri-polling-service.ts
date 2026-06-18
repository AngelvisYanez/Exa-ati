import { db } from './db';
import { sriSoapClient, type SriMensaje } from './sri-soap-client';
import { classifySriError } from './sri-error-handler';

export interface PendingAutorizacion {
  id: string;
  claveAcceso: string;
  tenantId: string;
  emisorRuc: string;
  estado: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface PollingResult {
  claveAcceso: string;
  estadoAnterior: string;
  estadoFinal: string;
  numeroAutorizacion?: string;
  fechaAutorizacion?: string;
  xmlAutorizado?: string;
  mensajes: SriMensaje[];
  actualizado: boolean;
}

const POLLING_BATCH_LIMIT = parseInt(process.env.SRI_POLLING_BATCH_LIMIT || '50', 10);
const POLLING_MAX_HOURS = parseInt(process.env.SRI_POLLING_MAX_HOURS || '24', 10);

async function procesarUnaClave(
  comp: PendingAutorizacion
): Promise<PollingResult> {
  const estadoAnterior = comp.estado;

  try {
    const respuesta = await sriSoapClient.autorizarComprobante(comp.claveAcceso);

    const auth = respuesta?.autorizaciones?.autorizacion;
    if (!auth) {
      return {
        claveAcceso: comp.claveAcceso,
        estadoAnterior,
        estadoFinal: estadoAnterior,
        mensajes: [],
        actualizado: false,
      };
    }

    const authArr = Array.isArray(auth) ? auth : [auth];
    const primerAuth = authArr[0];

    if (!primerAuth || !primerAuth.estado) {
      return {
        claveAcceso: comp.claveAcceso,
        estadoAnterior,
        estadoFinal: estadoAnterior,
        mensajes: [],
        actualizado: false,
      };
    }

    const estadoSri = primerAuth.estado;
    const mensajes: SriMensaje[] = [];
    if (primerAuth.mensajes?.mensaje) {
      const msgs = Array.isArray(primerAuth.mensajes.mensaje)
        ? primerAuth.mensajes.mensaje
        : [primerAuth.mensajes.mensaje];
      msgs.forEach((x: any) =>
        mensajes.push({
          identificador: x.identificador || '',
          mensaje: x.mensaje || '',
          informacionAdicional: x.informacionAdicional || '',
          tipo: x.tipo || 'ERROR',
        })
      );
    }

    const error70 = classifySriError(mensajes, 'autorizacion');
    if (error70?.codigo === '70') {
      return {
        claveAcceso: comp.claveAcceso,
        estadoAnterior,
        estadoFinal: 'EN_PROCESO',
        mensajes,
        actualizado: false,
      };
    }

    if (estadoSri === 'AUTORIZADO') {
      const numeroAutorizacion = primerAuth.numeroAutorizacion || comp.claveAcceso;
      const fechaAutorizacion = primerAuth.fechaAutorizacion || new Date().toISOString();

      const xmlAutorizado =
        typeof primerAuth.comprobante === 'string'
          ? primerAuth.comprobante
          : undefined;

      await db.query(
        `UPDATE comprobantes SET
          estado = 'AUTORIZADO',
          estado_sri = 'AUTORIZADO',
          fecha_autorizacion = ?,
          numero_autorizacion = ?,
          updated_at = NOW()
         WHERE id = ?`,
        [new Date(fechaAutorizacion), numeroAutorizacion, comp.id]
      );

      if (xmlAutorizado && comp.tenantId) {
        try {
          const { parseXmlComprobante, saveAutorizadoXml } = await import(
            './comprobante-importer'
          );
          const parsed = await parseXmlComprobante(xmlAutorizado);
          const fecha =
            parsed.fechaEmision || new Date(fechaAutorizacion);
          await saveAutorizadoXml(
            comp.id,
            comp.emisorRuc || parsed.rucEmisor,
            comp.claveAcceso,
            fecha,
            xmlAutorizado
          );
        } catch (err) {
          console.warn(`[Polling] No se pudo guardar XML autorizado para ${comp.claveAcceso}:`, err);
        }
      }

      return {
        claveAcceso: comp.claveAcceso,
        estadoAnterior,
        estadoFinal: 'AUTORIZADO',
        numeroAutorizacion,
        fechaAutorizacion,
        xmlAutorizado,
        mensajes,
        actualizado: true,
      };
    }

    if (['NO AUTORIZADO', 'RECHAZADO', 'DEVUELTA'].includes(estadoSri)) {
      await db.query(
        `UPDATE comprobantes SET
          estado = ?,
          estado_sri = ?,
          updated_at = NOW()
         WHERE id = ?`,
        [estadoSri, estadoSri, comp.id]
      );

      return {
        claveAcceso: comp.claveAcceso,
        estadoAnterior,
        estadoFinal: estadoSri,
        mensajes,
        actualizado: true,
      };
    }

    return {
      claveAcceso: comp.claveAcceso,
      estadoAnterior,
      estadoFinal: estadoSri || 'EN_PROCESO',
      mensajes,
      actualizado: false,
    };
  } catch (err: any) {
    return {
      claveAcceso: comp.claveAcceso,
      estadoAnterior,
      estadoFinal: 'EN_PROCESO',
      mensajes: [
        {
          identificador: 'POLLING_ERROR',
          mensaje: err.message || 'Error en polling',
          tipo: 'ERROR',
        },
      ],
      actualizado: false,
    };
  }
}

export async function checkPendingAutorizaciones(
  limit: number = POLLING_BATCH_LIMIT,
  maxWaitHours: number = POLLING_MAX_HOURS
): Promise<{
  procesados: number;
  autorizados: number;
  rechazados: number;
  enProceso: number;
  timeouts: number;
  errores: number;
  resultados: PollingResult[];
}> {
  const pendientes = await db.queryAll<PendingAutorizacion>(
    `SELECT id, clave_acceso, tenant_id, emisor_ruc, estado,
            created_at, updated_at
     FROM comprobantes
     WHERE estado IN ('EN_PROCESO', 'PPR')
     ORDER BY updated_at ASC
     LIMIT ?`,
    [limit]
  );

  if (pendientes.length === 0) {
    return {
      procesados: 0,
      autorizados: 0,
      rechazados: 0,
      enProceso: 0,
      timeouts: 0,
      errores: 0,
      resultados: [],
    };
  }

  const resultados: PollingResult[] = [];
  let autorizados = 0;
  let rechazados = 0;
  let enProceso = 0;
  let timeouts = 0;
  let errores = 0;

  const now = Date.now();

  for (const comp of pendientes) {
    const horasEspera =
      (now - new Date(comp.updatedAt).getTime()) / (1000 * 60 * 60);

    if (horasEspera >= maxWaitHours) {
      await db.query(
        `UPDATE comprobantes SET
          estado = 'TIMEOUT_SRI',
          estado_sri = 'TIMEOUT_SRI',
          updated_at = NOW()
         WHERE id = ?`,
        [comp.id]
      );

      timeouts++;
      resultados.push({
        claveAcceso: comp.claveAcceso,
        estadoAnterior: comp.estado,
        estadoFinal: 'TIMEOUT_SRI',
        mensajes: [
          {
            identificador: 'TIMEOUT',
            mensaje: `Tiempo máximo de espera excedido (${maxWaitHours}h). El SRI no respondió la autorización.`,
            tipo: 'ERROR',
          },
        ],
        actualizado: true,
      });
      continue;
    }

    try {
      const resultado = await procesarUnaClave(comp);
      resultados.push(resultado);

      if (resultado.estadoFinal === 'AUTORIZADO') autorizados++;
      else if (resultado.estadoFinal === 'TIMEOUT_SRI') timeouts++;
      else if (
        ['NO AUTORIZADO', 'RECHAZADO', 'DEVUELTA', 'DOCUMENTO_INVALIDO'].includes(
          resultado.estadoFinal
        )
      )
        rechazados++;
      else if (resultado.estadoFinal === 'EN_PROCESO') enProceso++;
      else errores++;
    } catch (err) {
      console.error(`[Polling] Error inesperado procesando ${comp.claveAcceso}:`, err);
      errores++;
      resultados.push({
        claveAcceso: comp.claveAcceso,
        estadoAnterior: comp.estado,
        estadoFinal: 'EN_PROCESO',
        mensajes: [
          { identificador: 'POLLING_UNEXPECTED', mensaje: String(err), tipo: 'ERROR' }
        ],
        actualizado: false,
      });
    }
  }

  return {
    procesados: pendientes.length,
    autorizados,
    rechazados,
    enProceso,
    timeouts,
    errores,
    resultados,
  };
}
