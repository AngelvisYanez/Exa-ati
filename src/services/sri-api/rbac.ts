import { NextResponse } from "next/server";
import { db } from "@/services/sri-api/db";
import type { JwtPayload } from "@/services/sri-api/auth-helper";
import {
  DEFAULT_USER_MODULES,
  type ModuleCode,
  isModuleCode,
} from "@/lib/modules-catalog";

const CACHE_TTL_MS = 30_000;
const modulosCache = new Map<string, { modulos: string[]; expiresAt: number }>();

export function invalidateRolModulosCache(rolCodigo?: string) {
  if (rolCodigo) {
    modulosCache.delete(rolCodigo);
  } else {
    modulosCache.clear();
  }
}

export async function getModulosForRol(rolCodigo: string): Promise<string[]> {
  if (rolCodigo === "SUPERADMIN") {
    const all = await db.queryAll<{ codigo: string }>(
      `SELECT codigo FROM modulos WHERE activo = true ORDER BY orden`
    );
    if (all.length > 0) return all.map((m) => m.codigo);
    // Fallback si tablas aún no existen
    return [...DEFAULT_USER_MODULES, "emitir", "pos", "ecommerce", "inventario", "admin", "admin.roles", "admin.empresas"];
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
      return [...DEFAULT_USER_MODULES, "emitir", "pos", "ecommerce", "inventario", "guias-remision",
        "cuentas-por-cobrar", "cuentas-por-pagar", "transportistas", "control-tributario",
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

export async function requireModule(
  user: JwtPayload,
  moduloCodigo: ModuleCode | string
): Promise<void> {
  if (!isModuleCode(moduloCodigo) && !moduloCodigo) {
    throw new Error("Acceso denegado: módulo inválido");
  }
  const ok = await rolHasModule(user.rol, moduloCodigo);
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
