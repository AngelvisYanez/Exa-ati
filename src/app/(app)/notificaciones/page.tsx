"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import Topbar from "@/components/Topbar";
import DateRangeFilter, {
  DateRange,
  filterByDateRange,
  formatDateRangeLabel,
  getDefaultDateRange,
  toDateRangeParams,
} from "@/components/DateRangeFilter";
import { sriClient } from "@/lib/sriClient";

type Channel = "App" | "Email" | "WhatsApp";
type NotifType = "vencimiento" | "presentacion" | "alerta" | "recordatorio" | "sri";

type Notification = {
  id: string;
  type: NotifType;
  title: string;
  body: string;
  time: string;
  date: string;
  at?: string;
  channel: Channel;
  unread: boolean;
  actionLabel?: string;
  actionHref?: string;
};

const typeConfig: Record<NotifType, { icon: React.ReactNode; color: string; bg: string; dot: string; label: string }> = {
  vencimiento: {
    icon: <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>,
    color: "text-amber-700",
    bg: "bg-amber-50",
    dot: "bg-amber-400",
    label: "Vencimiento",
  },
  presentacion: {
    icon: <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>,
    color: "text-emerald-700",
    bg: "bg-emerald-50",
    dot: "bg-emerald-500",
    label: "Presentación",
  },
  alerta: {
    icon: <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"/></svg>,
    color: "text-red-700",
    bg: "bg-red-50",
    dot: "bg-red-500",
    label: "Alerta",
  },
  recordatorio: {
    icon: <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9"/></svg>,
    color: "text-blue-700",
    bg: "bg-blue-50",
    dot: "bg-blue-400",
    label: "Recordatorio",
  },
  sri: {
    icon: <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path d="M3 6l3 1m0 0l-3 9a5.002 5.002 0 006.001 0M6 7l3 9M6 7l6-2m6 2l3-1m-3 1l-3 9a5.002 5.002 0 006.001 0M18 7l3 9m-3-9l-6-2m0-2v2m0 16V5m0 16H9m3 0h3"/></svg>,
    color: "text-slate-700",
    bg: "bg-slate-50",
    dot: "bg-slate-500",
    label: "SRI",
  },
};

const channelIcons: Record<Channel, React.ReactNode> = {
  App: <svg width="12" height="12" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><rect x="5" y="2" width="14" height="20" rx="2"/><path d="M12 18h.01"/></svg>,
  Email: <svg width="12" height="12" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/></svg>,
  WhatsApp: <svg width="12" height="12" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path d="M21 11.5a8.38 8.38 0 01-.9 3.8 8.5 8.5 0 01-7.6 4.7 8.38 8.38 0 01-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 01-.9-3.8 8.5 8.5 0 014.7-7.6 8.38 8.38 0 013.8-.9h.5a8.48 8.48 0 018 8v.5z"/></svg>,
};

const channelColor: Record<Channel, string> = {
  App: "bg-blue-100 text-blue-700",
  Email: "bg-purple-100 text-purple-700",
  WhatsApp: "bg-emerald-100 text-emerald-700",
};

export default function NotificacionesPage() {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filterType, setFilterType] = useState<NotifType | "Todos">("Todos");
  const [filterChannel, setFilterChannel] = useState<Channel | "Todos">("Todos");
  const [showOnlyUnread, setShowOnlyUnread] = useState(false);
  const [dateRange, setDateRange] = useState<DateRange>(getDefaultDateRange);

  useEffect(() => {
    const load = async () => {
      if (!sriClient.isAuthenticated()) {
        setError("Inicia sesión para ver notificaciones generadas desde tus comprobantes.");
        setLoading(false);
        return;
      }
      try {
        setLoading(true);
        const res = await sriClient.getNotificaciones(toDateRangeParams(dateRange));
        if (res.success) {
          setNotifications(res.notifications || []);
        }
      } catch (err: any) {
        setError(err.message || "Error al cargar notificaciones");
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [dateRange]);

  const unreadCount = notifications.filter((n) => n.unread).length;

  const inDateRange = [
    ...filterByDateRange(
      notifications.filter((n) => n.id !== "cert-expira"),
      (n) => n.at,
      dateRange
    ),
    ...notifications.filter((n) => n.id === "cert-expira"),
  ];

  const filtered = inDateRange.filter((n) => {
    if (filterType !== "Todos" && n.type !== filterType) return false;
    if (filterChannel !== "Todos" && n.channel !== filterChannel) return false;
    if (showOnlyUnread && !n.unread) return false;
    return true;
  });

  // Group by date
  const grouped = filtered.reduce<Record<string, Notification[]>>((acc, n) => {
    if (!acc[n.date]) acc[n.date] = [];
    acc[n.date].push(n);
    return acc;
  }, {});

  const markAllRead = () => {
    setNotifications((prev) => prev.map((n) => ({ ...n, unread: false })));
  };

  const markRead = (id: string) => {
    setNotifications((prev) =>
      prev.map((n) => (n.id === id ? { ...n, unread: false } : n))
    );
  };

  return (
    <>
      <title>Notificaciones - OFSERCONT IA</title>
      <meta name="description" content="Centro de notificaciones tributarias. Vencimientos, declaraciones, alertas del SRI y recordatorios en un solo lugar." />

      <Topbar title="Notificaciones" period={formatDateRangeLabel(dateRange)} />

      <main className="p-6 md:p-8 flex-1 flex flex-col gap-6 max-w-5xl mx-auto w-full">
        <DateRangeFilter value={dateRange} onChange={setDateRange} className="bg-white border border-slate-200 rounded-xl px-4 py-3" />
        {error && (
          <div className="bg-amber-50 border border-amber-200 text-amber-800 text-sm rounded-xl px-4 py-3">{error}</div>
        )}
        {loading && (
          <div className="bg-white border border-slate-200 rounded-xl p-10 text-center text-sm text-slate-500">
            Generando notificaciones desde la API...
          </div>
        )}
        {!loading && (
        <>
        {/* Header */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-slate-900">Centro de Notificaciones</h1>
            <p className="text-sm text-slate-500 mt-1">
              Todos tus avisos de vencimientos, declaraciones, alertas y novedades del SRI.
            </p>
          </div>
          {unreadCount > 0 && (
            <button
              onClick={markAllRead}
              className="text-[12px] font-semibold text-blue-600 hover:text-blue-800 border border-blue-200 bg-blue-50 px-3 py-1.5 rounded-lg transition-colors cursor-pointer shrink-0"
            >
              Marcar todas como leídas ({unreadCount})
            </button>
          )}
        </div>

        {/* Stats Row */}
        <div className="grid grid-cols-3 gap-3">
          {[
            { label: "No leídas", value: unreadCount, color: "text-red-600", bg: "bg-red-50 border-red-200" },
            { label: "Total hoy", value: inDateRange.filter(n => n.date === "Hoy").length, color: "text-slate-800", bg: "bg-white border-slate-200" },
            { label: "Canales activos", value: 3, color: "text-emerald-700", bg: "bg-emerald-50 border-emerald-200" },
          ].map((s) => (
            <div key={s.label} className={`rounded-xl border p-4 ${s.bg}`}>
              <div className={`text-2xl font-extrabold ${s.color}`}>{s.value}</div>
              <div className="text-[11px] text-slate-500 font-medium mt-0.5">{s.label}</div>
            </div>
          ))}
        </div>

        {/* Channels */}
        <div className="flex flex-wrap gap-3">
          {(["Todos", "App", "Email", "WhatsApp"] as (Channel | "Todos")[]).map((ch) => (
            <button
              key={ch}
              onClick={() => setFilterChannel(ch)}
              className={`flex items-center gap-1.5 text-[12px] font-semibold px-3 py-1.5 rounded-full border transition-colors cursor-pointer
                ${filterChannel === ch ? "bg-brand-navy text-white border-brand-navy" : "bg-white text-slate-600 border-slate-200 hover:border-slate-400"}
              `}
            >
              {ch !== "Todos" && <span className="opacity-70">{channelIcons[ch as Channel]}</span>}
              {ch}
            </button>
          ))}
          <div className="ml-auto flex items-center gap-2">
            <label className="flex items-center gap-1.5 text-[12px] font-medium text-slate-600 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={showOnlyUnread}
                onChange={(e) => setShowOnlyUnread(e.target.checked)}
                className="rounded"
              />
              Solo no leídas
            </label>
          </div>
        </div>

        {/* Type filter pills */}
        <div className="flex flex-wrap gap-2">
          {(["Todos", "vencimiento", "presentacion", "alerta", "recordatorio", "sri"] as (NotifType | "Todos")[]).map((t) => {
            const cfg = t !== "Todos" ? typeConfig[t as NotifType] : null;
            return (
              <button
                key={t}
                onClick={() => setFilterType(t)}
                className={`text-[11px] font-bold px-2.5 py-1 rounded-full border transition-colors cursor-pointer
                  ${filterType === t ? "bg-brand-navy text-white border-brand-navy" : "bg-white text-slate-500 border-slate-200 hover:border-slate-300"}
                `}
              >
                {cfg ? cfg.label : "Todos"}
              </button>
            );
          })}
        </div>

        {/* Grouped Notification List */}
        <div className="flex flex-col gap-6">
          {Object.entries(grouped).map(([date, items]) => (
            <div key={date}>
              <div className="text-[11px] font-bold text-slate-400 uppercase tracking-widest mb-3">{date}</div>
              <div className="flex flex-col gap-2">
                {items.map((n) => {
                  const tc = typeConfig[n.type];
                  return (
                    <div
                      key={n.id}
                      className={`bg-white border rounded-xl p-4 flex items-start gap-4 transition-all
                        ${n.unread ? "border-blue-200 shadow-sm" : "border-slate-200"}
                      `}
                    >
                      {/* Unread dot */}
                      <div className="flex flex-col items-center gap-1 pt-1 shrink-0">
                        <div className={`w-2 h-2 rounded-full ${n.unread ? tc.dot : "bg-transparent"}`} />
                      </div>

                      {/* Icon */}
                      <div className={`w-9 h-9 rounded-lg ${tc.bg} ${tc.color} flex items-center justify-center shrink-0`}>
                        {tc.icon}
                      </div>

                      {/* Content */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-2">
                          <p className={`text-[13px] font-semibold ${n.unread ? "text-slate-900" : "text-slate-600"}`}>
                            {n.title}
                          </p>
                          <span className="text-[10px] text-slate-400 shrink-0 whitespace-nowrap">{n.time}</span>
                        </div>
                        <p className="text-[12px] text-slate-500 mt-0.5 leading-snug">{n.body}</p>

                        <div className="flex items-center gap-2 mt-2 flex-wrap">
                          {/* Channel badge */}
                          <span className={`flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full ${channelColor[n.channel]}`}>
                            {channelIcons[n.channel]}
                            {n.channel}
                          </span>
                          <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${tc.bg} ${tc.color}`}>
                            {tc.label}
                          </span>
                          {n.actionLabel && n.actionHref && (
                            <a
                              href={n.actionHref}
                              onClick={() => markRead(n.id)}
                              className="text-[11px] font-bold text-brand-navy hover:text-brand-navy-light transition-colors"
                            >
                              {n.actionLabel} →
                            </a>
                          )}
                          {n.unread && (
                            <button
                              onClick={() => markRead(n.id)}
                              className="text-[10px] text-slate-400 hover:text-slate-600 transition-colors ml-auto cursor-pointer"
                            >
                              Marcar leída
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}

          {Object.keys(grouped).length === 0 && (
            <div className="bg-slate-50 border border-dashed border-slate-200 rounded-xl p-12 flex flex-col items-center gap-3 text-center">
              <div className="w-12 h-12 bg-slate-100 rounded-full flex items-center justify-center">
                <svg width="20" height="20" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2" className="text-slate-400">
                  <path d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
                </svg>
              </div>
              <p className="text-[13px] font-semibold text-slate-600">Sin notificaciones</p>
              <p className="text-[12px] text-slate-400">No hay notificaciones con los filtros seleccionados.</p>
            </div>
          )}
        </div>

        {/* Configuration card */}
        <div className="bg-slate-50 border border-slate-200 rounded-xl p-5 flex items-center gap-4">
          <div className="w-10 h-10 bg-slate-200 rounded-lg flex items-center justify-center shrink-0">
            <svg width="18" height="18" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.8" className="text-slate-600">
              <path d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
            </svg>
          </div>
          <div className="flex-1">
            <p className="text-[13px] font-semibold text-slate-800">Configurar canales de notificación</p>
            <p className="text-[12px] text-slate-500">Activa o desactiva notificaciones por App, Email o WhatsApp según tus preferencias.</p>
          </div>
          <a
            href="/configuracion?tab=notificaciones"
            className="shrink-0 text-[12px] font-semibold border border-slate-300 bg-white px-3 py-1.5 rounded-lg hover:bg-slate-50 transition-colors text-slate-700"
          >
            Configurar
          </a>
        </div>
        </>
        )}
      </main>
    </>
  );
}
