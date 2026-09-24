import { randomUUID } from 'crypto';
import { buildAuditAlerts, fetchTenantComprobantes } from './audit-engine';
import { calculateTaxSummary } from './tax-calculator';
import { db } from './db';
import { sendWhatsAppAlert } from './whatsapp-service';

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

export type NotificationCandidate = {
  dedupeKey: string;
  type: NotificationType;
  title: string;
  body: string;
  at: Date;
  channel: NotificationChannel;
  unread: boolean;
  actionLabel?: string;
  actionHref?: string;
};

export type ChannelPrefs = {
  app: boolean;
  email: boolean;
  whatsapp: boolean;
};

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

function usesPostgres(): boolean {
  return Boolean(process.env.DATABASE_URL);
}

function smtpConfigured(): boolean {
  return Boolean(process.env.SMTP_HOST);
}

function rowToAppNotification(row: any): AppNotification {
  const at = row.event_at ? new Date(row.event_at) : new Date();
  const rel = formatRelative(at);
  return {
    id: row.id,
    type: row.type,
    title: row.title,
    body: row.body,
    ...rel,
    at: at.toISOString(),
    channel: row.channel,
    unread: Boolean(row.unread),
    actionLabel: row.action_label || undefined,
    actionHref: row.action_href || undefined,
  };
}

/**
 * Genera candidatos a partir de datos reales del tenant (sin persistir).
 * Usado por tests y por el sync a BD.
 */
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
  const candidates = await buildNotificationCandidates(userRuc, tenantId, emisor, range);
  return candidates
    .filter((c) => c.dedupeKey.startsWith('cert-expira') || isDateInRange(c.at.toISOString(), range))
    .map((c) => {
      const rel = formatRelative(c.at);
      return {
        id: c.dedupeKey,
        type: c.type,
        title: c.title,
        body: c.body,
        ...rel,
        at: c.at.toISOString(),
        channel: c.channel,
        unread: c.unread,
        actionLabel: c.actionLabel,
        actionHref: c.actionHref,
      };
    });
}

export async function buildNotificationCandidates(
  userRuc: string,
  tenantId: string,
  emisor?: {
    certificado_valido_hasta?: string | Date | null;
    cert_valido_hasta?: string | Date | null;
    whatsapp_estado?: string | null;
  } | null,
  range?: { fechaDesde?: string; fechaHasta?: string }
): Promise<NotificationCandidate[]> {
  const notifications: NotificationCandidate[] = [];
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
    notifications.push({
      dedupeKey: 'iva-pendiente',
      type: 'vencimiento',
      title: 'Declaración IVA pendiente',
      body: `IVA calculado del período: $${summary.ivaAPagarNeto.toFixed(2)} con ${comprobantes.length} documentos procesados.`,
      at: periodAt,
      channel: 'App',
      unread: true,
      actionLabel: 'Presentar ahora',
      actionHref: '/declaraciones/presentar',
    });
  }

  if (alto.length > 0) {
    notifications.push({
      dedupeKey: 'auditoria-alerta',
      type: 'alerta',
      title: `${alto.length} alerta(s) de riesgo alto detectada(s)`,
      body: alto[0].description,
      at: periodAt,
      channel: 'WhatsApp',
      unread: true,
      actionLabel: 'Ver auditoría',
      actionHref: '/auditoria',
    });
  }

  const pendientes = comprobantes.filter((c) => c.estado && c.estado !== 'AUTORIZADO');
  if (pendientes.length > 0) {
    notifications.push({
      dedupeKey: 'comp-pendientes',
      type: 'recordatorio',
      title: 'Comprobantes pendientes de autorización SRI',
      body: `${pendientes.length} documento(s) requieren sincronización con el SRI.`,
      at: periodAt,
      channel: 'App',
      unread: true,
      actionLabel: 'Ver documentos',
      actionHref: '/documentos',
    });
  }

  if (certDaysLeft !== null && certDaysLeft <= 30) {
    const at = new Date();
    notifications.push({
      dedupeKey: 'cert-expira',
      type: 'sri',
      title: certDaysLeft < 0 ? 'Firma electrónica expirada' : 'Firma electrónica por vencer',
      body:
        certDaysLeft < 0
          ? `Tu certificado expiró hace ${Math.abs(certDaysLeft)} días. Renuévalo para emitir comprobantes.`
          : `Tu certificado vence en ${certDaysLeft} días.`,
      at,
      channel: 'App',
      unread: certDaysLeft <= 15,
      actionLabel: 'Ir a configuración',
      actionHref: '/configuracion?tab=integraciones',
    });

    if (smtpConfigured()) {
      notifications.push({
        dedupeKey: 'cert-expira-email',
        type: 'sri',
        title: certDaysLeft < 0 ? 'Firma electrónica expirada' : 'Firma electrónica por vencer',
        body:
          certDaysLeft < 0
            ? `Tu certificado expiró hace ${Math.abs(certDaysLeft)} días. Renuévalo para emitir comprobantes.`
            : `Tu certificado vence en ${certDaysLeft} días.`,
        at,
        channel: 'Email',
        unread: certDaysLeft <= 15,
        actionLabel: 'Ir a configuración',
        actionHref: '/configuracion?tab=integraciones',
      });
    }
  }

  const recientesAutorizados = comprobantes
    .filter((c) => c.estado === 'AUTORIZADO')
    .slice(0, 3);

  for (const doc of recientesAutorizados) {
    const at = doc.fecha_emision ? new Date(doc.fecha_emision) : new Date();
    notifications.push({
      dedupeKey: `auth-${doc.clave_acceso}`,
      type: 'presentacion',
      title: 'Comprobante autorizado',
      body: `Secuencial ${doc.secuencial} · ${doc.emisor_razon_social || 'Emisor'} · AUTORIZADO`,
      at,
      channel: 'App',
      unread: false,
      actionLabel: 'Ver documento',
      actionHref: '/documentos',
    });
  }

  const haceUnaHora = new Date(Date.now() - 3600000).toISOString();
  const autorizadosRecientes = await db.queryAll<any>(
    `SELECT clave_acceso, secuencial, emisor_razon_social, updated_at
     FROM comprobantes
     WHERE estado = 'AUTORIZADO'
       AND updated_at >= ?
       AND (tenant_id = ? OR emisor_ruc = ? OR receptor_identificacion = ?)
     ORDER BY updated_at DESC
     LIMIT 3`,
    [haceUnaHora, tenantId, userRuc, userRuc]
  );

  for (const doc of autorizadosRecientes) {
    const at = doc.updated_at ? new Date(doc.updated_at) : new Date();
    notifications.push({
      dedupeKey: `cron-auth-${doc.clave_acceso}`,
      type: 'presentacion',
      title: 'Comprobante autorizado automáticamente',
      body: `CRON SRI: Secuencial ${doc.secuencial} · ${doc.emisor_razon_social || 'Emisor'} · AUTORIZADO`,
      at,
      channel: 'App',
      unread: true,
      actionLabel: 'Ver documento',
      actionHref: '/documentos',
    });
  }

  const timeoutsRecientes = await db.queryAll<any>(
    `SELECT clave_acceso, secuencial, emisor_razon_social, updated_at
     FROM comprobantes
     WHERE estado = 'TIMEOUT_SRI'
       AND updated_at >= ?
       AND (tenant_id = ? OR emisor_ruc = ? OR receptor_identificacion = ?)
     ORDER BY updated_at DESC
     LIMIT 3`,
    [haceUnaHora, tenantId, userRuc, userRuc]
  );

  for (const doc of timeoutsRecientes) {
    const at = doc.updated_at ? new Date(doc.updated_at) : new Date();
    notifications.push({
      dedupeKey: `cron-timeout-${doc.clave_acceso}`,
      type: 'alerta',
      title: 'Tiempo de espera SRI agotado',
      body: `CRON SRI: Secuencial ${doc.secuencial} · ${doc.emisor_razon_social || 'Emisor'} · Tiempo máximo de 24h excedido.`,
      at,
      channel: 'App',
      unread: true,
      actionLabel: 'Ver documento',
      actionHref: '/documentos',
    });
  }

  const scrapingJobs = await db.queryAll<any>(
    `SELECT id, ruc, mes, anio, status, updated_at, created_at
     FROM scraping_jobs
     WHERE ruc = ? AND (tenant_id = ? OR tenant_id IS NULL)
     ORDER BY created_at DESC
     LIMIT 5`,
    [userRuc, tenantId]
  );

  for (const job of scrapingJobs) {
    let rawDate = job.updated_at || job.created_at;
    let at = rawDate ? new Date(rawDate) : new Date();
    if (isNaN(at.getTime())) {
      at = new Date();
    }

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
      dedupeKey: `scraping-${job.id}`,
      type,
      title,
      body,
      at,
      channel: 'App',
      unread: true,
      actionLabel: 'Ver detalles',
      actionHref: '/documentos',
    });
  }

  return notifications.filter((n) => {
    if (n.dedupeKey.startsWith('cert-expira')) return true;
    return isDateInRange(n.at.toISOString(), range);
  });
}

async function upsertNotification(
  tenantId: string,
  userRuc: string,
  candidate: NotificationCandidate
): Promise<{ id: string; isNew: boolean }> {
  const existing = await db.queryOne<{ id: string; unread: boolean }>(
    `SELECT id, unread FROM notificaciones WHERE tenant_id = ? AND dedupe_key = ?`,
    [tenantId, candidate.dedupeKey]
  );

  if (existing) {
    await db.query(
      `UPDATE notificaciones SET
         type = ?, title = ?, body = ?, channel = ?,
         action_label = ?, action_href = ?, event_at = ?, ruc = ?,
         updated_at = NOW()
       WHERE id = ?`,
      [
        candidate.type,
        candidate.title,
        candidate.body,
        candidate.channel,
        candidate.actionLabel || null,
        candidate.actionHref || null,
        candidate.at,
        userRuc,
        existing.id,
      ]
    );
    return { id: existing.id, isNew: false };
  }

  const id = randomUUID();
  if (usesPostgres()) {
    await db.query(
      `INSERT INTO notificaciones
         (id, tenant_id, ruc, dedupe_key, type, title, body, channel, unread,
          action_label, action_href, event_at, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, NOW(), NOW())`,
      [
        id,
        tenantId,
        userRuc,
        candidate.dedupeKey,
        candidate.type,
        candidate.title,
        candidate.body,
        candidate.channel,
        candidate.unread,
        candidate.actionLabel || null,
        candidate.actionHref || null,
        candidate.at,
      ]
    );
  } else {
    await db.query(
      `INSERT INTO notificaciones
         (id, tenant_id, ruc, dedupe_key, type, title, body, channel, unread,
          action_label, action_href, event_at, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(3), NOW(3))`,
      [
        id,
        tenantId,
        userRuc,
        candidate.dedupeKey,
        candidate.type,
        candidate.title,
        candidate.body,
        candidate.channel,
        candidate.unread ? 1 : 0,
        candidate.actionLabel || null,
        candidate.actionHref || null,
        candidate.at,
      ]
    );
  }
  return { id, isNew: true };
}

async function deliverExternal(
  tenantId: string,
  userRuc: string,
  candidate: NotificationCandidate,
  notificationId: string,
  prefs: ChannelPrefs
): Promise<void> {
  if (candidate.channel === 'WhatsApp' && prefs.whatsapp) {
    const sent = await sendWhatsAppAlert(
      tenantId,
      userRuc,
      `*${candidate.title}*\n${candidate.body}`,
      candidate.type === 'alerta' || candidate.type === 'vencimiento' ? 'generacion' : 'documentos'
    );
    if (sent) {
      await db.query(`UPDATE notificaciones SET delivered_at = NOW(), updated_at = NOW() WHERE id = ?`, [
        notificationId,
      ]);
    }
    return;
  }

  if (candidate.channel === 'Email' && prefs.email && smtpConfigured()) {
    const emisor = await db.queryOne<{ razon_social: string | null }>(
      `SELECT razon_social FROM emisores WHERE ruc = ? AND tenant_id = ? AND activo = true`,
      [userRuc, tenantId]
    );
    const usuario = await db.queryOne<{ email: string }>(
      `SELECT email FROM usuarios WHERE tenant_id = ? ORDER BY created_at ASC LIMIT 1`,
      [tenantId]
    );
    if (!usuario?.email) return;

    const nodemailer = await import('nodemailer');
    const transporter = nodemailer.default.createTransport({
      host: process.env.SMTP_HOST,
      port: parseInt(process.env.SMTP_PORT || '587', 10),
      secure: process.env.SMTP_SECURE === 'true',
      auth: process.env.SMTP_USER
        ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS }
        : undefined,
    });

    await transporter.sendMail({
      to: usuario.email,
      subject: `[OFSERCONT] ${candidate.title}`,
      text: `${candidate.body}\n\n${candidate.actionHref ? `Acción: ${process.env.NEXT_PUBLIC_APP_URL || ''}${candidate.actionHref}` : ''}\n\nEmisor: ${emisor?.razon_social || userRuc}`,
    });

    await db.query(`UPDATE notificaciones SET delivered_at = NOW(), updated_at = NOW() WHERE id = ?`, [
      notificationId,
    ]);
  }
}

/**
 * Sincroniza candidatos a BD y retorna notificaciones persistidas del tenant.
 */
export async function syncAndListNotifications(
  userRuc: string,
  tenantId: string,
  emisor?: {
    certificado_valido_hasta?: string | Date | null;
    cert_valido_hasta?: string | Date | null;
    whatsapp_estado?: string | null;
    notif_documentos?: boolean | number | null;
    notif_generacion?: boolean | number | null;
    notif_email?: boolean | number | null;
  } | null,
  range?: { fechaDesde?: string; fechaHasta?: string }
): Promise<{ notifications: AppNotification[]; prefs: ChannelPrefs; channelsActive: number }> {
  const prefs: ChannelPrefs = {
    app: emisor ? Boolean(emisor.notif_documentos) : true,
    email: emisor ? Boolean(emisor.notif_email) && smtpConfigured() : false,
    whatsapp: emisor ? Boolean(emisor.notif_generacion) : false,
  };

  const candidates = await buildNotificationCandidates(userRuc, tenantId, emisor, range);

  for (const candidate of candidates) {
    if (candidate.channel === 'App' && !prefs.app) continue;
    if (candidate.channel === 'Email' && !prefs.email) continue;
    if (candidate.channel === 'WhatsApp' && !prefs.whatsapp) continue;

    const { id, isNew } = await upsertNotification(tenantId, userRuc, candidate);
    if (isNew && candidate.channel !== 'App') {
      await deliverExternal(tenantId, userRuc, candidate, id, prefs);
    }
  }

  const conditions = ['tenant_id = ?'];
  const params: (string | number)[] = [tenantId];

  if (range?.fechaDesde) {
    conditions.push('event_at >= ?');
    params.push(`${range.fechaDesde}T00:00:00`);
  }
  if (range?.fechaHasta) {
    conditions.push('event_at <= ?');
    params.push(`${range.fechaHasta}T23:59:59`);
  }

  const enabledChannels: NotificationChannel[] = [];
  if (prefs.app) enabledChannels.push('App');
  if (prefs.email) enabledChannels.push('Email');
  if (prefs.whatsapp) enabledChannels.push('WhatsApp');

  if (enabledChannels.length === 0) {
    return { notifications: [], prefs, channelsActive: 0 };
  }

  const channelPlaceholders = enabledChannels.map(() => '?').join(', ');
  conditions.push(`channel IN (${channelPlaceholders})`);
  params.push(...enabledChannels);

  const rows = await db.queryAll<any>(
    `SELECT id, type, title, body, channel, unread, action_label, action_href, event_at
     FROM notificaciones
     WHERE ${conditions.join(' AND ')}
     ORDER BY event_at DESC
     LIMIT 100`,
    params
  );

  // cert-expira siempre visible si existe aunque quede fuera del rango
  if (range?.fechaDesde || range?.fechaHasta) {
    const certRows = await db.queryAll<any>(
      `SELECT id, type, title, body, channel, unread, action_label, action_href, event_at
       FROM notificaciones
       WHERE tenant_id = ? AND dedupe_key LIKE 'cert-expira%' AND channel IN (${channelPlaceholders})`,
      [tenantId, ...enabledChannels]
    );
    for (const cert of certRows) {
      if (!rows.some((r) => r.id === cert.id)) {
        rows.unshift(cert);
      }
    }
  }

  return {
    notifications: rows.map(rowToAppNotification),
    prefs,
    channelsActive: enabledChannels.length,
  };
}

export async function markNotificationsRead(
  tenantId: string,
  opts: { ids?: string[]; all?: boolean }
): Promise<number> {
  if (opts.all) {
    const result = await db.query(
      `UPDATE notificaciones SET unread = ${usesPostgres() ? 'false' : '0'}, updated_at = NOW()
       WHERE tenant_id = ? AND unread = ${usesPostgres() ? 'true' : '1'}`,
      [tenantId]
    );
    return result.rowCount;
  }

  const ids = (opts.ids || []).filter(Boolean);
  if (ids.length === 0) return 0;

  const placeholders = ids.map(() => '?').join(', ');
  const result = await db.query(
    `UPDATE notificaciones SET unread = ${usesPostgres() ? 'false' : '0'}, updated_at = NOW()
     WHERE tenant_id = ? AND id IN (${placeholders})`,
    [tenantId, ...ids]
  );
  return result.rowCount;
}

export { smtpConfigured };
