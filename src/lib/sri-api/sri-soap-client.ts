import * as soap from 'soap';
import { config } from './config';

export interface SriMensaje {
  identificador: string;
  mensaje: string;
  informacionAdicional?: string;
  tipo: string;
}

export interface SriRecepcionResponse {
  estado: string;
  comprobantes?: any;
}

export interface SriAutorizacionResponse {
  claveAccesoConsultada: string;
  numeroComprobantes: string;
  autorizaciones?: any;
}

export interface SriOperationResult {
  success: boolean;
  claveAcceso: string;
  estado: string;
  fechaAutorizacion?: string;
  numeroAutorizacion?: string;
  xmlAutorizado?: string;
  mensajes: SriMensaje[];
}

const soapClients = new Map<string, soap.Client>();
const wsdlFailures = new Map<string, number>();

const WSDL_TIMEOUT_MS = parseInt(process.env.SRI_WSDL_TIMEOUT_MS || '25000', 10);
const SOAP_TIMEOUT_MS = parseInt(process.env.SRI_SOAP_TIMEOUT_MS || '45000', 10);
const SOAP_MAX_RETRIES = parseInt(process.env.SRI_SOAP_MAX_RETRIES || '3', 10);
const WSDL_FAILURE_COOLDOWN_MS = 60_000;

function resolveWsdlUrl(kind: 'recepcion' | 'autorizacion', ambiente: '1' | '2'): string {
  const fallback = kind === 'recepcion'
    ? {
        '1': 'https://celcer.sri.gob.ec/comprobantes-electronicos-ws/RecepcionComprobantesOffline?wsdl',
        '2': 'https://cel.sri.gob.ec/comprobantes-electronicos-ws/RecepcionComprobantesOffline?wsdl',
      }
    : {
        '1': 'https://celcer.sri.gob.ec/comprobantes-electronicos-ws/AutorizacionComprobantesOffline?wsdl',
        '2': 'https://cel.sri.gob.ec/comprobantes-electronicos-ws/AutorizacionComprobantesOffline?wsdl',
      };

  const envUrl = kind === 'recepcion' ? config.sri?.wsdl?.reception : config.sri?.wsdl?.authorization;

  let finalUrl = fallback[ambiente];

  if (process.env.SRI_RECEPTION_WSDL || process.env.SRI_AUTHORIZATION_WSDL) {
    if (envUrl) {
       finalUrl = envUrl;
    }
  }

  // Puentear (Bridge): Reemplazar el host del SRI si hay un proxy configurado en variables de entorno
  if (process.env.SRI_PROXY_HOST) {
    finalUrl = finalUrl.replace('celcer.sri.gob.ec', process.env.SRI_PROXY_HOST);
    finalUrl = finalUrl.replace('cel.sri.gob.ec', process.env.SRI_PROXY_HOST);
  }

  return finalUrl;
}

function ambienteLabel(ambiente: '1' | '2') {
    return ambiente === '1' ? 'pruebas (celcer)' : 'producción (cel)';
}

async function withTimeout<T>(promise: Promise<T>, timeoutMs: number, label: string): Promise<T> {
  let timeoutId: NodeJS.Timeout;
  const timeoutPromise = new Promise<never>((_, reject) => {
    timeoutId = setTimeout(() => {
      reject(new Error(`${label}: tiempo de espera agotado (${timeoutMs / 1000}s)`));
    }, timeoutMs);
  });

  return Promise.race([promise, timeoutPromise]).finally(() => {
    clearTimeout(timeoutId);
  });
}

async function createSoapClient(cacheKey: string, wsdlUrl: string, label: string, ambiente: '1' | '2'): Promise<soap.Client> {
  const lastFailure = wsdlFailures.get(cacheKey);
  if (lastFailure && Date.now() - lastFailure < WSDL_FAILURE_COOLDOWN_MS) {
    throw new Error(`Conexión pausada para ${ambienteLabel(ambiente)}. Reintente en unos segundos.`);
  }

  try {
    const client = await withTimeout(
      soap.createClientAsync(wsdlUrl),
      WSDL_TIMEOUT_MS,
      `WSDL ${label}`
    );
    
    // Si usamos un puente/proxy, forzamos que el SOAP endpoint sea el mismo del WSDL (quitando ?wsdl)
    // porque el SRI devuelve en el WSDL su host original (cel.sri.gob.ec) y el cliente intentaría conectarse directo.
    if (process.env.SRI_PROXY_HOST) {
      client.setEndpoint(wsdlUrl.replace('?wsdl', ''));
    }

    // El SRI suele redirigir tráfico a IPs internas (ej. 181.113.227.222) bajo alta carga.
    // Node.js rechaza estas conexiones porque el certificado SSL del SRI es para *.sri.gob.ec, no para la IP.
    // Desactivamos la validación estricta de SSL exclusivamente para este cliente SOAP.
    client.setSecurity(new soap.ClientSSLSecurity(
      undefined as any,
      undefined as any,
      undefined as any,
      { rejectUnauthorized: false }
    ));

    wsdlFailures.delete(cacheKey);
    soapClients.set(cacheKey, client);
    return client;
  } catch (error) {
    wsdlFailures.set(cacheKey, Date.now());
    const detail = (error as Error).message || 'error de red';
    throw new Error(`Sin conexión al SRI (${ambienteLabel(ambiente)}): ${detail}`);
  }
}

async function getRecepcionClient(ambiente: '1' | '2'): Promise<soap.Client> {
  const cacheKey = `recepcion_${ambiente}`;
  if (soapClients.has(cacheKey)) {
    return soapClients.get(cacheKey)!;
  }
  const wsdlUrl = resolveWsdlUrl('recepcion', ambiente);
  return createSoapClient(cacheKey, wsdlUrl, 'recepción', ambiente);
}

async function getAutorizacionClient(ambiente: '1' | '2'): Promise<soap.Client> {
  const cacheKey = `autorizacion_${ambiente}`;
  if (soapClients.has(cacheKey)) {
    return soapClients.get(cacheKey)!;
  }
  const wsdlUrl = resolveWsdlUrl('autorizacion', ambiente);
  return createSoapClient(cacheKey, wsdlUrl, 'autorización', ambiente);
}

function extractMensajesRecepcion(response: any): SriMensaje[] {
    const mensajes: SriMensaje[] = [];
    const comprobantes = response?.comprobantes?.comprobante;
    if (comprobantes) {
        const arr = Array.isArray(comprobantes) ? comprobantes : [comprobantes];
        arr.forEach((c: any) => {
            const m = c?.mensajes?.mensaje;
            if (m) {
                const msgs = Array.isArray(m) ? m : [m];
                msgs.forEach((x: any) => mensajes.push({
                    identificador: x.identificador || '',
                    mensaje: x.mensaje || '',
                    informacionAdicional: x.informacionAdicional || '',
                    tipo: x.tipo || 'ERROR'
                }));
            }
        });
    }
    return mensajes;
}

export const sriSoapClient = {
  async enviarYAutorizar(xmlFirmado: string, claveAcceso: string): Promise<SriOperationResult> {
    const ambiente = claveAcceso.substring(23, 24) as '1' | '2';
    
    // 1. Recepción
    try {
        const clientRecepcion = await getRecepcionClient(ambiente);
        const [recResult] = await withTimeout<any>(
            clientRecepcion.validarComprobanteAsync({ xml: Buffer.from(xmlFirmado).toString('base64') }),
            SOAP_TIMEOUT_MS,
            'SOAP validarComprobante'
        );
        const resp = recResult?.RespuestaRecepcionComprobante || recResult;
        const estado = resp?.estado || 'DEVUELTA';
        
        if (estado !== 'RECIBIDA') {
            return {
                success: false,
                claveAcceso,
                estado,
                mensajes: extractMensajesRecepcion(resp)
            };
        }
    } catch (e: any) {
         return {
             success: false, claveAcceso, estado: 'ERROR',
             mensajes: [{ identificador: 'ERROR', mensaje: e.message, tipo: 'ERROR' }]
         };
    }

    // Esperar un momento antes de autorizar
    await new Promise(r => setTimeout(r, 2000));

    // 2. Autorización
    const respAuth = await this.autorizarComprobante(claveAcceso);
    
    const auth = Array.isArray(respAuth?.autorizaciones?.autorizacion) 
        ? respAuth.autorizaciones.autorizacion[0] 
        : respAuth?.autorizaciones?.autorizacion;

    if (!auth) {
        return { success: false, claveAcceso, estado: 'PENDIENTE', mensajes: [] };
    }

    const estadoAuth = auth.estado || 'DEVUELTA';
    const mensajes: SriMensaje[] = [];
    if (auth.mensajes?.mensaje) {
        const msgs = Array.isArray(auth.mensajes.mensaje) ? auth.mensajes.mensaje : [auth.mensajes.mensaje];
        msgs.forEach((x: any) => mensajes.push({
            identificador: x.identificador || '',
            mensaje: x.mensaje || '',
            informacionAdicional: x.informacionAdicional || '',
            tipo: x.tipo || 'ERROR'
        }));
    }

    return {
        success: estadoAuth === 'AUTORIZADO',
        claveAcceso,
        estado: estadoAuth,
        fechaAutorizacion: auth.fechaAutorizacion,
        numeroAutorizacion: auth.numeroAutorizacion,
        xmlAutorizado: typeof auth.comprobante === 'string' ? auth.comprobante : undefined,
        mensajes
    };
  },

  async autorizarComprobante(claveAcceso: string): Promise<any> {
    const ambiente = claveAcceso.substring(23, 24) as '1' | '2';
    const client = await getAutorizacionClient(ambiente);
    
    for (let attempt = 1; attempt <= SOAP_MAX_RETRIES; attempt++) {
        try {
            const [result] = await withTimeout<any>(
               client.autorizacionComprobanteAsync({ claveAccesoComprobante: claveAcceso }),
               SOAP_TIMEOUT_MS,
               'SOAP autorizacionComprobante'
            );
            return result?.RespuestaAutorizacionComprobante || result;
        } catch (e: any) {
            if (attempt === SOAP_MAX_RETRIES) {
                return {
                    claveAccesoConsultada: claveAcceso,
                    numeroComprobantes: '0',
                    autorizaciones: {
                       autorizacion: {
                           estado: 'EN PROCESO',
                           mensajes: { mensaje: { identificador: 'ERROR', mensaje: e.message, tipo: 'ERROR' } }
                       }
                    }
                };
            }
            await new Promise(r => setTimeout(r, 2000 * attempt));
        }
    }
  },

  async testConnection(ambiente: '1' | '2'): Promise<{ success: boolean; recepcion: boolean; autorizacion: boolean; error?: string }> {
    const cacheKeyRecepcion = `recepcion_${ambiente}`;
    const cacheKeyAutorizacion = `autorizacion_${ambiente}`;

    wsdlFailures.delete(cacheKeyRecepcion);
    wsdlFailures.delete(cacheKeyAutorizacion);
    
    soapClients.delete(cacheKeyRecepcion);
    soapClients.delete(cacheKeyAutorizacion);

    let recepcion = false;
    let autorizacion = false;
    try {
      await getRecepcionClient(ambiente);
      recepcion = true;

      await getAutorizacionClient(ambiente);
      autorizacion = true;

      return { success: true, recepcion, autorizacion };
    } catch (error: any) {
      return {
        success: false,
        recepcion,
        autorizacion,
        error: error.message || 'Error desconocido de conexión',
      };
    }
  }
};
