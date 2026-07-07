"use client";

import Link from "next/link";
import Topbar from "@/components/Topbar";
import {
  formatDateRangeLabel,
  getDefaultDateRange,
  getIvaVencimiento,
} from "@/components/DateRangeFilter";
import FlowComparisonChart from "@/components/charts/FlowComparisonChart";
import ExpenseCategoryChart from "@/components/charts/ExpenseCategoryChart";
import MonthlyTrendChart from "@/components/charts/MonthlyTrendChart";
import DocumentDistributionChart from "@/components/charts/DocumentDistributionChart";
import FeaturedModules from "@/components/FeaturedModules";
import { useDashboardData } from "@/hooks/useDashboardData";
import { useAuth } from "@/contexts/AuthContext";
import { KpiCard } from "@/components/StatCard";
import { Skeleton } from "@/components/ui/skeleton";

const TIPO_MAP: Record<string, string> = {
  '01': 'FAC', '04': 'NC', '05': 'ND', '07': 'RET'
};

export default function Dashboard() {
  const { hasSriLinked, activeRuc } = useAuth();
  const {
    loading,
    isConnected,
    rucEmisor,
    razonSocialEmisor,
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
    notasDebitoCount,
    recentDocs,
    syncStatus,
    enProcesoCount,
    pprCount,
  } = useDashboardData(activeRuc);

  const lastSyncLabel = syncStatus?.lastSyncAt
    ? new Date(syncStatus.lastSyncAt).toLocaleString("es-EC", {
        day: "2-digit",
        month: "short",
        hour: "2-digit",
        minute: "2-digit",
      })
    : null;

  const defaultRange = getDefaultDateRange();
  const periodoLabel = formatDateRangeLabel(defaultRange);
  const vencimiento = getIvaVencimiento(defaultRange);

  return (
    <>
      <title>Dashboard - OFSERCONT IA</title>
      <meta name="description" content="Panel de control tributario. Monitorea tus comprobantes electrónicos, IVA y obligaciones SRI." />

      <Topbar
        title="Dashboard"
        lastSyncLabel={lastSyncLabel}
        syncPendientes={syncStatus?.counts.pendientes}
        isConnected={isConnected}
        enProcesoCount={enProcesoCount}
        pprCount={pprCount}
      />

      {!activeRuc ? (
        <main className="p-3 flex-1 flex flex-col gap-5 w-full">
          <div className="flex flex-col items-center justify-center py-20 gap-4">
            <div className="w-14 h-14 rounded-full bg-brand-amber/10 flex items-center justify-center">
              <svg width="28" height="28" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.5" className="text-brand-amber">
                <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 21v-4.875c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125V21m0 0h4.5V3.545M12.75 21h7.5V10.75M2.25 21h1.5m18 0h-18M2.25 9l4.5-1.636M18.75 3l-1.5.545m0 6.205l3 1m1.5.5l-1.5-.5M6.75 7.364V3h-3v18m3-13.636l10.5-3.819" />
              </svg>
            </div>
            <div className="text-center max-w-sm">
              <p className="text-sm font-bold text-brand-gray-700">Selecciona una empresa</p>
              <p className="text-xs text-brand-gray-400 mt-1">Usa el selector de empresa en la parte superior derecha para elegir un RUC y ver su dashboard.</p>
              {!hasSriLinked && (
                <button
                  onClick={() => window.dispatchEvent(new CustomEvent('sri:no-emisor'))}
                  className="mt-4 inline-flex items-center gap-1.5 bg-brand-navy text-white text-xs font-bold px-4 py-2 rounded-lg hover:bg-brand-navy-light transition-colors cursor-pointer"
                >
                  <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                    <path d="M15 7h3a5 5 0 015 5 5 5 0 01-5 5h-3m-6 0H6a5 5 0 01-5-5 5 5 0 015-5h3" />
                    <line x1="8" y1="12" x2="16" y2="12" />
                  </svg>
                  Vincular empresa al SRI
                </button>
              )}
            </div>
          </div>
        </main>
      ) : (
      <main className="p-3 flex-1 flex flex-col gap-5 w-full">
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
              <KpiCard
                label={pprCount > 0 ? "Esperando SRI" : "En Proceso"}
                value={String(pprCount + enProcesoCount)}
              />
            </>
          )}
        </section>

        {/* MODULES CAROUSEL */}
        <FeaturedModules />

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

            {/* DOCUMENT DISTRIBUTION CHART */}
            <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm flex flex-col gap-4">
              <div>
                <h3 className="text-base font-semibold tracking-tight">Distribución por Tipo</h3>
                <p className="text-xs text-slate-500 mt-0.5">Composición de comprobantes por categoría fiscal.</p>
              </div>
              {loading ? (
                <div className="h-48 flex items-center justify-center text-slate-400 text-xs animate-pulse">Cargando distribución...</div>
              ) : !isConnected || !hasSriLinked ? (
                <div className="h-48 border border-dashed border-slate-200 rounded-lg flex flex-col items-center justify-center gap-2 p-6 text-center">
                  <p className="text-xs text-slate-500 font-medium">Vincula tu RUC para ver la composición de documentos</p>
                </div>
              ) : (
                <DocumentDistributionChart
                  ventas={ventasCount}
                  compras={comprasCount}
                  retenciones={retencionesCount}
                  notasCredito={notasCreditoCount}
                  notasDebito={notasDebitoCount}
                />
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
                {isConnected && (
                  <>
                    <div className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mt-1 mb-0.5">Emisión Rápida</div>
                    <div className="grid grid-cols-2 gap-1.5">
                      <Link
                        href="/emitir"
                        className="bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 px-2.5 py-2 rounded-lg text-[11px] font-semibold text-emerald-800 flex items-center justify-center gap-1.5 transition-colors"
                      >
                        <svg width="12" height="12" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" /><polyline points="14 2 14 8 20 8" /><line x1="16" y1="13" x2="8" y2="13" /><line x1="16" y1="17" x2="8" y2="17" /></svg>
                        Factura
                      </Link>
                      <Link
                        href="/emitir"
                        className="bg-blue-50 hover:bg-blue-100 border border-blue-200 px-2.5 py-2 rounded-lg text-[11px] font-semibold text-blue-800 flex items-center justify-center gap-1.5 transition-colors"
                      >
                        <svg width="12" height="12" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path d="M12 20h9" /><path d="M16.5 3.5a2.121 2.121 0 013 3L7 19l-4 1 1-4L16.5 3.5z" /></svg>
                        Retención
                      </Link>
                      <Link
                        href="/emitir"
                        className="bg-amber-50 hover:bg-amber-100 border border-amber-200 px-2.5 py-2 rounded-lg text-[11px] font-semibold text-amber-800 flex items-center justify-center gap-1.5 transition-colors"
                      >
                        <svg width="12" height="12" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5" /><path d="M18 2l4 4-9 9-4-1 1-4 9-9z" /></svg>
                        N. Crédito
                      </Link>
                      <Link
                        href="/emitir"
                        className="bg-red-50 hover:bg-red-100 border border-red-200 px-2.5 py-2 rounded-lg text-[11px] font-semibold text-red-800 flex items-center justify-center gap-1.5 transition-colors"
                      >
                        <svg width="12" height="12" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path d="M12 1v22M17 5H9.5a3.5 3.5 0 000 7h5a3.5 3.5 0 010 7H6" /></svg>
                        N. Débito
                      </Link>
                    </div>
                    <div className="border-t border-slate-100 my-0.5"></div>
                  </>
                )}
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
                    const estadoStyles: Record<string, string> = {
                      AUTORIZADO: 'bg-emerald-50 text-emerald-700',
                      EN_PROCESO: 'bg-amber-50 text-amber-700',
                      PPR: 'bg-amber-50 text-amber-700',
                      DUPLICADO: 'bg-purple-50 text-purple-700',
                      DOCUMENTO_INVALIDO: 'bg-red-50 text-red-700',
                      TIMEOUT_SRI: 'bg-orange-50 text-orange-700',
                      RECHAZADO: 'bg-red-50 text-red-700',
                      FIRMADO: 'bg-blue-50 text-blue-700',
                      PENDIENTE: 'bg-slate-100 text-slate-600',
                    };
                    const badgeClass = estadoStyles[doc.estado] || estadoStyles.PENDIENTE;

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
                          <span className={`inline-block text-[8px] font-bold mt-1 px-1.5 py-0.5 rounded-full ${badgeClass}`}>
                            {doc.estado === 'PPR' ? 'EN PROCESO' : doc.estado}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* FIRMA DIGITAL STATUS */}
            {rucEmisor && (
              <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm flex flex-col gap-3">
                <h3 className="text-sm font-semibold tracking-tight">Firma Digital</h3>
                <div className="flex items-center gap-2.5 text-xs">
                  <span className={`w-2 h-2 rounded-full shrink-0 ${certWarning ? 'bg-amber-500' : 'bg-emerald-500'}`} />
                  <span className={`font-semibold ${certWarning ? 'text-amber-600' : 'text-emerald-600'}`}>
                    {certWarning ? 'Revisar Advertencia' : 'Certificado Al Día'}
                  </span>
                </div>
                {certWarning && (
                  <p className="text-[10px] text-amber-700 leading-relaxed">{certWarning}</p>
                )}
              </div>
            )}

          </div>

        </div>
      </main>
      )}
    </>
  );
}
