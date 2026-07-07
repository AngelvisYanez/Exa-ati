"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
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
  Send,
  Receipt,
  Bell,
  Settings,
  ChevronLeft,
  ChevronRight,
  LogOut,
  BookOpen,
  Building2,
  Truck,
  ShoppingCart,
  Calculator,
  ListOrdered,
  Store,
  Package,
  BarChart3,
  FileSpreadsheet,
  FolderTree,
  Shield,
  Users,
} from "lucide-react";

type NavItem = {
  href: string;
  label: string;
  icon: React.ReactNode;
  roles?: string[];
};

type NavGroup = {
  group: string;
  items: NavItem[];
};

const navGroups: NavGroup[] = [
  {
    group: "PRINCIPAL",
    items: [
      {
        href: "/",
        label: "Dashboard",
        icon: <LayoutGrid className="w-[17px] h-[17px]" strokeWidth={1.8} />,
      },
      {
        href: "/documentos",
        label: "Documentos",
        icon: <FileText className="w-[17px] h-[17px]" strokeWidth={1.8} />,
      },
      {
        href: "/comprobantes",
        label: "Comprobantes",
        icon: <Receipt className="w-[17px] h-[17px]" strokeWidth={1.8} />,
      },
    ],
  },
  {
    group: "EMISIÓN",
    items: [
      {
        href: "/emitir",
        label: "Emitir",
        roles: ["SUPERADMIN", "ADMIN"],
        icon: <PlusCircle className="w-[17px] h-[17px]" strokeWidth={1.8} />,
      },
      {
        href: "/pos",
        label: "Punto de Venta",
        roles: ["SUPERADMIN", "ADMIN"],
        icon: <ShoppingCart className="w-[17px] h-[17px]" strokeWidth={1.8} />,
      },
      {
        href: "/ecommerce",
        label: "eCommerce",
        roles: ["SUPERADMIN", "ADMIN"],
        icon: <Store className="w-[17px] h-[17px]" strokeWidth={1.8} />,
      },
      {
        href: "/inventario",
        label: "Inventario",
        roles: ["SUPERADMIN", "ADMIN"],
        icon: <Package className="w-[17px] h-[17px]" strokeWidth={1.8} />,
      },
      {
        href: "/guias-remision",
        label: "Guías de Remisión",
        roles: ["SUPERADMIN", "ADMIN"],
        icon: <Truck className="w-[17px] h-[17px]" strokeWidth={1.8} />,
      },
    ],
  },
  {
    group: "CONTABILIDAD",
    items: [
      {
        href: "/contabilidad",
        label: "Dashboard",
        icon: <Calculator className="w-[17px] h-[17px]" strokeWidth={1.8} />,
      },
      {
        href: "/contabilidad/plan-cuentas",
        label: "Plan de Cuentas",
        roles: ["SUPERADMIN", "ADMIN"],
        icon: <BookOpen className="w-[17px] h-[17px]" strokeWidth={1.8} />,
      },
      {
        href: "/contabilidad/impuestos",
        label: "Impuestos",
        roles: ["SUPERADMIN", "ADMIN"],
        icon: <ListOrdered className="w-[17px] h-[17px]" strokeWidth={1.8} />,
      },
      {
        href: "/contabilidad/posiciones-fiscales",
        label: "Posiciones Fiscales",
        roles: ["SUPERADMIN", "ADMIN"],
        icon: <FolderTree className="w-[17px] h-[17px]" strokeWidth={1.8} />,
      },
      {
        href: "/contactos",
        label: "Contactos",
        icon: <Building2 className="w-[17px] h-[17px]" strokeWidth={1.8} />,
      },
      {
        href: "/transportistas",
        label: "Transportistas",
        roles: ["SUPERADMIN", "ADMIN"],
        icon: <Truck className="w-[17px] h-[17px]" strokeWidth={1.8} />,
      },
    ],
  },
  {
    group: "DECLARACIONES",
    items: [
      {
        href: "/declaraciones",
        label: "Dashboard",
        roles: ["SUPERADMIN", "ADMIN"],
        icon: <ScrollText className="w-[17px] h-[17px]" strokeWidth={1.8} />,
      },
      {
        href: "/declaraciones/reportes",
        label: "Formularios 103/104",
        roles: ["SUPERADMIN", "ADMIN"],
        icon: <BarChart3 className="w-[17px] h-[17px]" strokeWidth={1.8} />,
      },
      {
        href: "/declaraciones/ats",
        label: "ATS",
        roles: ["SUPERADMIN", "ADMIN"],
        icon: <FileSpreadsheet className="w-[17px] h-[17px]" strokeWidth={1.8} />,
      },
      {
        href: "/declaraciones/presentar",
        label: "Presentar al SRI",
        roles: ["SUPERADMIN", "ADMIN"],
        icon: <Send className="w-[17px] h-[17px]" strokeWidth={1.8} />,
      },
    ],
  },
  {
    group: "INTELIGENCIA IA",
    items: [
      {
        href: "/chat",
        label: "Chat IA",
        icon: <MessageSquare className="w-[17px] h-[17px]" strokeWidth={1.8} />,
      },
      {
        href: "/auditoria",
        label: "Auditoría IA",
        roles: ["SUPERADMIN", "ADMIN"],
        icon: <ShieldCheck className="w-[17px] h-[17px]" strokeWidth={1.8} />,
      },
    ],
  },
  {
    group: "CANALES",
    items: [
      {
        href: "/notificaciones",
        label: "Notificaciones",
        icon: <Bell className="w-[17px] h-[17px]" strokeWidth={1.8} />,
      },
    ],
  },
  {
    group: "ADMINISTRACIÓN",
    items: [
      {
        href: "/admin",
        label: "Dashboard",
        roles: ["ADMIN", "SUPERADMIN"],
        icon: <Shield className="w-[17px] h-[17px]" strokeWidth={1.8} />,
      },
      {
        href: "/admin/usuarios",
        label: "Usuarios",
        roles: ["ADMIN", "SUPERADMIN"],
        icon: <Users className="w-[17px] h-[17px]" strokeWidth={1.8} />,
      },
      {
        href: "/admin/empresas",
        label: "Empresas",
        roles: ["SUPERADMIN"],
        icon: <Building2 className="w-[17px] h-[17px]" strokeWidth={1.8} />,
      },
      {
        href: "/admin/auditoria",
        label: "Auditoría",
        roles: ["ADMIN", "SUPERADMIN"],
        icon: <ScrollText className="w-[17px] h-[17px]" strokeWidth={1.8} />,
      },
    ],
  },
  {
    group: "SISTEMA",
    items: [
      {
        href: "/configuracion",
        label: "Configuración",
        icon: <Settings className="w-[17px] h-[17px]" strokeWidth={1.8} />,
      },
    ],
  },
];

export default function Sidebar() {
  const pathname = usePathname();
  const { logout, user } = useAuth();
  const { collapsed, setCollapsed, mobileOpen, setMobileOpen } = useSidebar();

  const handleLogout = () => {
    logout();
    toast.info("Sesión cerrada correctamente");
  };

  const allowedNavGroups = navGroups.map((group) => {
    const items = group.items.filter((item) => {
      if (!item.roles) return true;
      return user && item.roles.includes(user.rol);
    });
    return { ...group, items };
  }).filter((group) => group.items.length > 0);

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
            <Image src="/favicon.png" alt="EXA-ATI" width={24} height={24} />
          ) : (
            <Image
              src="/exa-ati.png"
              alt="EXA-ATI"
              width={130}
              height={26}
              quality={100}
              priority
            />
          )}
          <button
            onClick={() => setCollapsed(!collapsed)}
            className="hidden md:flex absolute -right-3 top-1/2 -translate-y-1/2 w-5 h-7 bg-sidebar border border-sidebar-border rounded-r-md text-muted-foreground hover:text-sidebar-foreground items-center justify-center transition-colors cursor-pointer shadow-sm z-10"
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
                  const isActive = pathname === item.href || (item.href !== "/" && pathname?.startsWith(item.href));
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      onClick={() => setMobileOpen(false)}
                      title={collapsed ? item.label : undefined}
                      className={`
                        flex items-center gap-2.5 rounded-lg transition-all duration-150 group relative
                        ${collapsed ? "px-0 py-2.5 justify-center" : "px-2.5 py-2"}
                        ${isActive
                          ? "bg-brand-navy text-white shadow-sm"
                          : "text-sidebar-foreground/60 hover:bg-sidebar-accent hover:text-sidebar-foreground"
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
            className={`flex items-center gap-2.5 rounded-lg transition-all duration-150 w-full cursor-pointer
              ${collapsed
                ? "justify-center px-0 py-2.5 text-muted-foreground hover:text-red-500 hover:bg-brand-red-pale"
                : "px-2.5 py-2 text-muted-foreground hover:text-red-500 hover:bg-brand-red-pale"
              }
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
