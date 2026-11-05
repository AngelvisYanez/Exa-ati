"use client";

import { motion, useReducedMotion } from "motion/react";
import {
  BarChart3,
  FileText,
  LayoutDashboard,
  MessageSquare,
  Package,
  Receipt,
  Send,
  Settings,
  Sparkles,
  Users,
} from "lucide-react";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { cn } from "@/lib/utils";

const KPIS = [
  { label: "Ventas", value: "$18.420,50", sub: "42 documentos", tone: "text-brand-gray-900" },
  { label: "Compras", value: "$9.135,20", sub: "27 documentos", tone: "text-brand-gray-900" },
  { label: "Retenciones", value: "12", sub: "archivos", tone: "text-brand-gray-900" },
  { label: "En proceso", value: "2", sub: "esperando SRI", tone: "text-amber-700" },
];

const BARS = [
  { m: "Abr", v: 48, c: 30 },
  { m: "May", v: 62, c: 38 },
  { m: "Jun", v: 55, c: 41 },
  { m: "Jul", v: 74, c: 45 },
  { m: "Ago", v: 68, c: 39 },
  { m: "Sep", v: 88, c: 52 },
];

const DOCS = [
  { tipo: "FAC", nombre: "Comercial Andina S.A.", sec: "001-002-000001842", monto: "+$1.240,00", estado: "AUTORIZADO" },
  { tipo: "RET", nombre: "Distribuidora Pacífico", sec: "001-001-000000317", monto: "-$86,40", estado: "AUTORIZADO" },
  { tipo: "FAC", nombre: "Consumidor Final", sec: "001-002-000001843", monto: "+$312,75", estado: "EN_PROCESO" },
  { tipo: "NC", nombre: "Ferretería El Sol", sec: "001-002-000000091", monto: "-$45,00", estado: "AUTORIZADO" },
];

const NAV_ICONS = [LayoutDashboard, FileText, Receipt, Users, Package, BarChart3, MessageSquare, Settings];

export default function DashboardMock({
  className,
  compact = false,
}: {
  className?: string;
  compact?: boolean;
}) {
  const reduce = useReducedMotion();

  return (
    <div
      className={cn(
        "relative overflow-hidden rounded-2xl border border-brand-gray-200/70 bg-white shadow-[0_30px_80px_-30px_rgba(26,26,24,0.45)]",
        className,
      )}
      role="img"
      aria-label="Vista previa del panel EXA ATI con ventas, compras, comprobantes recientes y asistente IA"
    >
      {/* Barra de ventana */}
      <div className="flex items-center gap-2 border-b border-brand-gray-100 bg-brand-gray-50 px-3 py-2">
        <span className="size-2.5 rounded-full bg-brand-red/70" />
        <span className="size-2.5 rounded-full bg-brand-amber/70" />
        <span className="size-2.5 rounded-full bg-success-light/70" />
        <div className="ml-3 flex h-5 flex-1 items-center rounded-md bg-white px-2 text-[9px] font-medium text-brand-gray-400 border border-brand-gray-200/70">
          app.exa-ati.com/panel
        </div>
        <span className="hidden sm:inline-flex items-center gap-1 rounded-full bg-success-pale px-2 py-0.5 text-[9px] font-bold text-success">
          <span className="size-1.5 rounded-full bg-success animate-pulse-soft" /> SRI sync
        </span>
      </div>

      <div className="flex">
        {/* Sidebar */}
        <aside className="hidden sm:flex w-11 flex-col items-center gap-1.5 border-r border-brand-gray-100 bg-white py-3">
          <span className="mb-2 flex size-7 items-center justify-center rounded-lg bg-brand-red text-white text-[10px] font-extrabold">
            exa
          </span>
          {NAV_ICONS.map((Icon, i) => (
            <span
              key={i}
              className={cn(
                "flex size-7 items-center justify-center rounded-lg",
                i === 0 ? "bg-brand-red-subtle text-brand-red" : "text-brand-gray-400",
              )}
            >
              <Icon className="size-3.5" strokeWidth={2} />
            </span>
          ))}
        </aside>

        {/* Contenido */}
        <div className="flex-1 min-w-0 bg-brand-gray-50 p-3 sm:p-3.5 flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-[11px] font-bold text-brand-gray-900 leading-none">Dashboard</p>
              <p className="mt-1 text-[9px] text-brand-gray-400">RUC 1790012345001 · Comercial Andina S.A.</p>
            </div>
            <span className="rounded-md border border-brand-gray-200 bg-white px-2 py-1 text-[9px] font-semibold text-brand-gray-600">
              Sep 2026
            </span>
          </div>

          {/* KPIs */}
          <div className="grid grid-cols-2 gap-2 lg:grid-cols-4">
            {KPIS.map((k, i) => (
              <motion.div
                key={k.label}
                initial={reduce ? false : { opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.15 + i * 0.08, duration: 0.5 }}
                className="rounded-xl border border-brand-gray-200 bg-white p-2.5"
              >
                <p className="text-[8px] font-bold uppercase tracking-wider text-brand-gray-400">{k.label}</p>
                <p className={cn("mt-0.5 text-[13px] font-extrabold tabular-nums leading-tight", k.tone)}>{k.value}</p>
                <p className="text-[8.5px] text-brand-gray-500">{k.sub}</p>
              </motion.div>
            ))}
          </div>

          <div className={cn("grid gap-2", compact ? "grid-cols-1" : "grid-cols-1 lg:grid-cols-5")}>
            {/* Gráfico */}
            <div className={cn("rounded-xl border border-brand-gray-200 bg-white p-2.5", !compact && "lg:col-span-3")}>
              <div className="flex items-center justify-between">
                <p className="text-[10px] font-bold text-brand-gray-900">Resumen de flujos</p>
                <div className="flex items-center gap-2 text-[8px] font-semibold text-brand-gray-500">
                  <span className="inline-flex items-center gap-1"><span className="size-1.5 rounded-sm bg-brand-red" /> Ventas</span>
                  <span className="inline-flex items-center gap-1"><span className="size-1.5 rounded-sm bg-brand-gray-300" /> Compras</span>
                </div>
              </div>
              <div className="mt-2 flex h-[86px] items-end gap-2">
                {BARS.map((b, i) => (
                  <div key={b.m} className="flex flex-1 flex-col items-center gap-1">
                    <div className="flex h-[70px] w-full items-end justify-center gap-[3px]">
                      <motion.span
                        initial={reduce ? false : { scaleY: 0.1 }}
                        animate={{ scaleY: 1 }}
                        transition={{ delay: 0.35 + i * 0.06, duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
                        style={{ height: `${b.v}%`, originY: 1 }}
                        className="w-full max-w-[14px] rounded-t-sm bg-brand-red origin-bottom"
                      />
                      <motion.span
                        initial={reduce ? false : { scaleY: 0.1 }}
                        animate={{ scaleY: 1 }}
                        transition={{ delay: 0.4 + i * 0.06, duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
                        style={{ height: `${b.c}%`, originY: 1 }}
                        className="w-full max-w-[14px] rounded-t-sm bg-brand-gray-300 origin-bottom"
                      />
                    </div>
                    <span className="text-[8px] font-semibold text-brand-gray-400">{b.m}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Chat IA */}
            {!compact ? (
              <div className="rounded-xl border border-brand-gray-200 bg-white p-2.5 lg:col-span-2 flex flex-col">
                <div className="flex items-center gap-1.5">
                  <Sparkles className="size-3 text-brand-red" />
                  <p className="text-[10px] font-bold text-brand-gray-900">Asistente IA</p>
                </div>
                <motion.div
                  initial={reduce ? false : { opacity: 0, x: -6 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.7 }}
                  className="mt-2 self-end max-w-[85%] rounded-xl rounded-tr-sm bg-brand-red px-2 py-1.5 text-[8.5px] leading-snug text-white"
                >
                  ¿Cuánto IVA debo pagar este mes?
                </motion.div>
                <motion.div
                  initial={reduce ? false : { opacity: 0, x: 6 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 1.05 }}
                  className="mt-1.5 max-w-[92%] rounded-xl rounded-tl-sm bg-brand-gray-100 px-2 py-1.5 text-[8.5px] leading-snug text-brand-gray-700"
                >
                  IVA cobrado <b>$2.210</b> − crédito <b>$1.096</b> = <b>$1.114</b> a pagar. Vence el 18 de octubre.
                </motion.div>
                <div className="mt-auto pt-2 flex items-center gap-1.5">
                  <span className="flex-1 h-6 rounded-md border border-brand-gray-200 bg-brand-gray-50 px-2 text-[8.5px] leading-6 text-brand-gray-400">
                    Escribe tu consulta…
                  </span>
                  <span className="flex size-6 items-center justify-center rounded-md bg-brand-red text-white">
                    <Send className="size-3" />
                  </span>
                </div>
              </div>
            ) : null}
          </div>

          {/* Comprobantes recientes */}
          <div className="rounded-xl border border-brand-gray-200 bg-white p-2.5">
            <div className="flex items-center justify-between">
              <p className="text-[10px] font-bold text-brand-gray-900">Comprobantes recientes</p>
              <span className="text-[8.5px] font-bold text-brand-red">Ver todos</span>
            </div>
            <ul className="mt-1.5 divide-y divide-brand-gray-100">
              {DOCS.slice(0, compact ? 3 : 4).map((d, i) => (
                <motion.li
                  key={d.sec}
                  initial={reduce ? false : { opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.6 + i * 0.1 }}
                  className="flex items-center gap-2 py-1.5"
                >
                  <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-brand-gray-100 text-[8px] font-extrabold text-brand-gray-600">
                    {d.tipo}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[9.5px] font-semibold text-brand-gray-900 leading-tight">{d.nombre}</p>
                    <p className="truncate text-[8px] text-brand-gray-400">{d.sec}</p>
                  </div>
                  <span className="text-[9.5px] font-bold tabular-nums text-brand-gray-900">{d.monto}</span>
                  <StatusBadge estado={d.estado} className="hidden sm:inline-flex !text-[8px] !px-1.5 !py-0" />
                </motion.li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}
