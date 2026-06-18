const API_URL = process.env.NEXT_PUBLIC_SRI_API_URL || '/api';

const TOKEN_KEY = 'sri_access_token';
const REFRESH_KEY = 'sri_refresh_token';
const USER_KEY = 'sri_user';

export interface SessionUser {
  id: string;
  email: string;
  rol: string;
  tenantId: string | null;
}

export interface Comprobante {
  id: string;
  tipoComprobante: string; // '01' = Factura, '07' = Retencion, etc.
  serie?: string;
  secuencial: string;
  claveAcceso: string;
  fechaEmision: string;
  estado: string; // 'AUTORIZADO', 'PENDIENTE', 'RECHAZADO', etc.
  estadoSri?: string;
  importeTotal: number;
  subtotal?: number;
  numeroAutorizacion?: string;
  fechaAutorizacion?: string;
  receptorRazonSocial: string;
  receptorIdentificacion: string;
  receptorEmail?: string;
  emisor?: {
    ruc: string;
    razonSocial: string;
    nombreComercial: string;
  };
  categoria?: string;
  totalIva?: number;
  documentosRelacionados?: string;
}

const getAuthToken = () => {
  if (typeof window !== 'undefined') {
    return localStorage.getItem(TOKEN_KEY);
  }
  return null;
};

export const setAuthToken = (token: string) => {
  if (typeof window !== 'undefined') {
    localStorage.setItem(TOKEN_KEY, token);
  }
};

export const removeAuthToken = () => {
  if (typeof window !== 'undefined') {
    localStorage.removeItem(TOKEN_KEY);
  }
};

export const setSession = (data: {
  accessToken: string;
  refreshToken?: string;
  user: SessionUser;
}) => {
  if (typeof window === 'undefined') return;
  localStorage.setItem(TOKEN_KEY, data.accessToken);
  if (data.refreshToken) localStorage.setItem(REFRESH_KEY, data.refreshToken);
  localStorage.setItem(USER_KEY, JSON.stringify(data.user));
  const maxAge = 60 * 60 * 24;
  document.cookie = `${TOKEN_KEY}=${data.accessToken}; path=/; max-age=${maxAge}; SameSite=Lax`;
};

export const getSession = (): { user: SessionUser } | null => {
  if (typeof window === 'undefined') return null;
  const token = localStorage.getItem(TOKEN_KEY);
  const userRaw = localStorage.getItem(USER_KEY);
  if (!token || !userRaw) return null;
  try {
    return { user: JSON.parse(userRaw) as SessionUser };
  } catch {
    return null;
  }
};

export const clearSession = () => {
  if (typeof window === 'undefined') return;
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(REFRESH_KEY);
  localStorage.removeItem(USER_KEY);
  document.cookie = `${TOKEN_KEY}=; path=/; max-age=0; SameSite=Lax`;
};

async function request(endpoint: string, options: RequestInit = {}) {
  const token = getAuthToken();
  const headers = {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...options.headers,
  };

  const response = await fetch(`${API_URL}${endpoint}`, {
    ...options,
    headers,
  });

  if (!response.ok) {
    if (response.status === 401) {
      clearSession();
    }
    const errData = await response.json().catch(() => ({}));
    throw new Error(errData.message || `API request failed: ${response.status}`);
  }

  return response.json();
}

export const sriClient = {
  isAuthenticated(): boolean {
    return !!getAuthToken();
  },

  async login(email: string, password: string) {
    const response = await fetch(`${API_URL}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ email, password }),
    });

    if (!response.ok) {
      const errData = await response.json().catch(() => ({}));
      throw new Error(errData.message || `API request failed: ${response.status}`);
    }

    const data = await response.json();
    if (data.accessToken) {
      setSession({
        accessToken: data.accessToken,
        refreshToken: data.refreshToken,
        user: data.user,
      });
    }
    return data;
  },

  async register(email: string, password: string, rol = 'USER', nombre?: string) {
    return request('/auth/register', {
      method: 'POST',
      body: JSON.stringify({ email, password, rol, nombre }),
    });
  },

  logout() {
    clearSession();
  },

  getSession() {
    return getSession();
  },

  async vincularSri(ruc: string, sriPassword: string) {
    return request('/sri/vincular', {
      method: 'POST',
      body: JSON.stringify({ ruc, sriPassword }),
    });
  },

  async getComprobantes(params: {
    limit?: number;
    page?: number;
    tipo?: string;
    rucEmisor?: string;
    fechaDesde?: string;
    fechaHasta?: string;
  } = {}) {
    const query = new URLSearchParams();
    if (params.limit) query.append('limit', params.limit.toString());
    if (params.page) query.append('page', params.page.toString());
    if (params.tipo) query.append('tipo', params.tipo);
    if (params.rucEmisor) query.append('rucEmisor', params.rucEmisor);
    if (params.fechaDesde) query.append('fechaDesde', params.fechaDesde);
    if (params.fechaHasta) query.append('fechaHasta', params.fechaHasta);

    const queryString = query.toString() ? `?${query.toString()}` : '';
    return request(`/sri/comprobantes${queryString}`);
  },

  async getComprobanteDetail(claveAcceso: string) {
    return request(`/sri/comprobantes/${claveAcceso}`);
  },

  async getXml(claveAcceso: string): Promise<string> {
    const token = getAuthToken();
    const headers = {
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    };
    const response = await fetch(`${API_URL}/sri/comprobantes/${claveAcceso}/xml`, { headers });
    if (!response.ok) throw new Error('No se pudo obtener el XML autorizado.');
    return response.text();
  },

  async emitirGeneral(data: { tipo: string; emisorRuc: string; datos: any }) {
    return request('/sri/emitir', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  async emitirFactura(facturaData: any) {
    return request('/sri/emitir/factura', {
      method: 'POST',
      body: JSON.stringify(facturaData),
    });
  },

  async emitirNotaCredito(notaCreditoData: any) {
    return request('/sri/emitir/nota-credito', {
      method: 'POST',
      body: JSON.stringify(notaCreditoData),
    });
  },

  async emitirRetencion(retencionData: any) {
    return request('/sri/emitir/retencion', {
      method: 'POST',
      body: JSON.stringify(retencionData),
    });
  },

  async retryPendientesSri() {
    return request('/sri/comprobantes/retry-pending', {
      method: 'POST',
    });
  },

  async getEnProcesoCount(): Promise<number> {
    const res = await request('/sri/comprobantes?estado=EN_PROCESO&limit=1');
    return (res as any)?.meta?.total || 0;
  },

  async getPprCount(): Promise<number> {
    const res = await request('/sri/comprobantes?estado=PPR&limit=1');
    return (res as any)?.meta?.total || 0;
  },

  async verificarEstadoSri(claveAcceso: string) {
    return request(`/sri/verificar/${claveAcceso}`);
  },

  async uploadCertificado(formData: FormData) {
    const token = getAuthToken();
    const headers = {
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    };
    const response = await fetch(`${API_URL}/certificates/upload-cert`, {
      method: 'POST',
      headers,
      body: formData,
    });
    if (!response.ok) {
      throw new Error('Error al subir firma digital .p12');
    }
    return response.json();
  },

  async importXmls(xmls: string[]) {
    return request('/sri/comprobantes/import', {
      method: 'POST',
      body: JSON.stringify({ xmls }),
    });
  },

  async syncSri(params: {
    modo?: 'completo' | 'pendientes' | 'emitidos' | 'recibidos';
    limite?: number;
    fechaDesde?: string;
    fechaHasta?: string;
    sincronizarPeriodo?: boolean;
    clavesAcceso?: string[];
  } = {}) {
    const { sincronizarPeriodo: _, ...rest } = params;
    const controller = new AbortController();
    const timeoutMs = parseInt(process.env.NEXT_PUBLIC_SRI_SYNC_TIMEOUT_MS || '480000', 10);
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
    try {
      return await request('/sri/comprobantes/sync', {
        method: 'POST',
        body: JSON.stringify(rest),
        signal: controller.signal,
      });
    } catch (err) {
      if (err instanceof Error && err.name === 'AbortError') {
        throw new Error('La sincronización tardó demasiado. Intenta con un período más corto o modo pendientes.');
      }
      throw err;
    } finally {
      clearTimeout(timeoutId);
    }
  },

  async categorizeComprobante(claveAcceso: string, categoria: string) {
    return request(`/sri/comprobantes/${claveAcceso}/categorize`, {
      method: 'PUT',
      body: JSON.stringify({ categoria }),
    });
  },

  async retryPending() {
    return request('/sri/comprobantes/retry-pending', {
      method: 'POST',
    });
  },

  async getEmisor() {
    return request('/sri/emisor');
  },

  async getMobileQr() {
    return request('/sri/mobile-qr');
  },

  async chat(message: string, history: { role: 'user' | 'assistant'; content: string }[] = []) {
    return request('/chat', {
      method: 'POST',
      body: JSON.stringify({ message, history }),
    });
  },

  async getWhatsappStatus() {
    return request('/whatsapp/status');
  },

  async updateWhatsappPreferences(notifDocumentos: boolean, notifGeneracion: boolean) {
    return request('/whatsapp/preferences', {
      method: 'PUT',
      body: JSON.stringify({ notifDocumentos, notifGeneracion }),
    });
  },

  async getWhatsappQr(numero?: string) {
    const query = numero ? `?numero=${encodeURIComponent(numero)}` : '';
    return request(`/whatsapp/qr${query}`);
  },

  async connectWhatsapp(numero: string) {
    return request('/whatsapp/connect', {
      method: 'POST',
      body: JSON.stringify({ numero }),
    });
  },

  async disconnectWhatsapp() {
    return request('/whatsapp/disconnect', {
      method: 'POST',
    });
  },

  async sendWhatsappTest() {
    return request('/whatsapp/send-test', {
      method: 'POST',
    });
  },

  async getAuditoria(params: { fechaDesde?: string; fechaHasta?: string } = {}) {
    const query = new URLSearchParams();
    if (params.fechaDesde) query.append('fechaDesde', params.fechaDesde);
    if (params.fechaHasta) query.append('fechaHasta', params.fechaHasta);
    const qs = query.toString() ? `?${query.toString()}` : '';
    return request(`/sri/auditoria${qs}`);
  },

  async runAuditoria(params: { fechaDesde?: string; fechaHasta?: string } = {}) {
    return request('/sri/auditoria', {
      method: 'POST',
      body: JSON.stringify(params),
    });
  },

  async getNotificaciones(params: { fechaDesde?: string; fechaHasta?: string } = {}) {
    const query = new URLSearchParams();
    if (params.fechaDesde) query.append('fechaDesde', params.fechaDesde);
    if (params.fechaHasta) query.append('fechaHasta', params.fechaHasta);
    const qs = query.toString() ? `?${query.toString()}` : '';
    return request(`/notificaciones${qs}`);
  },

  async getDeclaraciones(params: { fechaDesde?: string; fechaHasta?: string } = {}) {
    const query = new URLSearchParams();
    if (params.fechaDesde) query.append('fechaDesde', params.fechaDesde);
    if (params.fechaHasta) query.append('fechaHasta', params.fechaHasta);
    const qs = query.toString() ? `?${query.toString()}` : '';
    return request(`/sri/declaraciones${qs}`);
  },

  async presentarDeclaracion(data: {
    periodo?: string;
    otpVerificado?: boolean;
    fechaDesde?: string;
    fechaHasta?: string;
  } = {}) {
    return request('/sri/declaraciones', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  async getConfiguracion() {
    return request('/configuracion');
  },

  async updateConfiguracion(data: {
    notifDocumentos?: boolean;
    notifGeneracion?: boolean;
  }) {
    return request('/configuracion', {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  },

  async getIaConfig() {
    return request('/configuracion/ia');
  },

  async updateIaConfig(data: {
    provider?: 'gemini' | 'claude';
    model?: string;
    geminiApiKey?: string;
    claudeApiKey?: string;
  }) {
    return request('/configuracion/ia', {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  },

  async testIaConnection(data: {
    provider: 'gemini' | 'claude';
    model?: string;
    apiKey?: string;
  }) {
    return request('/configuracion/ia/test', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  async getChatStatus() {
    return request('/chat/status');
  },

  async getSyncStatus() {
    return request('/sri/sync/status');
  },

  async testSriConnection() {
    return request('/sri/test-connection', {
      method: 'POST',
    });
  },

  getPdfUrl(claveAcceso: string): string {
    return `${API_URL}/sri/comprobantes/${claveAcceso}/pdf`;
  },

  getXmlUrl(claveAcceso: string): string {
    return `${API_URL}/sri/comprobantes/${claveAcceso}/xml`;
  }
};

