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
  vencimiento: { color: "text-amber-700", bg: "bg-brand-amber-pale", dot: "bg-brand-amber" },
  presentacion: { color: "text-success", bg: "bg-success-pale", dot: "bg-success" },
  alerta: { color: "text-brand-red", bg: "bg-brand-red-subtle", dot: "bg-brand-red" },
  recordatorio: { color: "text-brand-sky", bg: "bg-sky-50", dot: "bg-brand-sky" },
  sri: { color: "text-brand-sky", bg: "bg-sky-50", dot: "bg-brand-sky" },
};

export default function Topbar({ title, period = "Período actual", backLink, lastSyncLabel, syncPendientes, isConnected, enProcesoCount, pprCount }: TopbarProps) {
  const { user, hasSriLinked, activeRuc, rucList, setActiveRuc, isLoading: authLoading } = useAuth();
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
      if (authLoading) return;
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
        // Vínculo SRI ya confirmado; no degradar a "Sin SRI" por fallo de notificaciones
        setSriConnected(true);
      }
    };
    load();
  }, [hasSriLinked, authLoading]);

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

  const markAllRead = async () => {
    const prev = notifications;
    setNotifications((p) => p.map((n) => ({ ...n, unread: false })));
    try {
      await sriClient.markNotificacionesRead({ all: true });
    } catch {
      setNotifications(prev);
      toast.error("No se pudieron marcar como leídas");
    }
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
    <header className="bg-white/95 backdrop-blur-md border-b border-brand-gray-200 px-4 md:px-6 h-14 flex items-center justify-between sticky top-0 z-40 select-none shadow-2xs shrink-0">
      <div className="flex items-center gap-3">
        <button
          onClick={() => setMobileOpen(true)}
          className="md:hidden w-8 h-8 text-brand-gray-600 hover:text-brand-gray-900 hover:bg-brand-gray-100 rounded-lg cursor-pointer flex items-center justify-center transition-colors active:scale-95"
          aria-label="Abrir Menú"
        >
          <Menu className="w-[18px] h-[18px]" strokeWidth={2} />
        </button>

        <div className="flex items-center gap-2">
          {backLink ? (
            <>
              <Link
                href={backLink.href}
                className="text-brand-gray-500 hover:text-brand-gray-900 flex items-center gap-1 text-[13px] font-medium transition-colors"
              >
                <ChevronLeft className="w-3.5 h-3.5" strokeWidth={2.5} />
                {backLink.label}
              </Link>
              <span className="text-brand-gray-300">/</span>
            </>
          ) : null}
          <span className="text-[15px] font-bold text-brand-gray-900 tracking-tight">{title}</span>
          
          <span className="bg-brand-gray-100 border border-brand-gray-200/80 text-brand-gray-600 text-[11px] font-bold rounded-md px-2.5 py-0.5">
            {period}
          </span>
        </div>
      </div>

      <div className="flex items-center gap-2">
        {/* Sync Status + Connection */}
        <div className="hidden lg:flex items-center gap-2 mr-1">
          {lastSyncLabel && (
            <Link
              href="/documentos"
              className="flex items-center gap-1.5 bg-brand-gray-50 border border-brand-gray-200 rounded-md px-2.5 py-1 text-[10.5px] font-medium text-brand-gray-700 hover:bg-brand-gray-100 transition-colors shadow-2xs"
              title="Ir a documentos"
            >
              <span className="font-bold text-brand-gray-900">Sync:</span>
              {lastSyncLabel}
              {(syncPendientes ?? 0) > 0 && (
                <span className="text-amber-700 font-bold">·{syncPendientes}</span>
              )}
            </Link>
          )}
          {isConnected && (
            <div className="flex items-center gap-1.5 bg-success-pale/90 border border-success-light/40 rounded-md px-2.5 py-1 text-[10.5px] font-bold text-success whitespace-nowrap">
              <span className="w-1.5 h-1.5 bg-success rounded-full animate-pulse-soft shrink-0" />
              API Conectado
            </div>
          )}
          {(pprCount ?? 0) + (enProcesoCount ?? 0) > 0 && (
            <Link
              href="/documentos?estado=EN_PROCESO"
              className="flex items-center gap-1.5 bg-brand-amber-pale/90 border border-brand-amber/30 rounded-md px-2.5 py-1 text-[10.5px] font-bold text-amber-800 hover:bg-brand-amber-pale transition-colors"
            >
              <span className="w-1.5 h-1.5 bg-brand-amber rounded-full animate-pulse-soft shrink-0" />
              {(pprCount ?? 0) + (enProcesoCount ?? 0)} en proc.
            </Link>
          )}
        </div>

        {/* Notificaciones (antes de Opciones del Usuario) */}
        <div ref={notifRef} className="relative">
          <button
            id="notif-bell-btn"
            onClick={() => setNotifOpen((o) => !o)}
            className="w-8 h-8 rounded-lg border border-brand-gray-200 bg-white hover:bg-brand-gray-100 flex items-center justify-center text-brand-gray-600 hover:text-brand-gray-900 cursor-pointer relative transition-all active:scale-95 shadow-2xs"
            aria-label="Notificaciones"
          >
            <Bell className="w-[15px] h-[15px]" strokeWidth={2} />
            {unreadCount > 0 && (
              <span className="absolute -top-0.5 -right-0.5 w-4 h-4 bg-brand-red rounded-full text-[9px] font-bold text-white flex items-center justify-center border border-white">
                {unreadCount}
              </span>
            )}
          </button>

          {notifOpen && (
            <div className="absolute right-0 top-10 w-80 bg-white border border-brand-gray-200 rounded-xl shadow-lg z-50 overflow-hidden animate-in fade-in slide-in-from-top-1 duration-150">
              <div className="flex items-center justify-between px-4 py-3 border-b border-brand-gray-100 bg-brand-gray-50/50">
                <span className="text-[13px] font-bold text-brand-gray-900">Notificaciones</span>
                {unreadCount > 0 && (
                  <button
                    onClick={markAllRead}
                    className="text-[11px] font-bold text-brand-red hover:text-brand-red-bright cursor-pointer transition-colors"
                  >
                    Marcar todas como leídas
                  </button>
                )}
              </div>

              <div className="flex flex-col divide-y divide-brand-gray-100 max-h-72 overflow-y-auto">
                {notifications.length === 0 ? (
                  <div className="px-4 py-6 text-center text-[12px] text-brand-gray-400">
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
                        if (n.unread) {
                          void sriClient.markNotificacionesRead({ ids: [n.id] }).catch(() => {});
                        }
                      }}
                      className={`flex items-start gap-3 px-4 py-3 ${n.unread ? "bg-brand-red-pale/20" : "bg-white"} hover:bg-brand-gray-50 transition-colors`}
                    >
                      <div className={`mt-1 w-2 h-2 rounded-full shrink-0 ${n.unread ? n.dot : "bg-brand-gray-300"}`} />
                      <div className="flex-1 min-w-0">
                        <p className="text-[12px] font-bold text-brand-gray-900 truncate">{n.title}</p>
                        <p className="text-[11px] text-brand-gray-500 truncate">{n.body}</p>
                      </div>
                      <span className="text-[10px] text-brand-gray-400 shrink-0 whitespace-nowrap">{n.time}</span>
                    </Link>
                  ))
                )}
              </div>

              <div className="border-t border-brand-gray-100 px-4 py-2.5 bg-brand-gray-50/30">
                <Link
                  href="/notificaciones"
                  onClick={() => setNotifOpen(false)}
                  className="text-[12px] font-bold text-brand-red hover:text-brand-red-bright transition-colors"
                >
                  Ver todas las notificaciones →
                </Link>
              </div>
            </div>
          )}
        </div>

        {/* Menú de usuario combinado (opciones del usuario) */}
        <div ref={userMenuRef} className="relative hidden sm:block">
          <button
            type="button"
            onClick={() => setUserDropdownOpen(!userDropdownOpen)}
            className="flex items-center gap-2 pl-2 pr-2.5 py-1 rounded-lg border border-transparent hover:border-brand-gray-200 hover:bg-brand-gray-100/80 transition-all duration-150 cursor-pointer active:scale-[0.98]"
          >
            <div className="w-7 h-7 bg-brand-red rounded-lg flex items-center justify-center font-bold text-[11px] text-white shrink-0 shadow-2xs">
              {userInitials}
            </div>
            <div className="text-right leading-tight hidden md:block">
              <div className="text-[12px] font-bold text-brand-gray-900 truncate max-w-[130px]">{userName || user?.email || "Usuario"}</div>
              <div className="text-[9.5px] font-medium text-brand-gray-500 truncate max-w-[130px]">
                {authLoading ? "Comprobando SRI…" : sriConnected || hasSriLinked ? "Conectado SRI" : "Sin SRI"}
              </div>
            </div>
            <ChevronDown className={`w-3.5 h-3.5 text-brand-gray-400 transition-transform duration-200 ${userDropdownOpen ? "rotate-180" : ""}`} strokeWidth={2} />
          </button>

          {userDropdownOpen && (
            <div className="absolute right-0 mt-1.5 w-72 bg-white border border-brand-gray-200 rounded-xl shadow-lg z-50 overflow-hidden animate-in fade-in slide-in-from-top-1 duration-150">
              {/* Info del usuario */}
              <div className="px-4 py-3 border-b border-brand-gray-100 bg-brand-gray-50/50">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 bg-brand-red rounded-xl flex items-center justify-center font-bold text-sm text-white shrink-0 shadow-2xs">
                    {userInitials}
                  </div>
                  <div className="min-w-0">
                    <p className="text-[13px] font-bold text-brand-gray-900 truncate">{userName || user?.email || "Usuario"}</p>
                    <p className="text-[10.5px] text-brand-gray-500 truncate">{user?.email || ""}</p>
                  </div>
                </div>
              </div>

              {/* Lista de RUCs */}
              <div className="py-1">
                <div className="flex items-center justify-between px-4 py-1.5">
                  <span className="text-[9px] font-bold text-brand-gray-400 uppercase tracking-widest">
                    Empresas / RUCs Vinculados
                  </span>
                  <button
                    type="button"
                    onClick={() => setVincularOpen(true)}
                    className="flex items-center gap-1 text-[10px] font-bold text-brand-red hover:text-brand-red-bright transition-colors cursor-pointer active:scale-95"
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
                    className={`w-full flex items-center gap-3 px-4 py-2 text-left text-xs transition-colors cursor-pointer ${
                      item.ruc === activeRuc ? "bg-brand-gray-100 font-semibold text-brand-gray-900" : "text-brand-gray-600 hover:bg-brand-gray-50 hover:text-brand-gray-900"
                    }`}
                  >
                    <div className={`p-1 rounded-md ${item.ruc === activeRuc ? 'bg-brand-red text-white' : 'bg-brand-gray-100 text-brand-gray-500'}`}>
                      <Building2 className="w-3.5 h-3.5" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className={`truncate ${item.ruc === activeRuc ? 'text-brand-gray-900 font-bold' : ''}`}>{item.razonSocial}</p>
                      <p className="text-[9.5px] text-brand-gray-400 font-mono">{item.ruc}</p>
                    </div>
                    {item.ruc === activeRuc && (
                      <Check className="w-3.5 h-3.5 text-brand-red shrink-0" strokeWidth={2.5} />
                    )}
                  </button>
                ))}
                {rucList.length === 0 && (
                  <div className="px-4 py-3 text-[11px] text-brand-gray-400 text-center">
                    No hay empresas vinculadas
                  </div>
                )}
              </div>

              {/* Formulario de vincular */}
              {vincularOpen && (
                <div className="border-t border-brand-gray-100 px-4 py-3 bg-brand-gray-50/40">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-[11px] font-bold text-brand-gray-900">Vincular nueva empresa</span>
                    <button
                      type="button"
                      onClick={() => { setVincularOpen(false); setVincularRuc(""); setVincularPassword(""); }}
                      className="text-brand-gray-400 hover:text-brand-gray-700 transition-colors cursor-pointer"
                      aria-label="Cerrar vinculación"
                    >
                      <X className="w-3.5 h-3.5" strokeWidth={2} />
                    </button>
                  </div>
                  <form onSubmit={handleVincular} className="flex flex-col gap-2">
                    <input
                      type="text"
                      placeholder="RUC"
                      aria-label="RUC de 13 dígitos"
                      value={vincularRuc}
                      onChange={(e) => setVincularRuc(e.target.value.replace(/\D/g, "").slice(0, 13))}
                      className="w-full h-8 px-2.5 text-xs rounded-lg border border-brand-gray-200 bg-white text-brand-gray-900 placeholder:text-brand-gray-400 outline-none focus:border-brand-red focus:ring-2 focus:ring-brand-red/20 transition-all"
                      required
                    />
                    <div className="relative">
                      <input
                        type="password"
                        placeholder="Contraseña SRI"
                        aria-label="Contraseña del portal SRI"
                        value={vincularPassword}
                        onChange={(e) => setVincularPassword(e.target.value)}
                        className="w-full h-8 px-2.5 pr-8 text-xs rounded-lg border border-brand-gray-200 bg-white text-brand-gray-900 placeholder:text-brand-gray-400 outline-none focus:border-brand-red focus:ring-2 focus:ring-brand-red/20 transition-all"
                        required
                      />
                      <KeyRound className="absolute right-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-brand-gray-400 pointer-events-none" strokeWidth={1.5} />
                    </div>
                    <button
                      type="submit"
                      disabled={vinculando}
                      className="w-full h-8 rounded-lg bg-brand-red text-white text-[11px] font-bold hover:bg-brand-red-bright disabled:opacity-50 transition-all duration-150 cursor-pointer flex items-center justify-center active:scale-[0.98] shadow-2xs"
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
              <div className="border-t border-brand-gray-100 py-1 bg-brand-gray-50/20">
                <Link
                  href="/configuracion"
                  onClick={() => setUserDropdownOpen(false)}
                  className="flex items-center gap-3 px-4 py-2 text-xs font-medium text-brand-gray-700 hover:bg-brand-gray-100 hover:text-brand-gray-900 transition-colors"
                >
                  <Settings className="w-3.5 h-3.5" strokeWidth={1.8} />
                  Configuración
                </Link>
                <button
                  type="button"
                  onClick={() => {
                    localStorage.removeItem('sri_access_token');
                    window.location.href = '/login';
                  }}
                  className="w-full flex items-center gap-3 px-4 py-2 text-xs font-medium text-brand-gray-700 hover:bg-brand-red-subtle hover:text-brand-red transition-colors cursor-pointer"
                >
                  <LogOut className="w-3.5 h-3.5" strokeWidth={1.8} />
                  Cerrar sesión
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
