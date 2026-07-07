"use client";

import Link from "next/link";
import { useState, useEffect, useRef } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useSidebar } from "@/contexts/SidebarContext";
import { sriClient } from "@/lib/sriClient";
import { Menu, ChevronLeft, ChevronDown, Check, Bell, LogOut, Settings, Building2, Plus, Loader2, X, KeyRound } from "lucide-react";
import { toast } from "sonner";

interface TopbarProps {
  title: string;
  period?: string;
  backLink?: {
    href: string;
    label: string;
  };
  lastSyncLabel?: string | null;
  syncPendientes?: number;
  isConnected?: boolean;
  enProcesoCount?: number;
  pprCount?: number;
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

export default function Topbar({ title, period = "Período actual", backLink, lastSyncLabel, syncPendientes, isConnected, enProcesoCount, pprCount }: TopbarProps) {
  const { user, hasSriLinked, activeRuc, rucList, setActiveRuc } = useAuth();
  const { setMobileOpen } = useSidebar();
  const [notifOpen, setNotifOpen] = useState(false);
  const [userDropdownOpen, setUserDropdownOpen] = useState(false);
  const [vincularOpen, setVincularOpen] = useState(false);
  const [vincularRuc, setVincularRuc] = useState("");
  const [vincularPassword, setVincularPassword] = useState("");
  const [vinculando, setVinculando] = useState(false);
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [sriConnected, setSriConnected] = useState(false);
  const [userName, setUserName] = useState("");
  const [userInitials, setUserInitials] = useState("—");
  const notifRef = useRef<HTMLDivElement>(null);
  const userMenuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (user?.email) {
      const emailName = user.email.split("@")[0];
      setUserName(emailName);
      setUserInitials(emailName.slice(0, 2).toUpperCase());
    }
    if (!hasSriLinked) return;
    const activeCompany = rucList.find((r) => r.ruc === activeRuc);
    if (activeCompany) {
      const name = activeCompany.razonSocial || activeCompany.ruc || "";
      setUserName(name);
      const parts = name.trim().split(/\s+/).filter(Boolean);
      setUserInitials(
        parts.length >= 2
          ? `${parts[0][0]}${parts[1][0]}`.toUpperCase()
          : name.slice(0, 2).toUpperCase() || "—"
      );
    }
  }, [user, hasSriLinked, activeRuc, rucList]);

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
      if (userMenuRef.current && !userMenuRef.current.contains(e.target as Node)) {
        setUserDropdownOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  const markAllRead = () => {
    setNotifications((prev) => prev.map((n) => ({ ...n, unread: false })));
  };

  const handleVincular = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!vincularRuc || !vincularPassword) return;
    setVinculando(true);
    try {
      const res = await sriClient.vincularSri(vincularRuc, vincularPassword);
      if (res.success) {
        toast.success("Empresa vinculada correctamente");
        setVincularOpen(false);
        setVincularRuc("");
        setVincularPassword("");
        setUserDropdownOpen(false);
        window.location.reload();
      } else {
        toast.error(res.error || "Error al vincular");
      }
    } catch {
      toast.error("Error de red al vincular");
    } finally {
      setVinculando(false);
    }
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
          
          <span className="bg-muted text-muted-foreground text-[11px] font-semibold rounded-full px-2.5 py-0.5">
            {period}
          </span>
        </div>
      </div>

      <div className="flex items-center gap-1.5">
        {/* Sync Status + Connection */}
        <div className="hidden lg:flex items-center gap-1.5 mr-1">
          {lastSyncLabel && (
            <Link
              href="/documentos"
              className="flex items-center gap-1.5 bg-slate-50 border border-slate-200 rounded-lg px-2 py-1 text-[10px] font-medium text-slate-600 hover:bg-slate-100 transition-colors"
              title="Ir a documentos"
            >
              <span className="font-semibold text-slate-800">Sync:</span>
              {lastSyncLabel}
              {(syncPendientes ?? 0) > 0 && (
                <span className="text-amber-700 font-bold">·{syncPendientes}</span>
              )}
            </Link>
          )}
          {isConnected && (
            <div className="flex items-center gap-1.5 bg-emerald-50 border border-emerald-200 rounded-lg px-2 py-1 text-[10px] font-semibold text-emerald-700 whitespace-nowrap">
              <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse shrink-0"></span>
              API Conectado
            </div>
          )}
          {(pprCount ?? 0) + (enProcesoCount ?? 0) > 0 && (
            <Link
              href="/documentos?estado=EN_PROCESO"
              className="flex items-center gap-1.5 bg-amber-50 border border-amber-200 rounded-lg px-2 py-1 text-[10px] font-semibold text-amber-700 hover:bg-amber-100 transition-colors"
            >
              <span className="w-1.5 h-1.5 bg-amber-500 rounded-full animate-pulse shrink-0"></span>
              {(pprCount ?? 0) + (enProcesoCount ?? 0)} en proc.
            </Link>
          )}
        </div>

        {/* Menú de usuario combinado */}
        <div ref={userMenuRef} className="relative hidden sm:block">
          <button
            type="button"
            onClick={() => setUserDropdownOpen(!userDropdownOpen)}
            className="flex items-center gap-2 pl-2 pr-2.5 py-1 rounded-lg hover:bg-accent transition-colors cursor-pointer"
          >
            <div className="w-7 h-7 bg-gradient-to-br from-brand-navy-light to-brand-sky rounded-lg flex items-center justify-center font-bold text-[11px] text-white shrink-0 shadow-sm">
              {userInitials}
            </div>
            <div className="text-right leading-tight hidden md:block">
              <div className="text-[12px] font-semibold text-foreground truncate max-w-[130px]">{userName || user?.email || "Usuario"}</div>
              <div className="text-[9px] text-muted-foreground truncate max-w-[130px]">{sriConnected ? "Conectado SRI" : "Sin SRI"}</div>
            </div>
            <ChevronDown className={`w-3 h-3 text-muted-foreground transition-transform duration-200 ${userDropdownOpen ? "rotate-180" : ""}`} strokeWidth={2} />
          </button>

          {userDropdownOpen && (
            <div className="absolute right-0 mt-1.5 w-72 bg-card border border-border rounded-xl shadow-xl z-50 overflow-hidden animate-in fade-in slide-in-from-top-1 duration-150">
              {/* Info del usuario */}
              <div className="px-4 py-3 border-b border-border">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 bg-gradient-to-br from-brand-navy-light to-brand-sky rounded-xl flex items-center justify-center font-bold text-sm text-white shrink-0 shadow-sm">
                    {userInitials}
                  </div>
                  <div className="min-w-0">
                    <p className="text-[13px] font-bold text-foreground truncate">{userName || user?.email || "Usuario"}</p>
                    <p className="text-[10px] text-muted-foreground truncate">{user?.email || ""}</p>
                  </div>
                </div>
              </div>

              {/* Lista de RUCs */}
              <div className="py-1">
                <div className="flex items-center justify-between px-4 py-1.5">
                  <span className="text-[9px] font-bold text-muted-foreground uppercase tracking-wider">
                    Empresas / RUCs Vinculados
                  </span>
                  <button
                    type="button"
                    onClick={() => setVincularOpen(true)}
                    className="flex items-center gap-1 text-[10px] font-semibold text-brand-navy hover:text-brand-navy-light transition-colors cursor-pointer"
                  >
                    <Plus className="w-3 h-3" strokeWidth={2.5} />
                    Añadir
                  </button>
                </div>
                {rucList.map((item) => (
                  <button
                    key={item.ruc}
                    onClick={() => {
                      setActiveRuc(item.ruc);
                      setUserDropdownOpen(false);
                    }}
                    className={`w-full flex items-center gap-3 px-4 py-2 text-left text-xs hover:bg-accent transition-colors cursor-pointer ${
                      item.ruc === activeRuc ? "bg-accent font-semibold text-foreground" : "text-muted-foreground"
                    }`}
                  >
                    <div className={`p-1 rounded-md ${item.ruc === activeRuc ? 'bg-brand-navy text-white' : 'bg-muted text-muted-foreground'}`}>
                      <Building2 className="w-3 h-3" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className={`truncate ${item.ruc === activeRuc ? 'text-foreground' : ''}`}>{item.razonSocial}</p>
                      <p className="text-[9px] text-muted-foreground/70 font-mono">{item.ruc}</p>
                    </div>
                    {item.ruc === activeRuc && (
                      <Check className="w-3.5 h-3.5 text-brand-navy shrink-0" strokeWidth={2.5} />
                    )}
                  </button>
                ))}
                {rucList.length === 0 && (
                  <div className="px-4 py-3 text-[11px] text-muted-foreground text-center">
                    No hay empresas vinculadas
                  </div>
                )}
              </div>

              {/* Formulario de vincular */}
              {vincularOpen && (
                <div className="border-t border-border px-4 py-3">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-[11px] font-bold text-foreground">Vincular nueva empresa</span>
                    <button
                      type="button"
                      onClick={() => { setVincularOpen(false); setVincularRuc(""); setVincularPassword(""); }}
                      className="text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
                    >
                      <X className="w-3.5 h-3.5" strokeWidth={2} />
                    </button>
                  </div>
                  <form onSubmit={handleVincular} className="flex flex-col gap-2">
                    <input
                      type="text"
                      placeholder="RUC"
                      value={vincularRuc}
                      onChange={(e) => setVincularRuc(e.target.value.replace(/\D/g, "").slice(0, 13))}
                      className="w-full h-8 px-2.5 text-xs rounded-lg border border-input bg-background text-foreground placeholder:text-muted-foreground/50 outline-none focus:border-brand-navy transition-colors"
                      required
                    />
                    <div className="relative">
                      <input
                        type="password"
                        placeholder="Contraseña SRI"
                        value={vincularPassword}
                        onChange={(e) => setVincularPassword(e.target.value)}
                        className="w-full h-8 px-2.5 pr-8 text-xs rounded-lg border border-input bg-background text-foreground placeholder:text-muted-foreground/50 outline-none focus:border-brand-navy transition-colors"
                        required
                      />
                      <KeyRound className="absolute right-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground/50 pointer-events-none" strokeWidth={1.5} />
                    </div>
                    <button
                      type="submit"
                      disabled={vinculando}
                      className="w-full h-8 rounded-lg bg-brand-navy text-white text-[11px] font-semibold hover:bg-brand-navy-light disabled:opacity-50 transition-colors cursor-pointer flex items-center justify-center"
                    >
                      {vinculando ? (
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      ) : (
                        "Vincular"
                      )}
                    </button>
                  </form>
                </div>
              )}

              {/* Acciones */}
              <div className="border-t border-border py-1">
                <Link
                  href="/configuracion"
                  onClick={() => setUserDropdownOpen(false)}
                  className="flex items-center gap-3 px-4 py-2 text-xs text-muted-foreground hover:bg-accent hover:text-foreground transition-colors"
                >
                  <Settings className="w-3.5 h-3.5" strokeWidth={1.5} />
                  Configuración
                </Link>
                <button
                  type="button"
                  onClick={() => {
                    localStorage.removeItem('sri_access_token');
                    window.location.href = '/login';
                  }}
                  className="w-full flex items-center gap-3 px-4 py-2 text-xs text-muted-foreground hover:bg-accent hover:text-foreground transition-colors cursor-pointer"
                >
                  <LogOut className="w-3.5 h-3.5" strokeWidth={1.5} />
                  Cerrar sesión
                </button>
              </div>
            </div>
          )}
        </div>

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
