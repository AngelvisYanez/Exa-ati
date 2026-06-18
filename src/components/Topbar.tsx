"use client";

import Link from "next/link";
import { useState, useEffect, useRef } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useSidebar } from "@/contexts/SidebarContext";
import { useTheme } from "next-themes";
import { sriClient } from "@/lib/sriClient";
import { Building2, Menu, ChevronLeft, ChevronDown, Check, Sun, Moon, Bell } from "lucide-react";

interface TopbarProps {
  title: string;
  period?: string;
  backLink?: {
    href: string;
    label: string;
  };
}

type NotificationItem = {
  id: string;
  type: string;
  title: string;
  body: string;
  time: string;
  unread: boolean;
  color: string;
  bg: string;
  dot: string;
  actionHref?: string;
};

const typeStyles: Record<string, { color: string; bg: string; dot: string }> = {
  vencimiento: { color: "text-amber-600", bg: "bg-amber-50", dot: "bg-amber-500" },
  presentacion: { color: "text-emerald-600", bg: "bg-emerald-50", dot: "bg-emerald-500" },
  alerta: { color: "text-red-600", bg: "bg-red-50", dot: "bg-red-500" },
  recordatorio: { color: "text-blue-600", bg: "bg-blue-50", dot: "bg-blue-500" },
  sri: { color: "text-blue-600", bg: "bg-blue-50", dot: "bg-blue-500" },
};

export default function Topbar({ title, period = "Período actual", backLink }: TopbarProps) {
  const { user, hasSriLinked, activeRuc, rucList, setActiveRuc } = useAuth();
  const { setMobileOpen } = useSidebar();
  const { theme, setTheme } = useTheme();
  const [notifOpen, setNotifOpen] = useState(false);
  const [companyDropdownOpen, setCompanyDropdownOpen] = useState(false);
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [sriConnected, setSriConnected] = useState(false);
  const [userName, setUserName] = useState("");
  const [userInitials, setUserInitials] = useState("—");
  const notifRef = useRef<HTMLDivElement>(null);
  const companyRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (user?.email) {
      const emailName = user.email.split("@")[0];
      setUserName(emailName);
      setUserInitials(emailName.slice(0, 2).toUpperCase());
    }
    if (!hasSriLinked) return;
    sriClient.getEmisor().then((res) => {
      if (res.success && res.emisor) {
        const name = res.emisor.razonSocial || res.emisor.ruc || "";
        setUserName(name);
        const parts = name.trim().split(/\s+/).filter(Boolean);
        setUserInitials(
          parts.length >= 2
            ? `${parts[0][0]}${parts[1][0]}`.toUpperCase()
            : name.slice(0, 2).toUpperCase() || "—"
        );
      }
    }).catch(() => {});
  }, [user, hasSriLinked]);

  useEffect(() => {
    const load = async () => {
      if (!sriClient.isAuthenticated() || !hasSriLinked) {
        setSriConnected(false);
        return;
      }
      try {
        setSriConnected(true);
        const res = await sriClient.getNotificaciones();
        if (res.success && res.notifications) {
          setNotifications(
            res.notifications.map((n: any) => ({
              id: n.id,
              type: n.type,
              title: n.title,
              body: n.body,
              time: n.time,
              unread: n.unread,
              actionHref: n.actionHref,
              ...typeStyles[n.type] || typeStyles.recordatorio,
            }))
          );
        }
      } catch {
        setSriConnected(false);
      }
    };
    load();
  }, [hasSriLinked]);

  const unreadCount = notifications.filter((n) => n.unread).length;

  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (notifRef.current && !notifRef.current.contains(e.target as Node)) {
        setNotifOpen(false);
      }
      if (companyRef.current && !companyRef.current.contains(e.target as Node)) {
        setCompanyDropdownOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  const markAllRead = () => {
    setNotifications((prev) => prev.map((n) => ({ ...n, unread: false })));
  };

  return (
    <header className="bg-background border-b border-border px-4 md:px-6 h-14 flex items-center justify-between sticky top-0 z-40 select-none">
      <div className="flex items-center gap-3">
        <button
          onClick={() => setMobileOpen(true)}
          className="md:hidden w-8 h-8 text-muted-foreground hover:text-foreground hover:bg-accent rounded-lg cursor-pointer flex items-center justify-center transition-colors"
          aria-label="Abrir Menú"
        >
          <Menu className="w-[18px] h-[18px]" strokeWidth={2} />
        </button>

        <div className="flex items-center gap-2">
          {backLink ? (
            <>
              <Link
                href={backLink.href}
                className="text-muted-foreground hover:text-foreground flex items-center gap-1 text-[13px] transition-colors"
              >
                <ChevronLeft className="w-3.5 h-3.5" strokeWidth={2.5} />
                {backLink.label}
              </Link>
              <span className="text-border">/</span>
            </>
          ) : null}
          <span className="text-[15px] font-semibold text-foreground">{title}</span>
          
          {/* Selector de RUC/Empresa para contadores y admins */}
          {(user?.rol === "ADMIN" || user?.rol === "SUPERADMIN") && rucList.length > 1 ? (
            <div ref={companyRef} className="relative ml-2 inline-block text-left" id="company-selector">
              <button
                type="button"
                onClick={() => setCompanyDropdownOpen(!companyDropdownOpen)}
                className="flex items-center gap-1.5 bg-slate-50 border border-slate-200 dark:bg-slate-800 dark:border-slate-700 rounded-full px-3 py-1 text-[12px] font-semibold text-slate-800 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700 transition-all cursor-pointer shadow-sm active:scale-[0.98] outline-none"
              >
                <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse"></span>
                <span className="max-w-[250px] truncate">
                  {(() => {
                    const activeCompany = rucList.find((r) => r.ruc === activeRuc);
                    return activeCompany 
                      ? `${activeCompany.razonSocial} (${activeCompany.ruc})` 
                      : activeRuc || "Seleccionar Empresa";
                  })()}
                </span>
                <ChevronDown className={`w-2.5 h-2.5 transition-transform duration-200 ${companyDropdownOpen ? "rotate-180" : ""}`} strokeWidth={2.5} />
              </button>

              {companyDropdownOpen && (
                <div className="absolute left-0 mt-1.5 w-64 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl shadow-xl z-50 overflow-hidden py-1 animate-in fade-in slide-in-from-top-1 duration-150">
                  <div className="px-3 py-2 border-b border-slate-100 dark:border-slate-700 text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">
                    Cambiar de Empresa / RUC
                  </div>
                  <div className="max-h-60 overflow-y-auto">
                    {rucList.map((item) => (
                      <button
                        key={item.ruc}
                        onClick={() => {
                          setActiveRuc(item.ruc);
                          setCompanyDropdownOpen(false);
                        }}
                        className={`w-full flex items-center justify-between px-3.5 py-2.5 text-left text-[12.5px] hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors cursor-pointer ${
                          item.ruc === activeRuc ? "text-brand-navy dark:text-brand-sky font-bold bg-slate-50/50 dark:bg-slate-700/50" : "text-slate-700 dark:text-slate-300"
                        }`}
                      >
                        <div className="truncate pr-2">
                          <p className="truncate">{item.razonSocial}</p>
                          <p className="text-[10px] text-slate-400 dark:text-slate-500 font-mono mt-0.5">{item.ruc}</p>
                        </div>
                        {item.ruc === activeRuc && (
                          <Check className="w-3.5 h-3.5 text-brand-navy dark:text-brand-sky shrink-0" strokeWidth={2.5} />
                        )}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ) : rucList.length === 1 ? (
            <span className="text-[12px] bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 rounded-full px-3 py-1 font-semibold ml-2 flex items-center gap-1.5 shrink-0">
              <Building2 className="w-3.5 h-3.5 text-slate-500 dark:text-slate-400 shrink-0" />
              <span className="max-w-[280px] truncate">
                {rucList[0].razonSocial} ({rucList[0].ruc})
              </span>
            </span>
          ) : null}

          <span className="bg-muted text-muted-foreground text-[11px] font-semibold rounded-full px-2.5 py-0.5">
            {period}
          </span>
        </div>
      </div>

      <div className="flex items-center gap-1.5">
        <div className="hidden sm:flex items-center gap-2 mr-1 pr-2 border-r border-border">
          <div className="text-right leading-tight">
            <div className="text-[12px] font-semibold text-foreground truncate max-w-[110px]">{userName || user?.email || "Usuario"}</div>
            <div className="text-[9px] text-muted-foreground truncate max-w-[110px]">{sriConnected ? "Conectado SRI" : "Sin SRI"}</div>
          </div>
          <div className="w-8 h-8 bg-gradient-to-br from-brand-navy-light to-brand-sky rounded-lg flex items-center justify-center font-bold text-xs text-white shrink-0 shadow-sm">
            {userInitials}
          </div>
        </div>

        <button
          type="button"
          onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
          title="Cambiar tema"
          className="w-8 h-8 rounded-lg border border-input bg-card hover:bg-accent flex items-center justify-center text-muted-foreground hover:text-foreground cursor-pointer transition-colors"
        >
          {theme === "dark" ? (
            <Moon className="w-[15px] h-[15px]" strokeWidth={2} />
          ) : (
            <Sun className="w-[15px] h-[15px]" strokeWidth={2} />
          )}
        </button>

        <div ref={notifRef} className="relative">
          <button
            id="notif-bell-btn"
            onClick={() => setNotifOpen((o) => !o)}
            className="w-8 h-8 rounded-lg border border-input bg-card hover:bg-accent flex items-center justify-center text-muted-foreground hover:text-foreground cursor-pointer relative transition-colors"
            aria-label="Notificaciones"
          >
            <Bell className="w-[15px] h-[15px]" strokeWidth={2} />
            {unreadCount > 0 && (
              <span className="absolute -top-0.5 -right-0.5 w-4 h-4 bg-red-500 rounded-full text-[9px] font-bold text-white flex items-center justify-center border border-white">
                {unreadCount}
              </span>
            )}
          </button>

          {notifOpen && (
            <div className="absolute right-0 top-10 w-80 bg-card border border-border rounded-xl shadow-xl z-50 overflow-hidden">
              <div className="flex items-center justify-between px-4 py-3 border-b border-border">
                <span className="text-[13px] font-bold text-foreground">Notificaciones</span>
                {unreadCount > 0 && (
                  <button
                    onClick={markAllRead}
                    className="text-[11px] font-medium text-brand-navy-light hover:text-brand-navy cursor-pointer transition-colors"
                  >
                    Marcar todas como leídas
                  </button>
                )}
              </div>

              <div className="flex flex-col divide-y divide-border max-h-72 overflow-y-auto">
                {notifications.length === 0 ? (
                  <div className="px-4 py-6 text-center text-[12px] text-muted-foreground">
                    {sriClient.isAuthenticated()
                      ? "No hay notificaciones pendientes"
                      : "Inicia sesión para ver notificaciones reales"}
                  </div>
                ) : (
                  notifications.map((n) => (
                    <Link
                      key={n.id}
                      href={n.actionHref || "/notificaciones"}
                      onClick={() => {
                        setNotifications((prev) =>
                          prev.map((x) => (x.id === n.id ? { ...x, unread: false } : x))
                        );
                        setNotifOpen(false);
                      }}
                      className={`flex items-start gap-3 px-4 py-3 ${n.unread ? "bg-brand-red-pale/30" : "bg-card"} hover:bg-accent transition-colors`}
                    >
                      <div className={`mt-0.5 w-2 h-2 rounded-full shrink-0 ${n.unread ? n.dot : "bg-muted-foreground/30"}`} />
                      <div className="flex-1 min-w-0">
                        <p className="text-[12px] font-semibold text-foreground truncate">{n.title}</p>
                        <p className="text-[11px] text-muted-foreground truncate">{n.body}</p>
                      </div>
                      <span className="text-[10px] text-muted-foreground/60 shrink-0 whitespace-nowrap">{n.time}</span>
                    </Link>
                  ))
                )}
              </div>

              <div className="border-t border-border px-4 py-2.5">
                <Link
                  href="/notificaciones"
                  onClick={() => setNotifOpen(false)}
                  className="text-[12px] font-semibold text-brand-navy hover:text-brand-navy-light transition-colors"
                >
                  Ver todas las notificaciones →
                </Link>
              </div>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
