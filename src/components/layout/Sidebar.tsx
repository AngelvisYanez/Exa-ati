"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";
import { useSidebar } from "@/contexts/SidebarContext";
import {
  LayoutGrid,
  FileText,
  ScrollText,
  MessageSquare,
  ShieldCheck,
  PlusCircle,
  Receipt,
  Bell,
  Settings,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  LogOut,
  Building2,
  Truck,
  ShoppingCart,
  Calculator,
  Store,
  Package,
  Shield,
  Users,
  Landmark,
  HandCoins,
  Wallet,
} from "lucide-react";

type NavLeaf = {
  href: string;
  label: string;
  module?: string;
  roles?: string[];
};

type NavEntry =
  | ({ kind: "link"; icon: React.ReactNode } & NavLeaf)
  | {
      kind: "tree";
      label: string;
      icon: React.ReactNode;
      children: NavLeaf[];
    };

type NavGroup = {
  group: string;
  items: NavEntry[];
};

const navGroups: NavGroup[] = [
  {
    group: "PRINCIPAL",
    items: [
      {
        kind: "link",
        href: "/",
        label: "Dashboard",
        module: "dashboard",
        icon: <LayoutGrid className="w-[17px] h-[17px]" strokeWidth={1.8} />,
      },
      {
        kind: "link",
        href: "/documentos",
        label: "Documentos",
        module: "documentos",
        icon: <FileText className="w-[17px] h-[17px]" strokeWidth={1.8} />,
      },
      {
        kind: "link",
        href: "/comprobantes",
        label: "Comprobantes",
        module: "comprobantes",
        icon: <Receipt className="w-[17px] h-[17px]" strokeWidth={1.8} />,
      },
    ],
  },
  {
    group: "EMISIÓN",
    items: [
      {
        kind: "link",
        href: "/emitir",
        label: "Emitir",
        module: "emitir",
        roles: ["SUPERADMIN", "ADMIN"],
        icon: <PlusCircle className="w-[17px] h-[17px]" strokeWidth={1.8} />,
      },
      {
        kind: "link",
        href: "/pos",
        label: "Punto de Venta",
        module: "pos",
        roles: ["SUPERADMIN", "ADMIN"],
        icon: <ShoppingCart className="w-[17px] h-[17px]" strokeWidth={1.8} />,
      },
      {
        kind: "link",
        href: "/ecommerce",
        label: "eCommerce",
        module: "ecommerce",
        roles: ["SUPERADMIN", "ADMIN"],
        icon: <Store className="w-[17px] h-[17px]" strokeWidth={1.8} />,
      },
      {
        kind: "link",
        href: "/inventario",
        label: "Inventario",
        module: "inventario",
        roles: ["SUPERADMIN", "ADMIN"],
        icon: <Package className="w-[17px] h-[17px]" strokeWidth={1.8} />,
      },
      {
        kind: "link",
        href: "/guias-remision",
        label: "Guías de Remisión",
        module: "guias-remision",
        roles: ["SUPERADMIN", "ADMIN"],
        icon: <Truck className="w-[17px] h-[17px]" strokeWidth={1.8} />,
      },
    ],
  },
  {
    group: "CONTABILIDAD",
    items: [
      {
        kind: "tree",
        label: "Contabilidad",
        icon: <Calculator className="w-[17px] h-[17px]" strokeWidth={1.8} />,
        children: [
          {
            href: "/contabilidad",
            label: "Resumen",
            module: "contabilidad",
          },
          {
            href: "/contabilidad/diario",
            label: "Diario",
            module: "contabilidad",
            roles: ["SUPERADMIN", "ADMIN"],
          },
          {
            href: "/contabilidad/balance",
            label: "Balance",
            module: "contabilidad",
            roles: ["SUPERADMIN", "ADMIN"],
          },
          {
            href: "/contabilidad/plan-cuentas",
            label: "Plan de Cuentas",
            module: "contabilidad",
            roles: ["SUPERADMIN", "ADMIN"],
          },
          {
            href: "/contabilidad/impuestos",
            label: "Impuestos",
            module: "contabilidad",
            roles: ["SUPERADMIN", "ADMIN"],
          },
          {
            href: "/contabilidad/posiciones-fiscales",
            label: "Posiciones Fiscales",
            module: "contabilidad",
            roles: ["SUPERADMIN", "ADMIN"],
          },
        ],
      },
    ],
  },
  {
    group: "FINANZAS",
    items: [
      {
        kind: "link",
        href: "/contactos",
        label: "Contactos",
        module: "contactos",
        icon: <Building2 className="w-[17px] h-[17px]" strokeWidth={1.8} />,
      },
      {
        kind: "link",
        href: "/cuentas-por-cobrar",
        label: "Cuentas por Cobrar",
        module: "cuentas-por-cobrar",
        roles: ["SUPERADMIN", "ADMIN"],
        icon: <HandCoins className="w-[17px] h-[17px]" strokeWidth={1.8} />,
      },
      {
        kind: "link",
        href: "/cuentas-por-pagar",
        label: "Cuentas por Pagar",
        module: "cuentas-por-pagar",
        roles: ["SUPERADMIN", "ADMIN"],
        icon: <Wallet className="w-[17px] h-[17px]" strokeWidth={1.8} />,
      },
      {
        kind: "link",
        href: "/transportistas",
        label: "Transportistas",
        module: "transportistas",
        roles: ["SUPERADMIN", "ADMIN"],
        icon: <Truck className="w-[17px] h-[17px]" strokeWidth={1.8} />,
      },
    ],
  },
  {
    group: "DECLARACIONES",
    items: [
      {
        kind: "link",
        href: "/control-tributario",
        label: "Control Tributario",
        module: "control-tributario",
        roles: ["SUPERADMIN", "ADMIN"],
        icon: <Landmark className="w-[17px] h-[17px]" strokeWidth={1.8} />,
      },
      {
        kind: "tree",
        label: "Declaraciones",
        icon: <ScrollText className="w-[17px] h-[17px]" strokeWidth={1.8} />,
        children: [
          {
            href: "/declaraciones",
            label: "Resumen",
            module: "declaraciones",
            roles: ["SUPERADMIN", "ADMIN"],
          },
          {
            href: "/declaraciones/reportes",
            label: "Formularios 103/104",
            module: "declaraciones",
            roles: ["SUPERADMIN", "ADMIN"],
          },
          {
            href: "/declaraciones/ats",
            label: "ATS",
            module: "declaraciones",
            roles: ["SUPERADMIN", "ADMIN"],
          },
          {
            href: "/declaraciones/presentar",
            label: "Presentar al SRI",
            module: "declaraciones",
            roles: ["SUPERADMIN", "ADMIN"],
          },
        ],
      },
    ],
  },
  {
    group: "NÓMINA",
    items: [
      {
        kind: "tree",
        label: "Nómina",
        icon: <Users className="w-[17px] h-[17px]" strokeWidth={1.8} />,
        children: [
          {
            href: "/nomina/empleados",
            label: "Empleados",
            module: "nomina",
            roles: ["SUPERADMIN", "ADMIN"],
          },
          {
            href: "/nomina/roles",
            label: "Roles de pago",
            module: "nomina",
            roles: ["SUPERADMIN", "ADMIN"],
          },
          {
            href: "/nomina/formulario-107",
            label: "Formulario 107",
            module: "nomina",
            roles: ["SUPERADMIN", "ADMIN"],
          },
        ],
      },
    ],
  },
  {
    group: "INTELIGENCIA IA",
    items: [
      {
        kind: "link",
        href: "/chat",
        label: "Chat IA",
        module: "chat",
        icon: <MessageSquare className="w-[17px] h-[17px]" strokeWidth={1.8} />,
      },
      {
        kind: "link",
        href: "/auditoria",
        label: "Auditoría IA",
        module: "auditoria-ia",
        roles: ["SUPERADMIN", "ADMIN"],
        icon: <ShieldCheck className="w-[17px] h-[17px]" strokeWidth={1.8} />,
      },
    ],
  },
  {
    group: "CANALES",
    items: [
      {
        kind: "link",
        href: "/notificaciones",
        label: "Notificaciones",
        module: "notificaciones",
        icon: <Bell className="w-[17px] h-[17px]" strokeWidth={1.8} />,
      },
    ],
  },
  {
    group: "ADMINISTRACIÓN",
    items: [
      {
        kind: "tree",
        label: "Administración",
        icon: <Shield className="w-[17px] h-[17px]" strokeWidth={1.8} />,
        children: [
          {
            href: "/admin",
            label: "Resumen",
            module: "admin",
            roles: ["ADMIN", "SUPERADMIN"],
          },
          {
            href: "/admin/usuarios",
            label: "Usuarios",
            module: "admin",
            roles: ["ADMIN", "SUPERADMIN"],
          },
          {
            href: "/admin/roles",
            label: "Roles",
            module: "admin.roles",
            roles: ["ADMIN", "SUPERADMIN"],
          },
          {
            href: "/admin/empresas",
            label: "Empresas",
            module: "admin.empresas",
            roles: ["SUPERADMIN"],
          },
          {
            href: "/admin/auditoria",
            label: "Auditoría",
            module: "admin",
            roles: ["ADMIN", "SUPERADMIN"],
          },
          {
            href: "/admin/pruebas",
            label: "Pruebas Diagnóstico",
            module: "admin",
            roles: ["ADMIN", "SUPERADMIN"],
          },
        ],
      },
    ],
  },
  {
    group: "SISTEMA",
    items: [
      {
        kind: "link",
        href: "/configuracion",
        label: "Configuración",
        module: "configuracion",
        icon: <Settings className="w-[17px] h-[17px]" strokeWidth={1.8} />,
      },
    ],
  },
];

type AuthUser = {
  rol: string;
  modulos?: string[] | null;
} | null;

function isAllowed(
  user: AuthUser,
  item: { module?: string; roles?: string[] }
): boolean {
  if (!user) return false;
  if (user.rol === "SUPERADMIN") return true;

  // Preferencia: módulos del rol (RBAC)
  if (user.modulos && user.modulos.length > 0) {
    if (!item.module) return true;
    return user.modulos.includes(item.module);
  }

  // Fallback legacy (antes de migrar tablas)
  if (!item.roles) return true;
  return item.roles.includes(user.rol);
}

function isRouteActive(
  pathname: string | null,
  href: string,
  siblings: string[]
): boolean {
  if (!pathname) return false;
  if (pathname === href) return true;
  if (href === "/" || !pathname.startsWith(href)) return false;
  // No marcar la página índice como activa si un hermano más profundo coincide
  const hasDeeperMatch = siblings.some(
    (o) => o !== href && o.startsWith(`${href}/`) && pathname.startsWith(o)
  );
  return !hasDeeperMatch;
}

function SidebarTree({
  node,
  pathname,
  collapsed,
  onNavigate,
}: {
  node: { label: string; icon: React.ReactNode; children: NavLeaf[] };
  pathname: string | null;
  collapsed: boolean;
  onNavigate: () => void;
}) {
  const childHrefs = node.children.map((c) => c.href);
  const containsActive = node.children.some((c) =>
    isRouteActive(pathname, c.href, childHrefs)
  );
  const [openOverride, setOpenOverride] = useState<boolean | null>(null);
  const [wasActive, setWasActive] = useState(containsActive);
  const [flyoutOpen, setFlyoutOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  // Al entrar a un módulo se resetea el override para auto-expandirlo
  if (wasActive !== containsActive) {
    setWasActive(containsActive);
    if (containsActive) setOpenOverride(null);
  }
  const open = openOverride ?? containsActive;

  useEffect(() => {
    if (!flyoutOpen) return;
    const handleOutside = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) {
        setFlyoutOpen(false);
      }
    };
    document.addEventListener("mousedown", handleOutside);
    return () => document.removeEventListener("mousedown", handleOutside);
  }, [flyoutOpen]);

  if (collapsed) {
    return (
      <div ref={rootRef} className="relative">
        <button
          type="button"
          onClick={() => setFlyoutOpen((v) => !v)}
          title={node.label}
          aria-expanded={flyoutOpen}
          className={`
            w-full py-2.5 flex justify-center rounded-lg transition-all duration-150 cursor-pointer
            ${
              containsActive
                ? "text-brand-red bg-brand-red-subtle"
                : "text-sidebar-foreground/75 hover:bg-sidebar-accent hover:text-sidebar-foreground"
            }
          `}
        >
          {node.icon}
        </button>
        {flyoutOpen && (
          <div className="absolute left-full ml-2 top-0 z-[60] min-w-[190px] bg-popover text-popover-foreground border border-sidebar-border rounded-lg shadow-lg p-1.5 flex flex-col gap-0.5 text-left">
            <span className="px-2 pt-1 pb-1.5 text-[9px] font-bold uppercase tracking-widest text-muted-foreground whitespace-nowrap">
              {node.label}
            </span>
            {node.children.map((leaf) => {
              const isActive = isRouteActive(pathname, leaf.href, childHrefs);
              return (
                <Link
                  key={leaf.href}
                  href={leaf.href}
                  onClick={() => {
                    setFlyoutOpen(false);
                    onNavigate();
                  }}
                  className={`
                    rounded-md px-2 py-1.5 text-[12px] whitespace-nowrap transition-colors duration-150
                    ${
                      isActive
                        ? "bg-brand-red text-white font-semibold"
                        : "hover:bg-sidebar-accent font-medium"
                    }
                  `}
                >
                  {leaf.label}
                </Link>
              );
            })}
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="flex flex-col">
      <button
        type="button"
        onClick={() => setOpenOverride(!open)}
        aria-expanded={open}
        className={`
          flex items-center gap-2.5 rounded-lg px-2.5 py-2 transition-all duration-150 w-full cursor-pointer
          ${
            containsActive
              ? "text-sidebar-foreground font-semibold bg-sidebar-accent/60"
              : "text-sidebar-foreground/75 hover:bg-sidebar-accent hover:text-sidebar-foreground font-medium"
          }
        `}
      >
        <span className="shrink-0">{node.icon}</span>
        <span className="text-[12.5px] truncate flex-1 text-left">
          {node.label}
        </span>
        <ChevronDown
          className={`
            w-3 h-3 shrink-0 text-muted-foreground transition-transform duration-200 ease-in-out
            ${open ? "rotate-180" : ""}
          `}
          strokeWidth={2.2}
        />
      </button>

      {/* Panel deslizante de hijos */}
      <div
        className={`
          grid transition-[grid-template-rows,opacity] duration-200 ease-in-out
          ${open ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0"}
        `}
      >
        <div className="overflow-hidden">
          <div className="ml-[18px] border-l border-sidebar-border pl-2 mt-0.5 mb-1 flex flex-col gap-0.5">
            {node.children.map((leaf) => {
              const isActive = isRouteActive(pathname, leaf.href, childHrefs);
              return (
                <Link
                  key={leaf.href}
                  href={leaf.href}
                  onClick={onNavigate}
                  className={`
                    rounded-md px-2 py-1.5 text-[12px] truncate transition-all duration-150
                    ${
                      isActive
                        ? "bg-brand-red text-white font-semibold shadow-xs hover:bg-brand-red-mid"
                        : "text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-foreground font-medium"
                    }
                  `}
                >
                  {leaf.label}
                </Link>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}

export default function Sidebar() {
  const pathname = usePathname();
  const { logout, user } = useAuth();
  const { collapsed, setCollapsed, mobileOpen, setMobileOpen } = useSidebar();

  const authUser: AuthUser = user
    ? { rol: user.rol, modulos: user.modulos ?? null }
    : null;

  const handleLogout = () => {
    logout();
    toast.info("Sesión cerrada correctamente");
  };

  const closeMobile = () => setMobileOpen(false);

  const allowedNavGroups = navGroups
    .map((group) => ({
      ...group,
      items: group.items
        .map((item) =>
          item.kind === "tree"
            ? {
                ...item,
                children: item.children.filter((c) => isAllowed(authUser, c)),
              }
            : item
        )
        .filter((item) =>
          item.kind === "tree"
            ? item.children.length > 0
            : isAllowed(authUser, item)
        ),
    }))
    .filter((group) => group.items.length > 0);

  const sidebarWidth = collapsed ? "w-14" : "w-60";

  return (
    <>
      <aside
        className={`
          ${sidebarWidth} bg-sidebar border-r border-sidebar-border
          h-screen flex flex-col fixed top-0 left-0 z-50
          transition-all duration-200 ease-in-out select-none
          md:translate-x-0 ${mobileOpen ? "translate-x-0" : "-translate-x-full"}
        `}
      >
        {/* HEADER: logo + collapse */}
        <div className="h-14 flex items-center justify-center px-3 border-b border-sidebar-border shrink-0 relative">
          {collapsed ? (
            <Image
              src="/favicon.png"
              alt="exa — Asistente Tributario Inteligente"
              width={28}
              height={28}
              priority
              className="size-7 object-contain"
            />
          ) : (
            <Image
              src="/exa-ati.png"
              alt="exa — Asistente Tributario Inteligente"
              width={160}
              height={32}
              quality={100}
              priority
              className="h-8 w-auto max-w-[168px] object-contain object-left"
            />
          )}
          <button
            onClick={() => setCollapsed(!collapsed)}
            className="hidden md:flex absolute -right-3 top-1/2 -translate-y-1/2 w-5 h-7 bg-sidebar border border-sidebar-border rounded-r-md text-muted-foreground hover:text-sidebar-foreground items-center justify-center transition-colors duration-150 cursor-pointer shadow-sm z-10"
            title={collapsed ? "Expandir menú" : "Colapsar menú"}
          >
            {collapsed ? (
              <ChevronRight className="w-2.5 h-2.5" strokeWidth={2.5} />
            ) : (
              <ChevronLeft className="w-2.5 h-2.5" strokeWidth={2.5} />
            )}
          </button>
        </div>

        <nav className="flex-1 py-2 flex flex-col overflow-y-auto overflow-x-hidden">
          {allowedNavGroups.map((group, gi) => (
            <div key={gi} className="flex flex-col">
              {!collapsed && (
                <span className="px-4 pt-4 pb-1 text-[9px] font-bold text-muted-foreground tracking-widest uppercase">
                  {group.group}
                </span>
              )}
              {collapsed && gi > 0 && <div className="mx-3 my-2 h-px bg-sidebar-border" />}

              <div className="flex flex-col gap-0.5 px-1.5">
                {group.items.map((item) => {
                  if (item.kind === "tree") {
                    return (
                      <SidebarTree
                        key={item.label}
                        node={item}
                        pathname={pathname ?? null}
                        collapsed={collapsed}
                        onNavigate={closeMobile}
                      />
                    );
                  }

                  const isActive = isRouteActive(pathname, item.href, [item.href]);
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      onClick={closeMobile}
                      title={collapsed ? item.label : undefined}
                      className={`
                        flex items-center gap-2.5 rounded-lg transition-all duration-150 group relative
                        ${collapsed ? "px-0 py-2.5 justify-center" : "px-2.5 py-2"}
                        ${isActive
                          ? "bg-brand-red text-white font-semibold shadow-xs hover:bg-brand-red-mid"
                          : "text-sidebar-foreground/75 hover:bg-sidebar-accent hover:text-sidebar-foreground font-medium"
                        }
                      `}
                    >
                      <span className="shrink-0">{item.icon}</span>
                      {!collapsed && (
                        <span className="text-[12.5px] font-medium truncate flex-1">{item.label}</span>
                      )}
                      {collapsed && (
                        <div className="absolute left-full ml-2 top-1/2 -translate-y-1/2 bg-popover text-popover-foreground text-xs font-medium px-2 py-1 rounded-md whitespace-nowrap opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity z-50">
                          {item.label}
                        </div>
                      )}
                    </Link>
                  );
                })}
              </div>
            </div>
          ))}
        </nav>

        <div className="shrink-0 border-t border-sidebar-border p-2">
          <button
            type="button"
            onClick={handleLogout}
            className={`flex items-center gap-2.5 rounded-lg transition-all duration-150 w-full cursor-pointer text-sidebar-foreground/70 hover:text-brand-red hover:bg-brand-red-subtle
              ${collapsed ? "justify-center px-0 py-2.5" : "px-2.5 py-2"}
            `}
            title="Cerrar sesión"
          >
            <LogOut className="w-4 h-4 shrink-0" strokeWidth={2} />
            {!collapsed && <span className="text-[12.5px] font-medium">Cerrar sesión</span>}
          </button>
        </div>
      </aside>

      {mobileOpen && (
        <div
          onClick={() => setMobileOpen(false)}
          className="fixed inset-0 bg-black/30 z-40 md:hidden"
        />
      )}
    </>
  );
}
