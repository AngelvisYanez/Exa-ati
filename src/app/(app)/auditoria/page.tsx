"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import Topbar from "@/components/Topbar";
import DateRangeFilter, {
  DateRange,
  formatDateRangeLabel,
  getDefaultDateRange,
  toDateRangeParams,
} from "@/components/DateRangeFilter";
import { sriClient } from "@/lib/sriClient";

type RiskLevel = "Alto" | "Medio" | "Bajo";

type Alert = {
  id: string;
  type: string;
  title: string;
  description: string;
  risk: RiskLevel;
  count?: number;
  suggestion: string;
  clavesAcceso?: string[];
};

const riskConfig: Record<RiskLevel, { color: string; bg: string; border: string; dot: string; label: string }> = {
  Alto: {
    color: "text-red-700",
    bg: "bg-red-50",
    border: "border-red-200",
    dot: "bg-red-500",
    label: "Riesgo Alto",
  },
  Medio: {
    color: "text-amber-700",
    bg: "bg-amber-50",
    border: "border-amber-200",
    dot: "bg-amber-400",
    label: "Riesgo Medio",
  },
  Bajo: {
    color: "text-emerald-700",
    bg: "bg-emerald-50",
    border: "border-emerald-200",
    dot: "bg-emerald-500",
    label: "Riesgo Bajo",
  },
};

const typeIcons: Record<string, React.ReactNode> = {
  duplicate: (
    <svg width="18" height="18" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.8">
      <rect x="9" y="9" width="13" height="13" rx="2" />
      <path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1" />
    </svg>
  ),
  suspended: (
    <svg width="18" height="18" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.8">
      <circle cx="12" cy="12" r="10" />
      <line x1="4.93" y1="4.93" x2="19.07" y2="19.07" />
    </svg>
  ),
  iva: (
    <svg width="18" height="18" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.8">
      <path d="M12 1v22M17 5H9.5a3.5 3.5 0 000 7h5a3.5 3.5 0 010 7H6" />
    </svg>
  ),
  retention: (
    <svg width="18" height="18" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.8">
      <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" />
      <polyline points="14 2 14 8 20 8" />
      <line x1="16" y1="13" x2="8" y2="13" />
    </svg>
  ),
  limit: (
    <svg width="18" height="18" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.8">
      <path d="M22 12h-4l-3 9L9 3l-3 9H2" />
    </svg>
  ),
  common: (
    <svg width="18" height="18" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.8">
      <circle cx="12" cy="12" r="10" />
      <line x1="12" y1="8" x2="12" y2="12" />
      <line x1="12" y1="16" x2="12.01" y2="16" />
    </svg>
  ),
};

function formatLastRun(dateStr: string | null) {
  if (!dateStr) return "Sin ejecuciones previas";
  const date = new Date(dateStr);
  const diffMin = Math.floor((Date.now() - date.getTime()) / 60000);
  if (diffMin < 1) return "Última ejecución: hace un momento";
  if (diffMin < 60) return `Última ejecución: hace ${diffMin} min`;
  const diffH = Math.floor(diffMin / 60);
  if (diffH < 24) return `Última ejecución: hace ${diffH} h`;
  return `Última ejecución: ${date.toLocaleDateString("es-EC")}`;
}

export default function AuditoriaPage() {
  const [filter, setFilter] = useState<RiskLevel | "Todos">("Todos");
  const [expanded, setExpanded] = useState<string | null>(null);
  const [running, setRunning] = useState(false);
  const [loading, setLoading] = useState(true);
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [comprobantesRevisados, setComprobantesRevisados] = useState(0);
  const [lastExecutedAt, setLastExecutedAt] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [dateRange, setDateRange] = useState<DateRange>(getDefaultDateRange);

  const loadAuditoria = async () => {
    if (!sriClient.isAuthenticated()) {
      setLoading(false);
      setError("Inicia sesión para ejecutar la auditoría con tus comprobantes reales.");
      return;
    }
    try {
      setLoading(true);
      setError(null);
      const res = await sriClient.getAuditoria(toDateRangeParams(dateRange));
      if (res.success) {
        setAlerts(res.alerts || []);
        setComprobantesRevisados(res.comprobantesRevisados || 0);
        setLastExecutedAt(res.lastExecutedAt || null);
      }
    } catch (err: any) {
      setError(err.message || "Error al cargar auditoría");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAuditoria();
  }, [dateRange]);

  const runAudit = async () => {
    setRunning(true);
    setError(null);
    try {
      const res = await sriClient.runAuditoria(toDateRangeParams(dateRange));
      if (res.success) {
        setAlerts(res.alerts || []);
        setComprobantesRevisados(res.comprobantesRevisados || 0);
        setLastExecutedAt(res.executedAt || new Date().toISOString());
      }
    } catch (err: any) {
      setError(err.message || "Error al ejecutar auditoría");
    } finally {
      setRunning(false);
    }
  };

  const altoCount = alerts.filter((a) => a.risk === "Alto").length;
  const medioCount = alerts.filter((a) => a.risk === "Medio").length;
  const bajoCount = alerts.filter((a) => a.risk === "Bajo").length;
  const filtered = filter === "Todos" ? alerts : alerts.filter((a) => a.risk === filter);
  const overallRisk: RiskLevel = altoCount > 0 ? "Alto" : medioCount > 0 ? "Medio" : "Bajo";
  const rc = riskConfig[overallRisk];

  return (
    <>
      <title>Auditoría IA - OFSERCONT IA</title>
      <meta name="description" content="Panel de auditoría inteligente. Detecta inconsistencias, riesgos y errores en tus comprobantes electrónicos." />

      <Topbar title="Auditoría IA" period={formatDateRangeLabel(dateRange)} />

      <main className="p-6 md:p-8 flex-1 flex flex-col gap-6 max-w-7xl mx-auto w-full">
        <DateRangeFilter value={dateRange} onChange={setDateRange} className="bg-white border border-slate-200 rounded-xl px-4 py-3" />
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-slate-900">Auditoría Inteligente</h1>
            <p className="text-sm text-slate-500 mt-1">
              Analiza tus comprobantes reales y detecta inconsistencias, riesgos y errores automáticamente.
            </p>
          </div>
          <button
            id="run-audit-btn"
            onClick={runAudit}
            disabled={running || !sriClient.isAuthenticated()}
            className="flex items-center gap-2 bg-brand-navy text-white text-[13px] font-semibold px-4 py-2.5 rounded-lg hover:bg-brand-navy-light transition-colors disabled:opacity-60 cursor-pointer shrink-0"
          >
            {running ? (
              <>
                <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                  <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83" />
                </svg>
                Analizando...
              </>
            ) : (
              <>
                <svg width="15" height="15" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                  <path d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                </svg>
                Ejecutar Auditoría
              </>
            )}
          </button>
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-xl px-4 py-3">{error}</div>
        )}

        {loading ? (
          <div className="bg-white border border-slate-200 rounded-xl p-12 text-center text-sm text-slate-500">
            Cargando auditoría desde la base de datos...
          </div>
        ) : (
          <>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div className={`md:col-span-1 rounded-xl border-2 ${rc.border} ${rc.bg} p-5 flex flex-col items-center justify-center gap-2`}>
                <div className="flex flex-col gap-1.5 items-center">
                  <div className={`w-14 h-14 rounded-full border-4 ${rc.border} flex items-center justify-center`}>
                    <div className={`w-8 h-8 rounded-full ${rc.dot} animate-pulse`} />
                  </div>
                  <span className={`text-[11px] font-bold uppercase tracking-widest ${rc.color}`}>Nivel de Riesgo</span>
                  <span className={`text-2xl font-extrabold ${rc.color}`}>{overallRisk}</span>
                </div>
                <p className="text-[11px] text-center text-slate-500 mt-1">
                  {altoCount} crítico{altoCount !== 1 ? "s" : ""} · {medioCount} medio{medioCount !== 1 ? "s" : ""} · {bajoCount} bajo{bajoCount !== 1 ? "s" : ""}
                </p>
              </div>

              {([
                { label: "Riesgo Alto", count: altoCount, level: "Alto" as RiskLevel, desc: "Requieren acción inmediata" },
                { label: "Riesgo Medio", count: medioCount, level: "Medio" as RiskLevel, desc: "Revisar en los próximos días" },
                { label: "Riesgo Bajo", count: bajoCount, level: "Bajo" as RiskLevel, desc: "Observaciones menores" },
              ] as { label: string; count: number; level: RiskLevel; desc: string }[]).map((k) => {
                const kr = riskConfig[k.level];
                return (
                  <button
                    key={k.level}
                    onClick={() => setFilter(filter === k.level ? "Todos" : k.level)}
                    className={`rounded-xl border p-5 text-left transition-all cursor-pointer
                      ${filter === k.level ? `${kr.bg} ${kr.border} border-2` : "bg-white border-slate-200 hover:border-slate-300"}
                    `}
                  >
                    <div className={`text-3xl font-extrabold ${kr.color}`}>{k.count}</div>
                    <div className="text-[12px] font-semibold text-slate-700 mt-1">{k.label}</div>
                    <div className="text-[11px] text-slate-400">{k.desc}</div>
                  </button>
                );
              })}
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wide mr-1">Filtrar:</span>
              {(["Todos", "Alto", "Medio", "Bajo"] as (RiskLevel | "Todos")[]).map((f) => (
                <button
                  key={f}
                  onClick={() => setFilter(f)}
                  className={`text-[12px] font-semibold px-3 py-1 rounded-full border transition-colors cursor-pointer
                    ${filter === f ? "bg-brand-navy text-white border-brand-navy" : "bg-white text-slate-600 border-slate-200 hover:border-slate-400"}
                  `}
                >
                  {f}
                </button>
              ))}
              <span className="ml-auto text-[11px] text-slate-400">{filtered.length} alertas</span>
            </div>

            <div className="flex flex-col gap-3">
              {filtered.map((alert) => {
                const r = riskConfig[alert.risk];
                const isExpanded = expanded === alert.id;
                return (
                  <div
                    key={alert.id}
                    className={`bg-white border rounded-xl overflow-hidden transition-all duration-200 ${isExpanded ? "border-slate-300 shadow-sm" : "border-slate-200"}`}
                  >
                    <button
                      id={`alert-btn-${alert.id}`}
                      onClick={() => setExpanded(isExpanded ? null : alert.id)}
                      className="w-full flex items-center gap-4 p-4 text-left cursor-pointer hover:bg-slate-50 transition-colors"
                    >
                      <div className={`w-2 h-2 rounded-full shrink-0 ${r.dot}`} />
                      <div className={`w-9 h-9 rounded-lg ${r.bg} ${r.color} flex items-center justify-center shrink-0`}>
                        {typeIcons[alert.type] || typeIcons.common}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-[13px] font-semibold text-slate-800">{alert.title}</span>
                          {alert.count !== undefined && (
                            <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${r.bg} ${r.color}`}>
                              {alert.count} doc{alert.count !== 1 ? "s" : ""}
                            </span>
                          )}
                        </div>
                        <p className="text-[12px] text-slate-500 truncate mt-0.5">{alert.description}</p>
                      </div>
                      <span className={`hidden sm:block text-[10px] font-bold uppercase tracking-wide px-2 py-1 rounded-full ${r.bg} ${r.color} shrink-0`}>
                        {r.label}
                      </span>
                      <svg
                        width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"
                        className={`shrink-0 text-slate-400 transition-transform duration-200 ${isExpanded ? "rotate-180" : ""}`}
                      >
                        <path d="M6 9l6 6 6-6" />
                      </svg>
                    </button>

                    {isExpanded && (
                      <div className={`px-5 pb-4 border-t ${r.border} ${r.bg}`}>
                        <div className="flex items-start gap-2 pt-3">
                          <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2" className={`shrink-0 mt-0.5 ${r.color}`}>
                            <path d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                          </svg>
                          <p className="text-[12.5px] text-slate-700">{alert.suggestion}</p>
                        </div>
                        <div className="flex gap-2 mt-3">
                          <Link href="/chat" className="text-[12px] font-semibold px-3 py-1.5 rounded-lg bg-brand-navy text-white hover:bg-brand-navy-light transition-colors">
                            Consultar al Agente IA
                          </Link>
                          <Link href="/documentos" className="text-[12px] font-semibold px-3 py-1.5 rounded-lg border border-slate-200 text-slate-700 hover:bg-white transition-colors">
                            Ver documentos afectados
                          </Link>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}

              {filtered.length === 0 && (
                <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-8 flex flex-col items-center justify-center gap-2 text-center">
                  <div className="w-12 h-12 bg-emerald-100 rounded-full flex items-center justify-center">
                    <svg width="22" height="22" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2" className="text-emerald-600">
                      <path d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  </div>
                  <p className="text-[13px] font-semibold text-emerald-700">Sin alertas en esta categoría</p>
                  <p className="text-[12px] text-emerald-600">Todo se ve bien en el nivel seleccionado.</p>
                </div>
              )}
            </div>

            <div className="bg-slate-900 text-white rounded-xl p-5 flex items-center gap-4">
              <div className="w-10 h-10 bg-white/10 rounded-lg flex items-center justify-center shrink-0">
                <svg width="20" height="20" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.8">
                  <path d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                </svg>
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-[13px] font-bold">Agente Auditor IA</p>
                <p className="text-[12px] text-slate-400 mt-0.5">
                  {alerts.length} alertas detectadas en {comprobantesRevisados} comprobantes revisados · {formatLastRun(lastExecutedAt)}
                </p>
              </div>
            </div>
          </>
        )}
      </main>
    </>
  );
}
