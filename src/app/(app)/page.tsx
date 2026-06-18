"use client";

import { useState } from "react";
import Link from "next/link";
import Topbar from "@/components/Topbar";
import DateRangeFilter, {
  DateRange,
  formatDateRangeLabel,
  getDefaultDateRange,
  getIvaVencimiento,
} from "@/components/DateRangeFilter";
import FlowComparisonChart from "@/components/charts/FlowComparisonChart";
import ExpenseCategoryChart from "@/components/charts/ExpenseCategoryChart";
import MonthlyTrendChart from "@/components/charts/MonthlyTrendChart";
import { useDashboardData } from "@/hooks/useDashboardData";
import { useAuth } from "@/contexts/AuthContext";
import { KpiCard } from "@/components/StatCard";
import { Skeleton } from "@/components/ui/skeleton";

const TIPO_MAP: Record<string, string> = {
  '01': 'FAC', '04': 'NC', '05': 'ND', '07': 'RET'
};

export default function Dashboard() {
  const { hasSriLinked } = useAuth();
  const [dateRange, setDateRange] = useState<DateRange>(getDefaultDateRange);
  const {
    loading,
    isConnected,
    rucEmisor,
    certWarning,
    categories,
    monthlyTrend,
    totalVentas,
    totalCompras,
    ivaAPagar,
    ventasCount,
    comprasCount,
    retencionesCount,
    noAuthCount,
    notasCreditoCount,
    recentDocs,
    syncStatus,
  } = useDashboardData(dateRange);

  const lastSyncLabel = syncStatus?.lastSyncAt
    ? new Date(syncStatus.lastSyncAt).toLocaleString("es-EC", {
        day: "2-digit",
        month: "short",
        hour: "2-digit",
        minute: "2-digit",
      })
    : null;

  const periodoLabel = formatDateRangeLabel(dateRange);
  const vencimiento = getIvaVencimiento(dateRange);

  return (
    <>
      <title>Dashboard - OFSERCONT IA</title>
      <meta name="description" content="Panel de control tributario. Monitorea tus comprobantes electrónicos, IVA y obligaciones SRI." />

      <Topbar title="Dashboard" period={formatDateRangeLabel(dateRange)} />

      <main className="p-3 flex-1 flex flex-col gap-5 w-full">
        <DateRangeFilter value={dateRange} onChange={setDateRange} className="bg-white border border-slate-200 rounded-xl px-4 py-3" />
        {/* CERTIFICATE WARNING IF ANY */}
        {certWarning && (
          <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-xs font-medium text-amber-800 flex items-start gap-2.5 shadow-sm">
            <svg className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24">
              <circle cx="12" cy="12" r="10"></circle>
              <line x1="12" y1="8" x2="12" y2="12"></line>
              <line x1="12" y1="16" x2="12.01" y2="16"></line>
            </svg>
            <div>
              <span className="font-bold">Advertencia de Firma Digital:</span> {certWarning}
            </div>
          </div>
        )}

        {/* HEADER BLOCK */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Panel de Control</h1>
            <p className="text-sm text-slate-500 mt-1">
              Monitoreo en tiempo real de tus comprobantes electrónicos y obligaciones tributarias.
            </p>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            {hasSriLinked && syncStatus && (
              <Link
                href="/documentos"
                className="bg-slate-50 border border-slate-200 rounded-lg px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-100 transition-colors"
                title={syncStatus.lastSync?.message || "Ir a documentos para sincronizar"}
              >
                <span className="font-semibold text-slate-800">Último sync:</span>{" "}
                {lastSyncLabel || "Nunca"}
                {(syncStatus.counts.pendientes ?? 0) > 0 && (
                  <span className="ml-1.5 text-amber-700 font-bold">
                    · {syncStatus.counts.pendientes} pendientes
                  </span>
                )}
              </Link>
            )}
            {isConnected && (
              <div className="bg-emerald-50 border border-emerald-200 rounded-lg px-3 py-1.5 text-xs font-semibold text-emerald-700 flex items-center gap-2">
                <span className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse"></span>
                API SRI Conectado
              </div>
            )}
            <Link
              href="/declaraciones/presentar"
              className="flex items-center gap-1.5 bg-brand-navy text-white text-xs font-bold px-3 py-1.5 rounded-lg hover:bg-brand-navy-light transition-colors"
            >
              <svg width="12" height="12" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                <path d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
              </svg>
              Presentar al SRI
            </Link>
          </div>
        </div>

        {/* ── 4 INTERACTION CARDS FROM DIAGRAM (Section 8) ── */}
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">

          {/* Card 1: Resumen General – IVA a pagar */}
          <div className="bg-slate-900 text-white rounded-xl p-5 flex flex-col gap-3">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Resumen General</span>
              <div className="w-6 h-6 bg-white/10 rounded-md flex items-center justify-center">
                <svg width="12" height="12" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                  <path d="M12 1v22M17 5H9.5a3.5 3.5 0 000 7h5a3.5 3.5 0 010 7H6" />
                </svg>
              </div>
            </div>
            <div>
              <p className="text-[12px] text-slate-400 leading-relaxed">
                Tu IVA a pagar este mes es
              </p>
              <p className="text-3xl font-extrabold text-white mt-0.5">
                {loading ? "—" : `$${ivaAPagar.toFixed(2)}`}
              </p>
              <p className="text-[11px] text-amber-400 font-semibold mt-1">
                📅 Fecha límite: {vencimiento.fecha}
              </p>
            </div>
            <Link
              href="/declaraciones/presentar"
              className="mt-auto text-[11px] font-bold bg-white/10 hover:bg-white/20 text-white px-3 py-1.5 rounded-lg transition-colors text-center"
            >
              ¿Deseas que la presente por ti?
            </Link>
          </div>

          {/* Card 2: Chat IA */}
          <div className="bg-white border border-slate-200 rounded-xl p-5 flex flex-col gap-3">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Chat IA</span>
              <div className="w-6 h-6 bg-brand-navy/10 rounded-md flex items-center justify-center">
                <svg width="12" height="12" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2" className="text-brand-navy">
                  <path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z" />
                </svg>
              </div>
            </div>
            <div className="flex-1">
              <div className="bg-slate-50 rounded-lg p-3 text-[12px] text-slate-600 italic">
                "¿Cuánto debo pagar de IVA este mes?"
              </div>
              <div className="bg-brand-navy/5 border border-brand-navy/10 rounded-lg p-3 mt-2 text-[12px] text-slate-700">
                Tu IVA a pagar este mes es{" "}
                <strong>${ivaAPagar.toFixed(2)}</strong>. Fecha límite: 15/07.
              </div>
            </div>
            <Link
              href="/chat"
              className="text-[12px] font-bold text-brand-navy hover:text-brand-navy-light transition-colors flex items-center gap-1"
            >
              Abrir asistente →
            </Link>
          </div>

          {/* Card 3: Documentos por tipo */}
          <div className="bg-white border border-slate-200 rounded-xl p-5 flex flex-col gap-3">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Documentos</span>
              <div className="w-6 h-6 bg-blue-50 rounded-md flex items-center justify-center">
                <svg width="12" height="12" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2" className="text-blue-600">
                  <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" />
                  <polyline points="14 2 14 8 20 8" />
                </svg>
              </div>
            </div>
            <div className="flex flex-col gap-1.5">
              {[
                { label: "Compras", value: loading ? "—" : comprasCount, sub: periodoLabel, color: "text-slate-900" },
                { label: "Ventas", value: loading ? "—" : ventasCount, sub: periodoLabel, color: "text-emerald-700" },
                { label: "Retenciones", value: loading ? "—" : retencionesCount, sub: "archivos", color: "text-slate-600" },
                { label: "Notas de Crédito", value: loading ? "—" : notasCreditoCount, sub: "archivos", color: "text-slate-600" },
              ].map((r) => (
                <div key={r.label} className="flex items-center justify-between text-[12px]">
                  <span className="text-slate-500">{r.label}</span>
                  <span className={`font-bold ${r.color}`}>{r.value} {typeof r.value === 'number' ? r.sub : ''}</span>
                </div>
              ))}
            </div>
            <Link href="/documentos" className="text-[12px] font-bold text-brand-navy hover:text-brand-navy-light transition-colors flex items-center gap-1 mt-auto">
              Ver todos →
            </Link>
          </div>

          {/* Card 4: Estado de Declaraciones */}
          <div className="bg-white border border-slate-200 rounded-xl p-5 flex flex-col gap-3">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Declaraciones</span>
              <div className="w-6 h-6 bg-amber-50 rounded-md flex items-center justify-center">
                <svg width="12" height="12" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2" className="text-amber-600">
                  <path d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
              </div>
            </div>
            <div className="flex flex-col gap-2">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-[12px] font-semibold text-slate-900">IVA – {periodoLabel}</p>
                  <p className="text-[10px] text-slate-400">Vence: {vencimiento.fecha}</p>
                </div>
                <span className="text-[9px] font-bold bg-amber-50 text-amber-700 px-2 py-0.5 rounded-full border border-amber-200">PENDIENTE</span>
              </div>
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-[12px] font-semibold text-slate-900">Renta – 2024</p>
                  <p className="text-[10px] text-slate-400">Fecha límite: 31/03/2026</p>
                </div>
                <span className="text-[9px] font-bold bg-slate-100 text-slate-600 px-2 py-0.5 rounded-full">PENDIENTE</span>
              </div>
            </div>
            <Link
              href="/declaraciones/presentar"
              className="mt-auto w-full text-center text-[12px] font-bold bg-brand-navy text-white py-2 rounded-lg hover:bg-brand-navy-light transition-colors"
            >
              Presentar ahora
            </Link>
          </div>
        </div>

        {/* 4 KPI CARDS GRID */}
        <section aria-label="Indicadores Clave" className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {loading ? (
            <>
              <Skeleton className="h-24 rounded-xl" />
              <Skeleton className="h-24 rounded-xl" />
              <Skeleton className="h-24 rounded-xl" />
              <Skeleton className="h-24 rounded-xl" />
            </>
          ) : (
            <>
              <KpiCard
                label="Ventas"
                value={`$${totalVentas.toLocaleString("es-EC", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
                count={ventasCount}
              />
              <KpiCard
                label="Compras"
                value={`$${totalCompras.toLocaleString("es-EC", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
                count={comprasCount}
              />
              <KpiCard label="Retenciones" value={String(retencionesCount)} />
              <KpiCard label="Alertas" value={String(noAuthCount)} />
            </>
          )}
        </section>

        {/* MAIN CONTENT GRID: chart+categories left, sidebar right */}
        <div className="grid grid-cols-1 xl:grid-cols-3 gap-5 flex-1">
          
          {/* COLUMN 1 & 2: OVERVIEW AND CATEGORIES (SPAN 2) */}
          <div className="xl:col-span-2 flex flex-col gap-5">
            
            {/* COMPARATIVE FLOW CHART CARD */}
            <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm flex flex-col gap-4">
              <div>
                <h3 className="text-base font-semibold tracking-tight">Resumen de Flujos</h3>
                <p className="text-xs text-slate-500 mt-0.5">Comparación directa entre ventas facturadas y compras deducibles.</p>
              </div>

              {loading ? (
                <div className="h-48 flex items-center justify-center text-slate-400 text-xs animate-pulse">Cargando gráfico...</div>
              ) : !isConnected || !hasSriLinked ? (
                <div className="h-48 border border-dashed border-slate-200 rounded-lg flex flex-col items-center justify-center gap-2 p-6 text-center">
                  <p className="text-xs text-slate-500 font-medium">Vincula tu RUC del SRI para visualizar estadísticas financieras</p>
                  <Link href="/configuracion?vincular=true" className="text-xs font-semibold text-slate-900 border border-slate-200 px-3 py-1.5 rounded-md hover:bg-slate-50">
                    Vincular SRI
                  </Link>
                </div>
              ) : (
                <FlowComparisonChart ventas={totalVentas} compras={totalCompras} />
              )}
            </div>

            <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm flex flex-col gap-4">
              <div>
                <h3 className="text-base font-semibold tracking-tight">Tendencia Mensual</h3>
                <p className="text-xs text-slate-500 mt-0.5">Evolución de ventas y compras por período.</p>
              </div>
              {loading ? (
                <div className="h-48 flex items-center justify-center text-slate-400 text-xs animate-pulse">Cargando tendencia...</div>
              ) : isConnected && hasSriLinked ? (
                <MonthlyTrendChart data={monthlyTrend} />
              ) : (
                <div className="h-48 flex items-center justify-center text-slate-400 text-xs">Sin datos de tendencia</div>
              )}
            </div>

            {/* SPEND BY CATEGORIES CARD */}
            <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm flex flex-col gap-4 flex-1">
              <div>
                <h3 className="text-base font-semibold tracking-tight">Distribución de Gastos Deducibles</h3>
                <p className="text-xs text-slate-500 mt-0.5">Clasificación automatizada de compras deducibles por rubros.</p>
              </div>

              {loading ? (
                <div className="h-48 flex items-center justify-center text-slate-400 text-xs animate-pulse">Cargando categorías...</div>
              ) : !isConnected || comprasCount === 0 ? (
                <div className="py-6 text-center text-slate-400 text-xs">No hay datos de compras deducibles registrados para clasificar.</div>
              ) : (
                <ExpenseCategoryChart categories={categories} />
              )}
            </div>
          </div>

          {/* COLUMN 3: RECENT COMPROBANTES & QUICK LINKS */}
          <div className="flex flex-col gap-5">
            {/* QUICK ACTIONS CARD */}
            <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm flex flex-col gap-3">
              <h3 className="text-sm font-semibold tracking-tight mb-1">Acciones Administrativas</h3>
              <div className="flex flex-col gap-2">
                <Link href="/documentos" className="w-full text-left bg-slate-50 hover:bg-slate-100 border border-slate-200 px-4 py-2.5 rounded-lg text-xs font-semibold flex items-center justify-between transition-colors">
                  <span>Sincronizar y ver comprobantes</span>
                  <svg className="w-3.5 h-3.5 text-slate-500" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24">
                    <polyline points="9 18 15 12 9 6"></polyline>
                  </svg>
                </Link>
                <Link href="/declaraciones" className="w-full text-left bg-slate-50 hover:bg-slate-100 border border-slate-200 px-4 py-2.5 rounded-lg text-xs font-semibold flex items-center justify-between transition-colors">
                  <span>Calcular Declaración de IVA</span>
                  <svg className="w-3.5 h-3.5 text-slate-500" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24">
                    <polyline points="9 18 15 12 9 6"></polyline>
                  </svg>
                </Link>
                <Link href="/chat" className="w-full text-left bg-slate-50 hover:bg-slate-100 border border-slate-200 px-4 py-2.5 rounded-lg text-xs font-semibold flex items-center justify-between transition-colors">
                  <span>Asistente Tributario IA</span>
                  <svg className="w-3.5 h-3.5 text-slate-500" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24">
                    <polyline points="9 18 15 12 9 6"></polyline>
                  </svg>
                </Link>
              </div>
            </div>

            {/* RECENT DOCUMENTS CARD */}
            <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm flex flex-col gap-4 flex-1">
              <div className="flex justify-between items-center">
                <h3 className="text-sm font-semibold tracking-tight">Comprobantes Recientes</h3>
                <Link href="/documentos" className="text-xs font-bold text-slate-500 hover:text-slate-900 transition-colors">
                  Ver todos
                </Link>
              </div>

              {loading ? (
                <div className="flex flex-col gap-3 py-2">
                  {[1, 2, 3].map(n => (
                    <div key={n} className="flex items-center gap-3 animate-pulse">
                      <div className="w-8 h-8 rounded-full bg-slate-100 shrink-0"></div>
                      <div className="flex-1 flex flex-col gap-1.5">
                        <div className="h-3 bg-slate-100 rounded w-2/3"></div>
                        <div className="h-2 bg-slate-100 rounded w-1/3"></div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : !isConnected || !hasSriLinked ? (
                <div className="text-center py-6 text-slate-400 text-xs">
                  Vincula tu cuenta del SRI para ver transacciones.
                </div>
              ) : recentDocs.length === 0 ? (
                <div className="text-center py-6 text-slate-400 text-xs">No hay comprobantes para mostrar.</div>
              ) : (
                <div className="flex flex-col gap-3.5">
                  {recentDocs.map((doc, idx) => {
                    const tipoShort = TIPO_MAP[doc.tipoComprobante] || doc.tipoComprobante;
                    const isVenta = doc.emisor?.ruc === rucEmisor;
                    const name = isVenta 
                      ? (doc.receptorRazonSocial || "Consumidor Final")
                      : (doc.emisor?.razonSocial || "Proveedor");
                    
                    const isAutorizado = doc.estado === 'AUTORIZADO';

                    return (
                      <div key={doc.id || idx} className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center font-bold text-[10px] text-slate-600 shrink-0">
                          {tipoShort}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-semibold text-slate-950 truncate leading-snug">{name}</p>
                          <p className="text-[10px] text-slate-400 truncate leading-snug mt-0.5">
                            {doc.secuencial} · {doc.fechaEmision ? new Date(doc.fechaEmision).toLocaleDateString('es-EC', { day: 'numeric', month: 'short' }) : "—"}
                          </p>
                        </div>
                        <div className="text-right shrink-0">
                          <p className={`text-xs font-bold leading-snug ${isVenta ? 'text-slate-950' : 'text-slate-600'}`}>
                            {isVenta ? '+' : '-'}${doc.importeTotal.toFixed(2)}
                          </p>
                          <span className={`inline-block text-[8px] font-bold mt-1 px-1.5 py-0.5 rounded-full ${isAutorizado ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-700'}`}>
                            {doc.estado}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* TENANT SUMMARY INFORMATION */}
            <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm flex flex-col gap-3">
              <h3 className="text-sm font-semibold tracking-tight">Datos del Contribuyente</h3>
              <div className="flex flex-col gap-2.5 text-xs text-slate-600">
                <div className="flex justify-between py-1 border-b border-slate-100">
                  <span>RUC Registrado</span>
                  <span className="font-mono font-bold text-slate-900">{rucEmisor || "No disponible"}</span>
                </div>
                <div className="flex justify-between py-1">
                  <span>Firma Digital</span>
                  <span className={`font-semibold ${certWarning ? 'text-amber-600' : 'text-emerald-600'}`}>
                    {certWarning ? 'Revisar Advertencia' : 'Certificado Al Día'}
                  </span>
                </div>
              </div>
            </div>

          </div>

        </div>
      </main>
    </>
  );
}
