export interface Env {
  MYBROWSER: Fetcher;
  SRI_BUCKET?: R2Bucket;
  R2_ENABLED?: string;
  DATABASE_URL?: string;
  TENANT_ID?: string;
  SRI_MCP: DurableObjectNamespace;
}

export type TipoSync = 'recibidos' | 'emitidos';

export type TipoComprobante =
  | 'factura'
  | 'nota_credito'
  | 'nota_debito'
  | 'guia_remision'
  | 'retencion'
  | 'liquidacion';

export const TIPO_CODIGOS: Record<TipoComprobante, string> = {
  factura: '1',
  nota_credito: '2',
  nota_debito: '3',
  guia_remision: '4',
  retencion: '6',
  liquidacion: '5',
};

export const TIPO_LABELS: Record<TipoComprobante, string> = {
  factura: 'Factura',
  nota_credito: 'Nota de Crédito',
  nota_debito: 'Nota de Débito',
  guia_remision: 'Guía de Remisión',
  retencion: 'Comprobante de Retención',
  liquidacion: 'Liquidación de Compra',
};

export interface ScrapedRow {
  id: number;
  nombre: string;
  tipo: string;
  numero: string;
  claveAcceso: string;
  fecha: string;
}

export interface DownloadResult {
  success: boolean;
  nombre: string;
  xmlBase64?: string;
  pdfBase64?: string;
  error?: string;
}

export interface SyncStats {
  total: number;
  nuevos: number;
  existentes: number;
  errores: number;
  xmls: number;
  pdfs: number;
  modo: string;
  periodo: string;
}

export const SRI_RECIBIDOS = {
  BASE_URL: 'https://srienlinea.sri.gob.ec',
  LOGIN_URL: 'https://srienlinea.sri.gob.ec/sri-en-linea/inicio/NAT',
  COMPROBANTES_URL: 'https://srienlinea.sri.gob.ec/facturacion-internet/pages/comprobantes/consultaComprobantes.jsf',
  SELECTORS: {
    loginLink: "a[aria-label='Ir a iniciar sesión']",
    usuario: '#usuario',
    password: '#password',
    loginBtn: '#kc-login',
    btnFacturacion: "button[title='Facturación Electrónica']",
    linkRecibidos: "a[href*='redireccion=57'][href*='idGrupo=55']",
    selectAno: '#frmPrincipal\\:ano',
    selectMes: '#frmPrincipal\\:mes',
    selectDia: '#frmPrincipal\\:dia',
    selectTipo: '#frmPrincipal\\:cmbTipoComprobante',
    btnConsultar: '#frmPrincipal\\:btnConsultarSinRe',
    tableId: 'frmPrincipal:tablaCompRecibidos',
    idPrefix: 'frmPrincipal:tablaCompRecibidos',
    xmlSuffix: 'lnkXml',
    pdfSuffix: 'lnkPdf',
  },
};

export const SRI_EMITIDOS = {
  SELECTORS: {
    linkEmitidos: "a[href*='redireccion=56'][href*='idGrupo=55']",
    selectAno: '#frmPrincipal\\:ano',
    selectMes: '#frmPrincipal\\:mes',
    selectDia: '#frmPrincipal\\:dia',
    selectTipo: '#frmPrincipal\\:cmbTipoComprobante',
    btnConsultar: '#frmPrincipal\\:btnConsultar',
    tableId: 'frmPrincipal:tablaCompRecibidos',
    idPrefix: 'frmPrincipal:tablaCompRecibidos',
    xmlSuffix: 'lnkXml',
    pdfSuffix: 'lnkPdf',
  },
};
