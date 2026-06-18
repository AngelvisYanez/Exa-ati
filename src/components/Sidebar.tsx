"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { useTheme } from "next-themes";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";
import { useSidebar } from "@/contexts/SidebarContext";

type NavItem = {
  href: string;
  label: string;
  icon: React.ReactNode;
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
        icon: (
          <svg width="17" height="17" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.8">
            <rect x="3" y="3" width="7" height="7" rx="1.5" />
            <rect x="14" y="3" width="7" height="7" rx="1.5" />
            <rect x="3" y="14" width="7" height="7" rx="1.5" />
            <rect x="14" y="14" width="7" height="7" rx="1.5" />
          </svg>
        ),
      },
      {
        href: "/documentos",
        label: "Documentos",
        icon: (
          <svg width="17" height="17" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.8">
            <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" />
            <polyline points="14 2 14 8 20 8" />
          </svg>
        ),
      },
      {
        href: "/declaraciones",
        label: "Declaraciones",
        icon: (
          <svg width="17" height="17" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.8">
            <path d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
        ),
      },
    ],
  },
  {
    group: "INTELIGENCIA IA",
    items: [
      {
        href: "/chat",
        label: "Chat IA",
        icon: (
          <svg width="17" height="17" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.8">
            <path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z" />
          </svg>
        ),
      },
      {
        href: "/auditoria",
        label: "Auditoría IA",
        icon: (
          <svg width="17" height="17" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.8">
            <path d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
          </svg>
        ),
      },
    ],
  },
  {
    group: "ACCIÓN TRIBUTARIA",
    items: [
      {
        href: "/declaraciones/presentar",
        label: "Presentar al SRI",
        icon: (
          <svg width="17" height="17" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.8">
            <path d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
          </svg>
        ),
      },
      {
        href: "/comprobantes",
        label: "Comprobantes",
        icon: (
          <svg width="17" height="17" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.8">
            <path d="M7 21H4a2 2 0 01-2-2V5a2 2 0 012-2h3" />
            <rect x="9" y="3" width="10" height="18" rx="1" />
            <path d="M13 8h3M13 12h3M13 16h3" />
          </svg>
        ),
      },
    ],
  },
  {
    group: "CANALES",
    items: [
      {
        href: "/notificaciones",
        label: "Notificaciones",
        icon: (
          <svg width="17" height="17" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.8">
            <path d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
          </svg>
        ),
      },
    ],
  },
  {
    group: "SISTEMA",
    items: [
      {
        href: "/configuracion",
        label: "Configuración",
        icon: (
          <svg width="17" height="17" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.8">
            <circle cx="12" cy="12" r="3" />
            <path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-2 2 2 2 0 01-2-2v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83 0 2 2 0 010-2.83l.06-.06A1.65 1.65 0 004.68 15a1.65 1.65 0 00-1.51-1H3a2 2 0 01-2-2 2 2 0 012-2h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 010-2.83 2 2 0 012.83 0l.06.06A1.65 1.65 0 009 4.68a1.65 1.65 0 001-1.51V3a2 2 0 012-2 2 2 0 012 2v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 0 2 2 0 010 2.83l-.06.06A1.65 1.65 0 0019.4 9a1.65 1.65 0 001.51 1H21a2 2 0 012 2 2 2 0 01-2 2h-.09a1.65 1.65 0 00-1.51 1z" />
          </svg>
        ),
      },
    ],
  },
];

export default function Sidebar() {
  const pathname = usePathname();
  const { resolvedTheme } = useTheme();
  const { logout } = useAuth();
  const { collapsed, setCollapsed, mobileOpen, setMobileOpen } = useSidebar();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const handleLogout = () => {
    logout();
    toast.info("Sesión cerrada correctamente");
  };

  const sidebarWidth = collapsed ? "w-14" : "w-60";

  return (
    <>
      <aside
        className={`
          ${sidebarWidth} bg-sidebar border-r border-sidebar-border
          min-h-screen flex flex-col fixed top-0 left-0 z-50
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
              src={mounted && resolvedTheme === "dark" ? "/exa-ati-2.png" : "/exa-ati.png"}
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
            <svg width="10" height="10" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
              <path d={collapsed ? "M9 18l6-6-6-6" : "M15 18l-6-6 6-6"} />
            </svg>
          </button>
        </div>

        <nav className="flex-1 py-2 flex flex-col overflow-y-auto overflow-x-hidden">
          {navGroups.map((group, gi) => (
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
            <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
              <path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4M16 17l5-5-5-5M21 12H9" />
            </svg>
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
