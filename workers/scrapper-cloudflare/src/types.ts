export interface Env {
  MYBROWSER: Fetcher;
  SRI_BUCKET?: R2Bucket;
  R2_ENABLED?: string;
  DATABASE_URL?: string;
  TENANT_ID?: string;
}

export interface ScrapeRequest {
  ruc: string;
  clave: string;
  year: number;
  month: number;
  tipo: TipoComprobante;
}

export type TipoComprobante =
  | 'factura'
  | 'nota_credito'
  | 'nota_debito'
  | 'guia_remision'
  | 'retencion'
  | 'liquidacion';

export interface ComprobanteResult {
  nombre: string;
  razonSocialEmisor: string;
  numero: string;
  fecha: string;
  tipo: string;
  claveAcceso: string;
  xmlKey?: string;
  xmlBase64?: string;
  pdfKey?: string;
  pdfBase64?: string;
}

export interface ScrapeResponse {
  success: boolean;
  periodo: string;
  tipo: string;
  comprobantes: ComprobanteResult[];
  total: number;
  descargados: number;
  errores: ErrorItem[];
  browserTimeUsed: number;
  error?: string;
  savedToNeon?: boolean;
}

export interface ErrorItem {
  fila: string;
  error: string;
}

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

export const SRI = {
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
    paginatorSelect: "td#frmPrincipal\\:tablaCompRecibidos_paginator_bottom select.ui-paginator-rpp-options",
    btnNext: "td#frmPrincipal\\:tablaCompRecibidos_paginator_bottom span.ui-paginator-next",
    tableId: 'frmPrincipal:tablaCompRecibidos',
    idPrefix: 'frmPrincipal:tablaCompRecibidos',
    xmlSuffix: 'lnkXml',
    pdfSuffix: 'lnkPdf',
  },
};
