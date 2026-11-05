import { db } from "@/services/sri-api/db";
import {
  DEFAULT_PLAN,
  FALLBACK_PLANS,
  getPlan,
  isSystemPlanCode,
  type PlanDefinition,
} from "@/lib/plans";

const CACHE_TTL_MS = 30_000;
const planDefCache = new Map<string, { plan: PlanDefinition; expiresAt: number }>();
let allPlansCache: { plans: PlanDefinition[]; expiresAt: number } | null = null;

export function invalidatePlanDefinitionsCache(codigo?: string) {
  if (codigo) planDefCache.delete(codigo);
  else planDefCache.clear();
  allPlansCache = null;
}

function rowToPlan(
  row: {
    codigo: string;
    nombre: string;
    descripcion: string | null;
    max_empresas: number | string;
    precio_mensual: number | string;
    precio_anual: number | string | null;
    moneda: string;
    orden: number;
    activo: boolean | number;
    es_sistema: boolean | number;
  },
  modulos: string[]
): PlanDefinition {
  return {
    codigo: row.codigo,
    nombre: row.nombre,
    descripcion: row.descripcion || "",
    maxEmpresas: Number(row.max_empresas) || 1,
    precioMensual: Number(row.precio_mensual) || 0,
    precioAnual:
      row.precio_anual === null || row.precio_anual === undefined
        ? null
        : Number(row.precio_anual),
    moneda: row.moneda || "USD",
    orden: Number(row.orden) || 0,
    activo: Boolean(row.activo),
    esSistema: Boolean(row.es_sistema),
    modulos,
  };
}

async function loadModulosForPlan(codigo: string): Promise<string[]> {
  const rows = await db.queryAll<{ modulo_codigo: string }>(
    `SELECT pm.modulo_codigo
     FROM plan_modulos pm
     INNER JOIN modulos m ON m.codigo = pm.modulo_codigo AND m.activo = true
     WHERE pm.plan_codigo = $1
     ORDER BY m.orden`,
    [codigo]
  );
  return rows.map((r) => r.modulo_codigo);
}

/** Resuelve un plan desde DB; fallback estático si falla o no existe. */
export async function resolvePlan(
  codigo: string | null | undefined
): Promise<PlanDefinition> {
  const key = codigo?.trim() || DEFAULT_PLAN;
  const cached = planDefCache.get(key);
  if (cached && cached.expiresAt > Date.now()) return cached.plan;

  try {
    const row = await db.queryOne<{
      codigo: string;
      nombre: string;
      descripcion: string | null;
      max_empresas: number | string;
      precio_mensual: number | string;
      precio_anual: number | string | null;
      moneda: string;
      orden: number;
      activo: boolean | number;
      es_sistema: boolean | number;
    }>(
      `SELECT codigo, nombre, descripcion, max_empresas, precio_mensual, precio_anual,
              moneda, orden, activo, es_sistema
       FROM planes_suscripcion WHERE codigo = $1`,
      [key]
    );

    if (row) {
      const modulos = await loadModulosForPlan(row.codigo);
      const plan = rowToPlan(row, modulos.length > 0 ? modulos : getPlan(row.codigo).modulos as string[]);
      planDefCache.set(key, { plan, expiresAt: Date.now() + CACHE_TTL_MS });
      return plan;
    }
  } catch (err) {
    console.warn("[plans] resolvePlan fallback:", err);
  }

  const fallback = getPlan(key);
  planDefCache.set(key, { plan: fallback, expiresAt: Date.now() + CACHE_TTL_MS });
  return fallback;
}

export async function listPlansFromDb(opts?: {
  includeInactive?: boolean;
}): Promise<PlanDefinition[]> {
  if (
    allPlansCache &&
    allPlansCache.expiresAt > Date.now() &&
    opts?.includeInactive
  ) {
    // cache only for active-default list; skip when includeInactive
  } else if (
    allPlansCache &&
    allPlansCache.expiresAt > Date.now() &&
    !opts?.includeInactive
  ) {
    return allPlansCache.plans;
  }

  try {
    const rows = await db.queryAll<{
      codigo: string;
      nombre: string;
      descripcion: string | null;
      max_empresas: number | string;
      precio_mensual: number | string;
      precio_anual: number | string | null;
      moneda: string;
      orden: number;
      activo: boolean | number;
      es_sistema: boolean | number;
    }>(
      `SELECT codigo, nombre, descripcion, max_empresas, precio_mensual, precio_anual,
              moneda, orden, activo, es_sistema
       FROM planes_suscripcion
       ${opts?.includeInactive ? "" : "WHERE activo = true"}
       ORDER BY orden ASC, nombre ASC`
    );

    const plans: PlanDefinition[] = [];
    for (const row of rows) {
      const modulos = await loadModulosForPlan(row.codigo);
      plans.push(rowToPlan(row, modulos));
    }

    if (!opts?.includeInactive) {
      allPlansCache = { plans, expiresAt: Date.now() + CACHE_TTL_MS };
    }
    if (plans.length > 0) return plans;
  } catch (err) {
    console.warn("[plans] listPlansFromDb fallback:", err);
  }

  return Object.values(FALLBACK_PLANS).sort((a, b) => a.orden - b.orden);
}

export async function countTenantsOnPlan(codigo: string): Promise<number> {
  try {
    const row = await db.queryOne<{ c: string | number }>(
      `SELECT (
         (SELECT COUNT(*) FROM tenants WHERE plan_codigo = $1) +
         (SELECT COUNT(*) FROM cuentas WHERE plan_codigo = $1)
       ) AS c`,
      [codigo]
    );
    return Number(row?.c ?? 0);
  } catch {
    try {
      const row = await db.queryOne<{ c: string | number }>(
        `SELECT COUNT(*) AS c FROM tenants WHERE plan_codigo = $1`,
        [codigo]
      );
      return Number(row?.c ?? 0);
    } catch {
      return 0;
    }
  }
}

export function assertValidModulos(modulos: unknown): string[] {
  if (!Array.isArray(modulos)) {
    throw new Error("modulos debe ser un arreglo");
  }
  const cleaned = [
    ...new Set(
      modulos
        .filter((m): m is string => typeof m === "string")
        .map((m) => m.trim())
        .filter(Boolean)
    ),
  ];
  return cleaned;
}

export { isSystemPlanCode };
