import type { ModuleCode } from "@/lib/modules-catalog";

/** Códigos de plan de sistema (seed). Se pueden crear planes custom en admin. */
export const SYSTEM_PLAN_CODES = ["emprendedor", "contador", "despacho"] as const;
export type SystemPlanCode = (typeof SYSTEM_PLAN_CODES)[number];

/** @deprecated Prefer SYSTEM_PLAN_CODES; se mantiene por compatibilidad. */
export const PLAN_CODES = SYSTEM_PLAN_CODES;
export type PlanCode = string;

export const DEFAULT_PLAN: SystemPlanCode = "emprendedor";

export interface PlanDefinition {
  codigo: string;
  nombre: string;
  descripcion: string;
  maxEmpresas: number;
  modulos: readonly string[];
  precioMensual: number;
  precioAnual: number | null;
  moneda: string;
  orden: number;
  activo: boolean;
  esSistema: boolean;
}

/**
 * Fallback estático si la tabla planes_suscripcion aún no existe.
 * La fuente de verdad en runtime es la DB (admin / planes).
 */
export const FALLBACK_PLANS: Record<SystemPlanCode, PlanDefinition> = {
  emprendedor: {
    codigo: "emprendedor",
    nombre: "Emprendedor",
    descripcion:
      "Opera tu negocio: facturación, cobros, inventario y chat. Sin declaraciones al SRI.",
    maxEmpresas: 1,
    precioMensual: 19,
    precioAnual: 190,
    moneda: "USD",
    orden: 10,
    activo: true,
    esSistema: true,
    modulos: [
      "dashboard",
      "documentos",
      "emitir",
      "pos",
      "inventario",
      "contactos",
      "cuentas-por-cobrar",
      "cuentas-por-pagar",
      "chat",
      "notificaciones",
      "configuracion",
    ],
  },
  contador: {
    codigo: "contador",
    nombre: "Contador",
    descripcion:
      "Hasta 3 empresas con sync SRI, ATS, control tributario y contabilidad.",
    maxEmpresas: 3,
    precioMensual: 49,
    precioAnual: 490,
    moneda: "USD",
    orden: 20,
    activo: true,
    esSistema: true,
    modulos: [
      "dashboard",
      "documentos",
      "comprobantes",
      "emitir",
      "pos",
      "ecommerce",
      "inventario",
      "guias-remision",
      "contabilidad",
      "contactos",
      "cuentas-por-cobrar",
      "cuentas-por-pagar",
      "transportistas",
      "control-tributario",
      "declaraciones",
      "chat",
      "notificaciones",
      "configuracion",
    ],
  },
  despacho: {
    codigo: "despacho",
    nombre: "Despacho",
    descripcion:
      "Hasta 5 empresas con nómina, auditoría IA y administración del equipo.",
    maxEmpresas: 5,
    precioMensual: 99,
    precioAnual: 990,
    moneda: "USD",
    orden: 30,
    activo: true,
    esSistema: true,
    modulos: [
      "dashboard",
      "documentos",
      "comprobantes",
      "emitir",
      "pos",
      "ecommerce",
      "inventario",
      "guias-remision",
      "contabilidad",
      "contactos",
      "cuentas-por-cobrar",
      "cuentas-por-pagar",
      "transportistas",
      "control-tributario",
      "declaraciones",
      "nomina",
      "chat",
      "auditoria-ia",
      "notificaciones",
      "admin",
      "admin.roles",
      "configuracion",
    ],
  },
};

/** @deprecated Use FALLBACK_PLANS */
export const PLANS = FALLBACK_PLANS;

export function isSystemPlanCode(
  value: string | null | undefined
): value is SystemPlanCode {
  return !!value && (SYSTEM_PLAN_CODES as readonly string[]).includes(value);
}

export function isPlanCode(value: string | null | undefined): value is string {
  return typeof value === "string" && /^[a-z][a-z0-9_-]{1,29}$/.test(value);
}

/** Sync fallback (tests / sin DB). Preferir resolvePlan() en servidor. */
export function getPlan(codigo: string | null | undefined): PlanDefinition {
  if (isSystemPlanCode(codigo)) return FALLBACK_PLANS[codigo];
  return FALLBACK_PLANS[DEFAULT_PLAN];
}

export function intersectModulesWithPlan(
  rolModulos: readonly string[],
  plan: PlanDefinition
): string[] {
  const planSet = new Set(plan.modulos);
  return rolModulos.filter((m) => planSet.has(m));
}

/** Intersección rol ∩ plan usando fallback estático. */
export function intersectModules(
  rolModulos: readonly string[],
  planCodigo: string | null | undefined
): string[] {
  return intersectModulesWithPlan(rolModulos, getPlan(planCodigo));
}

export function planAllowsModule(
  planCodigo: string | null | undefined,
  moduloCodigo: string
): boolean {
  return getPlan(planCodigo).modulos.includes(moduloCodigo as ModuleCode);
}

export function slugifyPlanCodigo(raw: string): string {
  return raw
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 30);
}
