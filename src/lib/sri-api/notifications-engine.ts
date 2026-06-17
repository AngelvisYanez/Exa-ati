import { buildAuditAlerts, fetchTenantComprobantes } from './audit-engine';
import { calculateTaxSummary } from './tax-calculator';
import { db } from './db';

export type NotificationChannel = 'App' | 'Email' | 'WhatsApp';
export type NotificationType = 'vencimiento' | 'presentacion' | 'alerta' | 'recordatorio' | 'sri';

export interface AppNotification {
  id: string;
  type: NotificationType;
  title: string;
  body: string;
  time: string;
  date: string;
  at: string;
  channel: NotificationChannel;
  unread: boolean;
  actionLabel?: string;
  actionHref?: string;
}

function formatRelative(date: Date): { time: string; date: string } {
  const now = new Date();
  const isToday = date.toDateString() === now.toDateString();
  const yesterday = new Date(now);
  yesterday.setDate(yesterday.getDate() - 1);
  const isYesterday = date.toDateString() === yesterday.toDateString();

  return {
    time: date.toLocaleTimeString('es-EC', { hour: '2-digit', minute: '2-digit' }),
    date: isToday ? 'Hoy' : isYesterday ? 'Ayer' : date.toLocaleDateString('es-EC'),
  };
}

function isDateInRange(
  iso: string,
  range?: { fechaDesde?: string; fechaHasta?: string }
): boolean {
  if (!range?.fechaDesde && !range?.fechaHasta) return true;
  const d = new Date(iso);
  if (range.fechaDesde) {
    const from = new Date(`${range.fechaDesde}T00:00:00`);
    if (d < from) return false;
  }
  if (range.fechaHasta) {
    const to = new Date(`${range.fechaHasta}T23:59:59`);
    if (d > to) return false;
  }
  return true;
}

function periodAnchorDate(range?: { fechaDesde?: string; fechaHasta?: string }): Date {
  if (range?.fechaHasta) return new Date(`${range.fechaHasta}T12:00:00`);
  if (range?.fechaDesde) return new Date(`${range.fechaDesde}T12:00:00`);
  return new Date();
}

export async function buildNotifications(
  userRuc: string,
  tenantId: string,
  emisor?: {
    certificado_valido_hasta?: string | Date | null;
    cert_valido_hasta?: string | Date | null;
    whatsapp_estado?: string | null;
  } | null,
  range?: { fechaDesde?: string; fechaHasta?: string }
): Promise<AppNotification[]> {
  const notifications: AppNotification[] = [];
  const comprobantes = await fetchTenantComprobantes(tenantId, userRuc, range);
  const summary = calculateTaxSummary(comprobantes, userRuc);
  const periodAt = periodAnchorDate(range);

  const expiry = emisor?.certificado_valido_hasta || emisor?.cert_valido_hasta || null;
  let certDaysLeft: number | null = null;
  if (expiry) {
    certDaysLeft = Math.ceil(
      (new Date(expiry).getTime() - Date.now()) / (1000 * 60 * 60 * 24)
    );
  }

  const alerts = buildAuditAlerts(comprobantes, userRuc, certDaysLeft);
  const alto = alerts.filter((a) => a.risk === 'Alto');

  if (summary.ivaAPagarNeto > 0) {
    const rel = formatRelative(periodAt);
    notifications.push({
      id: 'iva-pendiente',
      type: 'vencimiento',
      title: 'Declaración IVA pendiente',
      body: `IVA calculado del período: $${summary.ivaAPagarNeto.toFixed(2)} con ${comprobantes.length} documentos procesados.`,
      ...rel,
      at: periodAt.toISOString(),
      channel: 'App',
      unread: true,
      actionLabel: 'Presentar ahora',
      actionHref: '/declaraciones/presentar',
    });
  }

  if (alto.length > 0) {
    const rel = formatRelative(periodAt);
    notifications.push({
      id: 'auditoria-alerta',
      type: 'alerta',
      title: `${alto.length} alerta(s) de riesgo alto detectada(s)`,
      body: alto[0].description,
      ...rel,
      at: periodAt.toISOString(),
      channel: 'WhatsApp',
      unread: true,
      actionLabel: 'Ver auditoría',
      actionHref: '/auditoria',
    });
  }

  const pendientes = comprobantes.filter((c) => c.estado && c.estado !== 'AUTORIZADO');
  if (pendientes.length > 0) {
    const rel = formatRelative(periodAt);
    notifications.push({
      id: 'comp-pendientes',
      type: 'recordatorio',
      title: 'Comprobantes pendientes de autorización SRI',
      body: `${pendientes.length} documento(s) requieren sincronización con el SRI.`,
      ...rel,
      at: periodAt.toISOString(),
      channel: 'App',
      unread: true,
      actionLabel: 'Ver documentos',
      actionHref: '/documentos',
    });
  }

  if (certDaysLeft !== null && certDaysLeft <= 30) {
    const at = new Date();
    const rel = formatRelative(at);
    notifications.push({
      id: 'cert-expira',
      type: 'sri',
      title: certDaysLeft < 0 ? 'Firma electrónica expirada' : 'Firma electrónica por vencer',
      body:
        certDaysLeft < 0
          ? `Tu certificado expiró hace ${Math.abs(certDaysLeft)} días. Renuévalo para emitir comprobantes.`
          : `Tu certificado vence en ${certDaysLeft} días.`,
      ...rel,
      at: at.toISOString(),
      channel: 'Email',
      unread: certDaysLeft <= 15,
      actionLabel: 'Ir a configuración',
      actionHref: '/configuracion?tab=integraciones',
    });
  }

  const recientesAutorizados = comprobantes
    .filter((c) => c.estado === 'AUTORIZADO')
    .slice(0, 3);

  for (const doc of recientesAutorizados) {
    const at = doc.fecha_emision ? new Date(doc.fecha_emision) : new Date();
    const rel = formatRelative(at);
    notifications.push({
      id: `auth-${doc.clave_acceso}`,
      type: 'presentacion',
      title: 'Comprobante autorizado',
      body: `Secuencial ${doc.secuencial} · ${doc.emisor_razon_social || 'Emisor'} · AUTORIZADO`,
      ...rel,
      at: at.toISOString(),
      channel: 'App',
      unread: false,
      actionLabel: 'Ver documento',
      actionHref: '/documentos',
    });
  }

  try {
    const scrapingJobs = await db.queryAll<any>(
      `SELECT * FROM scraping_jobs WHERE ruc = ? ORDER BY created_at DESC LIMIT 5`,
      [userRuc]
    );

    for (const job of scrapingJobs) {
      const at = job.updated_at ? new Date(job.updated_at) : new Date(job.created_at);
      const rel = formatRelative(at);
      
      let title = 'Sincronización SRI (Scraping) en proceso';
      let body = `Sincronizando comprobantes del período ${job.mes}/${job.anio} para RUC ${job.ruc}`;
      let type: NotificationType = 'sri';
      
      if (job.status === 'COMPLETED') {
        title = 'Sincronización SRI (Scraping) completada';
        body = `Se sincronizaron correctamente los comprobantes del período ${job.mes}/${job.anio}.`;
        type = 'presentacion';
      } else if (job.status === 'ERROR') {
        title = 'Error en Sincronización SRI';
        body = `Fallo al descargar comprobantes de ${job.mes}/${job.anio}. Revisa el registro.`;
        type = 'alerta';
      }
      
      notifications.push({
        id: `scraping-${job.id}`,
        type,
        title,
        body,
        ...rel,
        at: at.toISOString(),
        channel: 'App',
        unread: true,
        actionLabel: 'Ver detalles',
        actionHref: '/sri-scraping',
      });
    }
  } catch (err) {
    console.error('Error fetching scraping jobs for notifications:', err);
  }

  return notifications.filter((n) => {
    if (n.id === 'cert-expira') return true;
    return isDateInRange(n.at, range);
  });
}
