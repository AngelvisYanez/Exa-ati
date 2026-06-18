"use client";

import Link from "next/link";
import { useState, useEffect, useRef } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useSidebar } from "@/contexts/SidebarContext";
import { useTheme } from "next-themes";
import { sriClient } from "@/lib/sriClient";

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
  const { user, hasSriLinked } = useAuth();
  const { setMobileOpen } = useSidebar();
  const { theme, setTheme } = useTheme();
  const [notifOpen, setNotifOpen] = useState(false);
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [sriConnected, setSriConnected] = useState(false);
  const [userName, setUserName] = useState("");
  const [userInitials, setUserInitials] = useState("—");
  const notifRef = useRef<HTMLDivElement>(null);

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
          <svg width="18" height="18" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
            <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
          </svg>
        </button>

        <div className="flex items-center gap-2">
          {backLink ? (
            <>
              <Link
                href={backLink.href}
                className="text-muted-foreground hover:text-foreground flex items-center gap-1 text-[13px] transition-colors"
              >
                <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
                  <path d="M15 18l-6-6 6-6" />
                </svg>
                {backLink.label}
              </Link>
              <span className="text-border">/</span>
            </>
          ) : null}
          <span className="text-[15px] font-semibold text-foreground">{title}</span>
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
            <svg width="15" height="15" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path d="M21 12.79A9 9 0 1111.21 3 7 7 0 0021 12.79z" /></svg>
          ) : (
            <svg width="15" height="15" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="5" /><path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42" /></svg>
          )}
        </button>

        <div ref={notifRef} className="relative">
          <button
            id="notif-bell-btn"
            onClick={() => setNotifOpen((o) => !o)}
            className="w-8 h-8 rounded-lg border border-input bg-card hover:bg-accent flex items-center justify-center text-muted-foreground hover:text-foreground cursor-pointer relative transition-colors"
            aria-label="Notificaciones"
          >
            <svg width="15" height="15" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
              <path d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
            </svg>
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
