import { NextResponse } from "next/server";
import { db } from "@/services/sri-api/db";
import type { JwtPayload } from "@/services/sri-api/auth-helper";
import {
  DEFAULT_USER_MODULES,
  type ModuleCode,
  isModuleCode,
} from "@/lib/modules-catalog";
import {
  DEFAULT_PLAN,
  intersectModulesWithPlan,
  type PlanCode,
} from "@/lib/plans";
import { resolvePlan, invalidatePlanDefinitionsCache } from "@/services/sri-api/plans-service";
import { getPlanCodigoForTenant } from "@/services/sri-api/membership";

const CACHE_TTL_MS = 30_000;
const modulosCache = new Map<string, { modulos: string[]; expiresAt: number }>();
const planCache = new Map<string, { plan: PlanCode; expiresAt: number }>();

export function invalidateRolModulosCache(rolCodigo?: string) {
  if (rolCodigo) {
    modulosCache.delete(rolCodigo);
  } else {
    modulosCache.clear();
  }
}

export function invalidatePlanCache(tenantId?: string) {
  if (tenantId) planCache.delete(tenantId);
  else planCache.clear();
  invalidatePlanDefinitionsCache();
}

/** Plan vía cuenta de billing del tenant (fallback: columna tenant). */
export async function getPlanForTenant(
  tenantId: string | null | undefined
): Promise<PlanCode> {
  if (!tenantId) return DEFAULT_PLAN;
  const cached = planCache.get(tenantId);
  if (cached && cached.expiresAt > Date.now()) return cached.plan;

  try {
    const planCodigo = await getPlanCodigoForTenant(tenantId);
    planCache.set(tenantId, { plan: planCodigo, expiresAt: Date.now() + CACHE_TTL_MS });
    return planCodigo;
  } catch (err) {
    console.warn("[rbac] getPlanForTenant fallback:", err);
    return DEFAULT_PLAN;
  }
}

/**
 * Módulos efectivos = rol ∩ plan (plan desde DB).
 * SUPERADMIN bypassa el plan (acceso total).
 */
export async function getEffectiveModules(
  rolCodigo: string,
  tenantId: string | null | undefined
): Promise<{ modulos: string[]; planCodigo: PlanCode }> {
  const rolModulos = await getModulosForRol(rolCodigo);
  const planCodigo = await getPlanForTenant(tenantId);
  if (rolCodigo === "SUPERADMIN") {
    return { modulos: rolModulos, planCodigo };
  }
  const plan = await resolvePlan(planCodigo);
  return {
    modulos: intersectModulesWithPlan(rolModulos, plan),
    planCodigo: plan.codigo,
  };
}

/** Opción 2: 1 RUC por empresa (tenant). Más empresas = nuevo tenant bajo la cuenta. */
export async function assertCanAddEmisor(tenantId: string): Promise<void> {
  const row = await db.queryOne<{ c: string | number }>(
    `SELECT COUNT(*) AS c FROM emisores WHERE tenant_id = $1 AND activo = true`,
    [tenantId]
  );
  const count = Number(row?.c ?? 0);
  if (count >= 1) {
    throw new Error(
      "Esta empresa ya tiene un RUC vinculado. Para otra empresa, usa «Añadir empresa» (cupo según tu plan)."
    );
  }
}

export async function getModulosForRol(rolCodigo: string): Promise<string[]> {
  if (rolCodigo === "SUPERADMIN") {
    const all = await db.queryAll<{ codigo: string }>(
      `SELECT codigo FROM modulos WHERE activo = true ORDER BY orden`
    );
    if (all.length > 0) return all.map((m) => m.codigo);
    // Fallback si tablas aún no existen
    return [...DEFAULT_USER_MODULES, "emitir", "pos", "ecommerce", "inventario", "admin", "admin.roles", "admin.empresas", "admin.planes", "admin.metodos-pago", "admin.emails"];
  }

  const cached = modulosCache.get(rolCodigo);
  if (cached && cached.expiresAt > Date.now()) {
    return cached.modulos;
  }

  try {
    const rows = await db.queryAll<{ modulo_codigo: string }>(
      `SELECT rm.modulo_codigo
       FROM rol_modulos rm
       INNER JOIN modulos m ON m.codigo = rm.modulo_codigo AND m.activo = true
       INNER JOIN roles r ON r.codigo = rm.rol_codigo AND r.activo = true
       WHERE rm.rol_codigo = $1
       ORDER BY m.orden`,
      [rolCodigo]
    );
    const modulos = rows.map((r) => r.modulo_codigo);
    modulosCache.set(rolCodigo, { modulos, expiresAt: Date.now() + CACHE_TTL_MS });
    return modulos;
  } catch (err) {
    console.warn("[rbac] getModulosForRol fallback:", err);
    if (rolCodigo === "ADMIN") {
      return [...DEFAULT_USER_MODULES, "ecommerce", "guias-remision", "contabilidad",
        "comprobantes", "transportistas", "control-tributario",
        "declaraciones", "nomina", "auditoria-ia", "admin", "admin.roles"];
    }
    return [...DEFAULT_USER_MODULES];
  }
}

export async function rolHasModule(rolCodigo: string, moduloCodigo: string): Promise<boolean> {
  if (rolCodigo === "SUPERADMIN") return true;
  const modulos = await getModulosForRol(rolCodigo);
  if (modulos.includes(moduloCodigo)) return true;
  // admin.roles implica acceso admin genérico al listar roles
  if (moduloCodigo === "admin" && modulos.includes("admin.roles")) return true;
  return false;
}

/** Rol ∩ plan. Preferir sobre rolHasModule en rutas de producto. */
export async function userHasModule(
  user: JwtPayload,
  moduloCodigo: string
): Promise<boolean> {
  if (user.rol === "SUPERADMIN") return true;
  const { modulos } = await getEffectiveModules(user.rol, user.tenantId);
  if (modulos.includes(moduloCodigo)) return true;
  if (moduloCodigo === "admin" && modulos.includes("admin.roles")) return true;
  return false;
}

export async function requireModule(
  user: JwtPayload,
  moduloCodigo: ModuleCode | string
): Promise<void> {
  if (!isModuleCode(moduloCodigo) && !moduloCodigo) {
    throw new Error("Acceso denegado: módulo inválido");
  }
  const ok = await userHasModule(user, moduloCodigo);
  if (!ok) {
    throw new Error(`Acceso denegado: se requiere módulo ${moduloCodigo}`);
  }
}

/** Gestionar roles: necesita admin.roles (o SUPERADMIN). */
export async function requireManageRoles(user: JwtPayload): Promise<void> {
  if (user.rol === "SUPERADMIN") return;
  const ok = await rolHasModule(user.rol, "admin.roles");
  if (!ok) {
    // Fallback legacy: ADMIN sin tablas aún
    if (user.rol === "ADMIN") return;
    throw new Error("Acceso denegado: se requiere módulo admin.roles");
  }
}

export function canEditSystemRoles(user: JwtPayload): boolean {
  return user.rol === "SUPERADMIN";
}

export function forbiddenResponse(message = "Acceso denegado") {
  return NextResponse.json({ message }, { status: 403 });
}

export async function listActiveRoles(): Promise<
  { codigo: string; nombre: string; esSistema: boolean; activo: boolean }[]
> {
  try {
    const rows = await db.queryAll<{
      codigo: string;
      nombre: string;
      es_sistema: boolean;
      activo: boolean;
    }>(`SELECT codigo, nombre, es_sistema, activo FROM roles WHERE activo = true ORDER BY es_sistema DESC, nombre`);
    return rows.map((r) => ({
      codigo: r.codigo,
      nombre: r.nombre,
      esSistema: Boolean(r.es_sistema),
      activo: Boolean(r.activo),
    }));
  } catch {
    return [
      { codigo: "USER", nombre: "Usuario", esSistema: true, activo: true },
      { codigo: "ADMIN", nombre: "Administrador", esSistema: true, activo: true },
      { codigo: "SUPERADMIN", nombre: "Superadministrador", esSistema: true, activo: true },
    ];
  }
}

export async function isValidActiveRol(codigo: string): Promise<boolean> {
  try {
    const row = await db.queryOne<{ codigo: string }>(
      `SELECT codigo FROM roles WHERE codigo = $1 AND activo = true`,
      [codigo]
    );
    return Boolean(row);
  } catch {
    return ["USER", "ADMIN", "SUPERADMIN"].includes(codigo);
  }
}
