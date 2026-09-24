/** Códigos estables de módulos de la aplicación (sidebar + APIs). */
export const MODULE_CODES = [
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
  "admin.empresas",
  "configuracion",
] as const;

export type ModuleCode = (typeof MODULE_CODES)[number];

export function isModuleCode(value: string): value is ModuleCode {
  return (MODULE_CODES as readonly string[]).includes(value);
}

/**
 * Resuelve el módulo a partir de una ruta de página (pathname).
 * Coincide el prefijo más largo.
 */
const PATH_TO_MODULE: { prefix: string; modulo: ModuleCode }[] = [
  { prefix: "/admin/roles", modulo: "admin.roles" },
  { prefix: "/admin/empresas", modulo: "admin.empresas" },
  { prefix: "/admin", modulo: "admin" },
  { prefix: "/documentos", modulo: "documentos" },
  { prefix: "/comprobantes", modulo: "comprobantes" },
  { prefix: "/emitir", modulo: "emitir" },
  { prefix: "/pos", modulo: "pos" },
  { prefix: "/ecommerce", modulo: "ecommerce" },
  { prefix: "/inventario", modulo: "inventario" },
  { prefix: "/guias-remision", modulo: "guias-remision" },
  { prefix: "/contabilidad", modulo: "contabilidad" },
  { prefix: "/contactos", modulo: "contactos" },
  { prefix: "/cuentas-por-cobrar", modulo: "cuentas-por-cobrar" },
  { prefix: "/cuentas-por-pagar", modulo: "cuentas-por-pagar" },
  { prefix: "/transportistas", modulo: "transportistas" },
  { prefix: "/control-tributario", modulo: "control-tributario" },
  { prefix: "/declaraciones", modulo: "declaraciones" },
  { prefix: "/nomina", modulo: "nomina" },
  { prefix: "/chat", modulo: "chat" },
  { prefix: "/auditoria", modulo: "auditoria-ia" },
  { prefix: "/notificaciones", modulo: "notificaciones" },
  { prefix: "/configuracion", modulo: "configuracion" },
  { prefix: "/", modulo: "dashboard" },
];

export function moduleFromPath(pathname: string): ModuleCode | null {
  const path = pathname.split("?")[0] || "/";
  for (const entry of PATH_TO_MODULE) {
    if (entry.prefix === "/") {
      if (path === "/" || path === "") return entry.modulo;
      continue;
    }
    if (path === entry.prefix || path.startsWith(entry.prefix + "/")) {
      return entry.modulo;
    }
  }
  return null;
}

/** Prefijos de API → módulo requerido */
const API_PREFIX_TO_MODULE: { prefix: string; modulo: ModuleCode }[] = [
  { prefix: "/api/admin/roles", modulo: "admin.roles" },
  { prefix: "/api/admin/modulos", modulo: "admin.roles" },
  { prefix: "/api/admin/tenants", modulo: "admin.empresas" },
  { prefix: "/api/admin", modulo: "admin" },
  { prefix: "/api/sri/emitir", modulo: "emitir" },
  { prefix: "/api/sri/pos", modulo: "pos" },
  { prefix: "/api/ecommerce", modulo: "ecommerce" },
  { prefix: "/api/inventario", modulo: "inventario" },
  { prefix: "/api/guias-remision", modulo: "guias-remision" },
  { prefix: "/api/contabilidad", modulo: "contabilidad" },
  { prefix: "/api/asientos", modulo: "contabilidad" },
  { prefix: "/api/contactos", modulo: "contactos" },
  { prefix: "/api/cuentas-por-cobrar", modulo: "cuentas-por-cobrar" },
  { prefix: "/api/cuentas-por-pagar", modulo: "cuentas-por-pagar" },
  { prefix: "/api/transportistas", modulo: "transportistas" },
  { prefix: "/api/control-tributario", modulo: "control-tributario" },
  { prefix: "/api/declaraciones", modulo: "declaraciones" },
  { prefix: "/api/ats", modulo: "declaraciones" },
  { prefix: "/api/nomina", modulo: "nomina" },
  { prefix: "/api/empleados", modulo: "nomina" },
  { prefix: "/api/chat", modulo: "chat" },
  { prefix: "/api/auditoria", modulo: "auditoria-ia" },
  { prefix: "/api/notificaciones", modulo: "notificaciones" },
];

export function moduleFromApiPath(pathname: string): ModuleCode | null {
  const path = pathname.split("?")[0] || "";
  for (const entry of API_PREFIX_TO_MODULE) {
    if (path === entry.prefix || path.startsWith(entry.prefix + "/")) {
      return entry.modulo;
    }
  }
  return null;
}

/** Módulos que USER tenía por defecto (items sin roles en sidebar). */
export const DEFAULT_USER_MODULES: ModuleCode[] = [
  "dashboard",
  "documentos",
  "comprobantes",
  "contabilidad",
  "contactos",
  "chat",
  "notificaciones",
  "configuracion",
];
