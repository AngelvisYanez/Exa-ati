"use client";

import { useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import Topbar from "@/components/layout/Topbar";
import {
  formatDateRangeLabel,
  getDefaultDateRange,
  getIvaVencimiento,
} from "@/components/DateRangeFilter";
import FlowComparisonChart from "@/components/charts/FlowComparisonChart";
import ExpenseCategoryChart from "@/components/charts/ExpenseCategoryChart";
import MonthlyTrendChart from "@/components/charts/MonthlyTrendChart";
import DocumentDistributionChart from "@/components/charts/DocumentDistributionChart";
import FeaturedModules from "@/components/dashboard/FeaturedModules";
import { useDashboardData } from "@/hooks/useDashboardData";
import { useAuth } from "@/contexts/AuthContext";
import { KpiCard } from "@/components/dashboard/StatCard";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/ui/EmptyState";
import { statusClass, statusLabel } from "@/components/ui/StatusBadge";
import { buttonVariants } from "@/components/ui/button";
import {
  FileText,
  Receipt,
  Send,
  MessageSquare,
  AlertTriangle,
  ChevronRight,
  FileSpreadsheet,
  Calculator,
  ScrollText,
  Sparkles,
} from "lucide-react";

import { generateExcelReport } from "@/lib/excel-export";
const TIPO_MAP: Record<string, string> = {
  '01': 'FAC', '04': 'NC', '05': 'ND', '07': 'RET'
};

const actionLinks = [
  { href: "/emitir", label: "Factura", color: "emerald" },
  { href: "/emitir", label: "Retención", color: "blue" },
  { href: "/emitir", label: "N. Crédito", color: "amber" },
  { href: "/emitir", label: "N. Débito", color: "red" },
];

const actionStyles: Record<string, string> = {
  emerald: "bg-success-pale hover:bg-success-pale border-success-light/40 text-success",
  blue: "bg-sky-50 hover:bg-sky-100 border-sky-200 text-brand-sky",
  amber: "bg-amber-50 hover:bg-amber-100 border-amber-200 text-amber-800",
  red: "bg-brand-red-subtle hover:bg-red-100 border-brand-red-pale text-brand-red",
};

export default function Dashboard() {
  const router = useRouter();
  const { hasSriLinked, activeRuc } = useAuth();
  const [chatQuery, setChatQuery] = useState("");
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

  const handleChatSubmit = (e: FormEvent) => {
    e.preventDefault();
    const q = chatQuery.trim();
    if (!q) return;
    router.push(`/chat?q=${encodeURIComponent(q)}`);
  };

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
      <Topbar
        title="Dashboard"
        lastSyncLabel={lastSyncLabel}
        syncPendientes={syncStatus?.counts.pendientes}
        isConnected={isConnected}
        enProcesoCount={enProcesoCount}
        pprCount={pprCount}
      />

      {!activeRuc ? (
        <main className="ui-page flex-1">
          <div className="flex flex-col items-center justify-center py-20 gap-4 animate-fade-in-up">
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
                  className="mt-4 inline-flex items-center gap-1.5 bg-brand-red text-white text-xs font-bold px-4 py-2 rounded-lg hover:bg-brand-red-bright transition-colors cursor-pointer"
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
      <main className="ui-page flex-1">
        {certWarning && (
          <div className="bg-amber-50 border border-amber-200 rounded-xl p-3.5 text-xs font-medium text-amber-800 flex items-start gap-3 shadow-sm animate-slide-down">
            <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" strokeWidth={2} />
            <div>
              <span className="font-bold">Advertencia de Firma Digital:</span> {certWarning}
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
          <div className="bg-white border border-brand-gray-200 rounded-xl p-5 flex flex-col gap-3 shadow-sm hover:shadow-md transition-shadow duration-200">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-bold uppercase tracking-widest text-brand-gray-400">Chat IA</span>
              <div className="w-7 h-7 bg-brand-red/10 rounded-lg flex items-center justify-center">
                <MessageSquare className="w-3.5 h-3.5 text-brand-red" strokeWidth={2} />
              </div>
            </div>
            <p className="text-[12px] text-brand-gray-500">
              Escribe tu consulta tributaria y abre el asistente.
            </p>
            <form onSubmit={handleChatSubmit} className="mt-auto flex flex-col gap-2">
              <label htmlFor="dashboard-chat-query" className="sr-only">
                Consulta para Chat IA
              </label>
              <textarea
                id="dashboard-chat-query"
                value={chatQuery}
                onChange={(e) => setChatQuery(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    if (chatQuery.trim()) {
                      router.push(`/chat?q=${encodeURIComponent(chatQuery.trim())}`);
                    }
                  }
                }}
                rows={3}
                placeholder="Ej: ¿Cuánto debo pagar de IVA este mes?"
                className="w-full resize-none rounded-lg border border-brand-gray-200 bg-brand-gray-50 px-3 py-2 text-[12px] text-brand-gray-800 placeholder:text-brand-gray-400 focus:border-brand-red/40 focus:bg-white focus:outline-none focus:ring-2 focus:ring-brand-red/15"
              />
              <button
                type="submit"
                disabled={!chatQuery.trim()}
                className="inline-flex items-center justify-center gap-1.5 rounded-lg bg-brand-red px-3 py-2 text-[12px] font-bold text-white transition-colors hover:bg-brand-red-bright disabled:cursor-not-allowed disabled:opacity-50"
              >
                <Send className="w-3.5 h-3.5" strokeWidth={2.5} />
                Consultar
              </button>
            </form>
          </div>

          <div className="bg-white border border-brand-gray-200 rounded-xl p-5 flex flex-col gap-3 shadow-sm hover:shadow-md transition-shadow duration-200">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-bold uppercase tracking-widest text-brand-gray-400">Documentos</span>
              <div className="w-7 h-7 bg-sky-50 rounded-lg flex items-center justify-center">
                <FileText className="w-3.5 h-3.5 text-brand-sky" strokeWidth={2} />
              </div>
            </div>
            <div className="flex flex-col gap-1.5">
              {[
                { label: "Compras", value: loading ? "—" : comprasCount, sub: periodoLabel, color: "text-brand-gray-900" },
                { label: "Ventas", value: loading ? "—" : ventasCount, sub: periodoLabel, color: "text-success" },
                { label: "Retenciones", value: loading ? "—" : retencionesCount, sub: "archivos", color: "text-brand-gray-600" },
                { label: "Notas de Crédito", value: loading ? "—" : notasCreditoCount, sub: "archivos", color: "text-brand-gray-600" },
              ].map((r) => (
                <div key={r.label} className="flex items-center justify-between text-[12px] py-0.5">
                  <span className="text-brand-gray-500">{r.label}</span>
                  <span className={`font-bold ${r.color}`}>{r.value} {typeof r.value === 'number' ? r.sub : ''}</span>
                </div>
              ))}
            </div>
            <Link href="/documentos" className="text-[12px] font-bold text-brand-red hover:text-brand-red-bright transition-colors flex items-center gap-1 mt-auto group/link">
              Ver todos
              <ChevronRight className="w-3 h-3 group-hover/link:translate-x-0.5 transition-transform" strokeWidth={2.5} />
            </Link>
          </div>

          <div className="bg-white border border-brand-gray-200 rounded-xl p-5 flex flex-col gap-3 shadow-sm hover:shadow-md transition-shadow duration-200">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-bold uppercase tracking-widest text-brand-gray-400">Declaraciones</span>
              <div className="w-7 h-7 bg-amber-50 rounded-lg flex items-center justify-center">
                <ScrollText className="w-3.5 h-3.5 text-amber-600" strokeWidth={2} />
              </div>
            </div>
            <div className="flex flex-col gap-2">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-[12px] font-semibold text-brand-gray-900">IVA &ndash; {periodoLabel}</p>
                  <p className="text-[10px] text-brand-gray-400">Vence: {vencimiento.fecha}</p>
                </div>
                <span className="text-[9px] font-bold bg-amber-50 text-amber-700 px-2 py-0.5 rounded-full border border-amber-200">PENDIENTE</span>
              </div>
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-[12px] font-semibold text-brand-gray-900">Renta &ndash; 2024</p>
                  <p className="text-[10px] text-brand-gray-400">Fecha límite: 31/03/2026</p>
                </div>
                <span className="text-[9px] font-bold bg-brand-gray-100 text-brand-gray-600 px-2 py-0.5 rounded-full">PENDIENTE</span>
              </div>
            </div>
            <Link
              href="/declaraciones/presentar"
              className={buttonVariants({ variant: "default", className: "mt-auto w-full" })}
            >
              Presentar ahora
            </Link>
          </div>
        </div>

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

        <FeaturedModules />

        <div className="grid grid-cols-1 xl:grid-cols-3 gap-4 flex-1">
          <div className="xl:col-span-2 flex flex-col gap-4">
            <div className="bg-white border border-brand-gray-200 rounded-xl p-5 shadow-sm hover:shadow-md transition-shadow duration-200 flex flex-col gap-4">
              <div>
                <h3 className="text-base font-semibold tracking-tight">Resumen de Flujos</h3>
                <p className="text-xs text-brand-gray-500 mt-0.5">Comparación directa entre ventas facturadas y compras deducibles.</p>
              </div>

              {loading ? (
                <div className="h-48 flex items-center justify-center text-brand-gray-400 text-xs animate-pulse">Cargando gráfico...</div>
              ) : !isConnected || !hasSriLinked ? (
                <div className="h-48 border border-dashed border-brand-gray-200 rounded-lg flex flex-col items-center justify-center gap-2 p-6 text-center">
                  <p className="text-xs text-brand-gray-500 font-medium">Vincula tu RUC del SRI para visualizar estadísticas financieras</p>
                  <Link href="/configuracion?vincular=true" className="text-xs font-semibold text-brand-gray-900 border border-brand-gray-200 px-3 py-1.5 rounded-md hover:bg-brand-gray-50 transition-colors">
                    Vincular SRI
                  </Link>
                </div>
              ) : (
                <FlowComparisonChart ventas={totalVentas} compras={totalCompras} />
              )}
            </div>

            <div className="bg-white border border-brand-gray-200 rounded-xl p-5 shadow-sm hover:shadow-md transition-shadow duration-200 flex flex-col gap-4">
              <div>
                <h3 className="text-base font-semibold tracking-tight">Tendencia Mensual</h3>
                <p className="text-xs text-brand-gray-500 mt-0.5">Evolución de ventas y compras por período.</p>
              </div>
              {loading ? (
                <div className="h-48 flex items-center justify-center text-brand-gray-400 text-xs animate-pulse">Cargando tendencia...</div>
              ) : isConnected && hasSriLinked ? (
                <MonthlyTrendChart data={monthlyTrend} />
              ) : (
                <EmptyState
                  icon={<Calculator className="w-5 h-5" />}
                  title="Sin datos de tendencia"
                  compact
                  className="h-48"
                />
              )}
            </div>

            <div className="bg-white border border-brand-gray-200 rounded-xl p-5 shadow-sm hover:shadow-md transition-shadow duration-200 flex flex-col gap-4">
              <div>
                <h3 className="text-base font-semibold tracking-tight">Distribución por Tipo</h3>
                <p className="text-xs text-brand-gray-500 mt-0.5">Composición de comprobantes por categoría fiscal.</p>
              </div>
              {loading ? (
                <div className="h-48 flex items-center justify-center text-brand-gray-400 text-xs animate-pulse">Cargando distribución...</div>
              ) : !isConnected || !hasSriLinked ? (
                <div className="h-48 border border-dashed border-brand-gray-200 rounded-lg flex flex-col items-center justify-center gap-2 p-6 text-center">
                  <p className="text-xs text-brand-gray-500 font-medium">Vincula tu RUC para ver la composición de documentos</p>
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

            <div className="bg-white border border-brand-gray-200 rounded-xl p-5 shadow-sm hover:shadow-md transition-shadow duration-200 flex flex-col gap-4 flex-1">
              <div>
                <h3 className="text-base font-semibold tracking-tight">Distribución de Gastos Deducibles</h3>
                <p className="text-xs text-brand-gray-500 mt-0.5">Clasificación automatizada de compras deducibles por rubros.</p>
              </div>

              {loading ? (
                <div className="h-48 flex items-center justify-center text-brand-gray-400 text-xs animate-pulse">Cargando categorías...</div>
              ) : !isConnected || comprasCount === 0 ? (
                <EmptyState
                  icon={<Calculator className="w-5 h-5" />}
                  title="No hay datos de compras deducibles registrados para clasificar."
                  compact
                />
              ) : (
                <ExpenseCategoryChart categories={categories} />
              )}
            </div>
          </div>

          <div className="flex flex-col gap-4">
            <div className="bg-white border border-brand-gray-200 rounded-xl p-4 shadow-sm hover:shadow-md transition-shadow duration-200 flex flex-col gap-3">
              <div className="flex items-center gap-2 mb-1">
                <Sparkles className="w-4 h-4 text-brand-red" strokeWidth={1.8} />
                <h3 className="text-sm font-semibold tracking-tight">Acciones Rápidas</h3>
              </div>
              <div className="flex flex-col gap-2">
                {isConnected && (
                  <>
                    <div className="text-[10px] font-bold uppercase tracking-widest text-brand-gray-400 mt-1 mb-0.5">Emisión Rápida</div>
                    <div className="grid grid-cols-2 gap-1.5">
                      {actionLinks.map((a) => (
                        <Link
                          key={a.label}
                          href={a.href}
                          className={`${actionStyles[a.color]} border px-2.5 py-2 rounded-lg text-[11px] font-semibold flex items-center justify-center gap-1.5 transition-all duration-200 hover:scale-[1.02] active:scale-[0.98]`}
                        >
                          <FileSpreadsheet className="w-3.5 h-3.5" strokeWidth={2} />
                          {a.label}
                        </Link>
                      ))}
                    </div>
                    <div className="border-t border-brand-gray-100 my-0.5" />
                  </>
                )}
                <Link href="/documentos" className="w-full text-left bg-brand-gray-50 hover:bg-brand-gray-100 border border-brand-gray-200 px-4 py-2.5 rounded-lg text-xs font-semibold flex items-center justify-between transition-all duration-200 group">
                  <span>Ver comprobantes</span>
                  <ChevronRight className="w-3.5 h-3.5 text-brand-gray-500 group-hover:translate-x-0.5 transition-transform" strokeWidth={2} />
                </Link>
                <Link href="/declaraciones" className="w-full text-left bg-brand-gray-50 hover:bg-brand-gray-100 border border-brand-gray-200 px-4 py-2.5 rounded-lg text-xs font-semibold flex items-center justify-between transition-all duration-200 group">
                  <span>Calcular Declaración de IVA</span>
                  <ChevronRight className="w-3.5 h-3.5 text-brand-gray-500 group-hover:translate-x-0.5 transition-transform" strokeWidth={2} />
                </Link>
                <Link href="/chat" className="w-full text-left bg-brand-gray-50 hover:bg-brand-gray-100 border border-brand-gray-200 px-4 py-2.5 rounded-lg text-xs font-semibold flex items-center justify-between transition-all duration-200 group">
                  <span>Asistente Tributario IA</span>
                  <ChevronRight className="w-3.5 h-3.5 text-brand-gray-500 group-hover:translate-x-0.5 transition-transform" strokeWidth={2} />
                </Link>
              </div>
            </div>

            <div className="bg-white border border-brand-gray-200 rounded-xl p-4 shadow-sm hover:shadow-md transition-shadow duration-200 flex flex-col gap-4 flex-1">
              <div className="flex justify-between items-center">
                <h3 className="text-sm font-semibold tracking-tight">Comprobantes Recientes</h3>
                <div className="flex items-center gap-2">
                  {recentDocs.length > 0 && (
                    <button
                      type="button"
                      onClick={() => {
                        generateExcelReport({
                          title: "Resumen de Comprobantes Recientes SRI",
                          subtitle: `Empresa: ${razonSocialEmisor || rucEmisor || "General"}`,
                          filename: `Comprobantes_SRI_${new Date().toISOString().slice(0, 10)}`,
                          columns: [
                            { header: "Tipo", key: "tipo", width: 12 },
                            { header: "Cliente / Proveedor", key: "nombre", width: 35 },
                            { header: "Secuencial", key: "secuencial", width: 24 },
                            { header: "Fecha Emisión", key: "fecha", width: 16 },
                            { header: "Monto Total", key: "monto", width: 16 },
                            { header: "Estado SRI", key: "estado", width: 16 },
                          ],
                          data: recentDocs.map((doc) => ({
                            tipo: TIPO_MAP[doc.tipoComprobante] || doc.tipoComprobante,
                            nombre: doc.emisor?.ruc === rucEmisor ? (doc.receptorRazonSocial || "Consumidor Final") : (doc.emisor?.razonSocial || "Proveedor"),
                            secuencial: doc.secuencial || "—",
                            fecha: doc.fechaEmision ? new Date(doc.fechaEmision).toLocaleDateString("es-EC") : "—",
                            monto: `$${doc.importeTotal.toFixed(2)}`,
                            estado: statusLabel(doc.estado),
                          })),
                        });
                      }}
                      className="text-xs font-bold text-brand-red hover:text-brand-red-bright transition-colors flex items-center gap-1 cursor-pointer bg-brand-red-subtle hover:bg-red-100 border border-brand-red/20 px-2 py-1 rounded-lg"
                      title="Exportar a Excel"
                    >
                      <FileSpreadsheet className="w-3.5 h-3.5" />
                      Exportar Excel
                    </button>
                  )}
                  <Link href="/documentos" className="text-xs font-bold text-brand-gray-500 hover:text-brand-gray-900 transition-colors">
                    Ver todos
                  </Link>
                </div>
              </div>

              {loading ? (
                <div className="flex flex-col gap-3 py-2">
                  {[1, 2, 3].map(n => (
                    <div key={n} className="flex items-center gap-3 animate-pulse">
                      <div className="w-8 h-8 rounded-full bg-brand-gray-100 shrink-0" />
                      <div className="flex-1 flex flex-col gap-1.5">
                        <div className="h-3 bg-brand-gray-100 rounded w-2/3" />
                        <div className="h-2 bg-brand-gray-100 rounded w-1/3" />
                      </div>
                    </div>
                  ))}
                </div>
              ) : !isConnected || !hasSriLinked ? (
                <EmptyState
                  icon={<Receipt className="w-5 h-5" />}
                  title="Vincula tu cuenta del SRI para ver transacciones."
                  compact
                />
              ) : recentDocs.length === 0 ? (
                <EmptyState
                  icon={<FileText className="w-5 h-5" />}
                  title="No hay comprobantes para mostrar."
                  compact
                />
              ) : (
                <div className="flex flex-col gap-3.5">
                  {recentDocs.map((doc, idx) => {
                    const tipoShort = TIPO_MAP[doc.tipoComprobante] || doc.tipoComprobante;
                    const isVenta = doc.emisor?.ruc === rucEmisor;
                    const name = isVenta
                      ? (doc.receptorRazonSocial || "Consumidor Final")
                      : (doc.emisor?.razonSocial || "Proveedor");

                    const badgeClass = statusClass(doc.estado);

                    return (
                      <div key={doc.id || idx} className="flex items-center gap-3 group cursor-pointer hover:bg-brand-gray-50 rounded-lg -mx-1 px-1 py-0.5 transition-colors">
                        <div className="w-8 h-8 rounded-full bg-brand-gray-100 flex items-center justify-center font-bold text-[10px] text-brand-gray-600 shrink-0 group-hover:bg-brand-gray-200 transition-colors">
                          {tipoShort}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-semibold text-brand-gray-900 truncate leading-snug">{name}</p>
                          <p className="text-[10px] text-brand-gray-400 truncate leading-snug mt-0.5">
                            {doc.secuencial} &middot; {doc.fechaEmision ? new Date(doc.fechaEmision).toLocaleDateString('es-EC', { day: 'numeric', month: 'short' }) : "—"}
                          </p>
                        </div>
                        <div className="text-right shrink-0">
                          <p className={`text-xs font-bold leading-snug ${isVenta ? 'text-brand-gray-900' : 'text-brand-gray-600'}`}>
                            {isVenta ? '+' : '-'}${doc.importeTotal.toFixed(2)}
                          </p>
                          <span className={`inline-block text-[8px] font-bold mt-1 px-1.5 py-0.5 rounded-full ${badgeClass}`}>
                            {statusLabel(doc.estado)}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {rucEmisor && (
              <div className="bg-white border border-brand-gray-200 rounded-xl p-4 shadow-sm hover:shadow-md transition-shadow duration-200 flex flex-col gap-3">
                <h3 className="text-sm font-semibold tracking-tight">Firma Digital</h3>
                <div className="flex items-center gap-2.5 text-xs">
                  <span className={`w-2 h-2 rounded-full shrink-0 ${certWarning ? 'bg-amber-500 animate-pulse-soft' : 'bg-success'}`} />
                  <span className={`font-semibold ${certWarning ? 'text-amber-600' : 'text-success'}`}>
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
