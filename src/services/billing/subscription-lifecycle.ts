import { db } from "@/services/sri-api/db";
import { invalidatePlanCache } from "@/services/sri-api/rbac";
import { VENCIDO_ALLOWED_PREFIXES as UI_VENCIDO_PREFIXES } from "@/lib/subscription-access";

export type PlanEstado = "pendiente" | "activo" | "gracia" | "vencido" | "cancelado";

export interface CuentaBillingStatus {
  cuentaId: string;
  planCodigo: string;
  planPeriodo: string;
  planEstado: PlanEstado;
  planVigenteHasta: Date | null;
  planOrigen: string | null;
  daysRemaining: number | null;
}

function asEstado(v: string | null | undefined): PlanEstado {
  if (
    v === "pendiente" ||
    v === "gracia" ||
    v === "vencido" ||
    v === "cancelado" ||
    v === "activo"
  ) {
    return v;
  }
  return "activo";
}

/** Estado de billing de la cuenta ligada al tenant. */
export async function getBillingStatusForTenant(
  tenantId: string
): Promise<CuentaBillingStatus | null> {
  try {
    const row = await db.queryOne<{
      cuenta_id: string;
      plan_codigo: string;
      plan_periodo: string;
      plan_estado: string | null;
      plan_vigente_hasta: Date | string | null;
      plan_origen: string | null;
    }>(
      `SELECT c.id AS cuenta_id, c.plan_codigo, c.plan_periodo,
              c.plan_estado, c.plan_vigente_hasta, c.plan_origen
       FROM tenants t
       INNER JOIN cuentas c ON c.id = t.cuenta_id
       WHERE t.id = $1`,
      [tenantId]
    );
    if (!row) return null;

    const vigente = row.plan_vigente_hasta
      ? new Date(row.plan_vigente_hasta)
      : null;
    let daysRemaining: number | null = null;
    if (vigente) {
      daysRemaining = Math.ceil(
        (vigente.getTime() - Date.now()) / (24 * 60 * 60 * 1000)
      );
    }

    // Origen manual sin fecha = sin bloqueo por vencimiento
    let estado = asEstado(row.plan_estado);
    if (
      vigente &&
      vigente.getTime() < Date.now() &&
      estado === "activo" &&
      row.plan_origen === "payphone"
    ) {
      estado = "vencido";
    }

    return {
      cuentaId: row.cuenta_id,
      planCodigo: row.plan_codigo,
      planPeriodo: row.plan_periodo,
      planEstado: estado,
      planVigenteHasta: vigente,
      planOrigen: row.plan_origen,
      daysRemaining,
    };
  } catch {
    return null;
  }
}

/** Rutas UI + APIs permitidas con plan vencido (renovar / auth / config). */
export const VENCIDO_ALLOWED_PREFIXES = [
  ...UI_VENCIDO_PREFIXES,
  "/api/billing",
  "/api/auth",
  "/api/notificaciones",
];

export function isPathAllowedWhenVencido(pathname: string): boolean {
  return VENCIDO_ALLOWED_PREFIXES.some(
    (p) => pathname === p || pathname.startsWith(`${p}/`)
  );
}


/**
 * Cron: marca vencidos, crea notificaciones T-7/T-3/T-1.
 */
export async function processSubscriptionLifecycle(): Promise<{
  markedVencido: number;
  notifications: number;
}> {
  let markedVencido = 0;
  let notifications = 0;

  // Marcar vencidos (solo payphone con fecha)
  try {
    const res = await db.query<{ id: string }>(
      `UPDATE cuentas
       SET plan_estado = 'vencido', updated_at = NOW()
       WHERE plan_origen = 'payphone'
         AND plan_vigente_hasta IS NOT NULL
         AND plan_vigente_hasta < NOW()
         AND plan_estado IN ('activo', 'gracia')
       RETURNING id`
    );
    markedVencido = res.rowCount || res.rows?.length || 0;
    if (markedVencido > 0) {
      await db.query(
        `UPDATE tenants t
         SET plan_estado = 'vencido', updated_at = NOW()
         FROM cuentas c
         WHERE t.cuenta_id = c.id AND c.plan_estado = 'vencido'`
      );
      invalidatePlanCache();
    }
  } catch (err) {
    console.warn("[suscripciones] mark vencido:", err);
  }

  // Recordatorios 7, 3, 1 días
  const windows = [7, 3, 1] as const;
  for (const days of windows) {
    try {
      const rows = await db.queryAll<{
        cuenta_id: string;
        tenant_id: string;
        plan_codigo: string;
        plan_vigente_hasta: Date | string;
        owner_usuario_id: string | null;
      }>(
        `SELECT c.id AS cuenta_id, t.id AS tenant_id, c.plan_codigo,
                c.plan_vigente_hasta, c.owner_usuario_id
         FROM cuentas c
         INNER JOIN tenants t ON t.cuenta_id = c.id AND t.activo = true
         WHERE c.plan_origen = 'payphone'
           AND c.plan_estado = 'activo'
           AND c.plan_vigente_hasta IS NOT NULL
           AND c.plan_vigente_hasta::date = (CURRENT_DATE + $1::int)`,
        [days]
      );

      for (const row of rows) {
        const dedupeKey = `suscripcion-vence-${days}d-${row.cuenta_id}-${String(row.plan_vigente_hasta).slice(0, 10)}`;
        const title =
          days === 1
            ? "Tu suscripción vence mañana"
            : `Tu suscripción vence en ${days} días`;
        const body = `Renueva tu plan ${row.plan_codigo} para no perder acceso al panel.`;
        try {
          await db.query(
            `INSERT INTO notificaciones
               (tenant_id, dedupe_key, type, title, body, channel, unread, action_label, action_href, event_at)
             VALUES ($1, $2, 'suscripcion', $3, $4, 'in_app', true, 'Renovar', '/suscripcion', NOW())
             ON CONFLICT (tenant_id, dedupe_key) DO NOTHING`,
            [row.tenant_id, dedupeKey, title, body]
          );
          notifications += 1;
        } catch (err) {
          console.warn("[suscripciones] notif:", err);
        }
      }
    } catch (err) {
      console.warn(`[suscripciones] window ${days}d:`, err);
    }
  }

  return { markedVencido, notifications };
}
