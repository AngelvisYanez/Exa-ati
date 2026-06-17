"use client";

import { useState } from "react";

export type DateRange = {
  from: string; // YYYY-MM-DD
  to: string;   // YYYY-MM-DD
};

export type QuickPeriod = {
  label: string;
  key: string;
  from: string;
  to: string;
};

function getQuickPeriods(): QuickPeriod[] {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth(); // 0-indexed

  const pad = (n: number) => String(n).padStart(2, "0");
  const lastDayOf = (y: number, m: number) =>
    new Date(y, m + 1, 0).getDate();

  // Current month
  const cmFrom = `${year}-${pad(month + 1)}-01`;
  const cmTo = `${year}-${pad(month + 1)}-${pad(lastDayOf(year, month))}`;

  // Previous month
  const prevM = month === 0 ? 11 : month - 1;
  const prevY = month === 0 ? year - 1 : year;
  const pmFrom = `${prevY}-${pad(prevM + 1)}-01`;
  const pmTo = `${prevY}-${pad(prevM + 1)}-${pad(lastDayOf(prevY, prevM))}`;

  // Current quarter
  const qStart = Math.floor(month / 3) * 3;
  const qFrom = `${year}-${pad(qStart + 1)}-01`;
  const qToM = qStart + 2;
  const qTo = `${year}-${pad(qToM + 1)}-${pad(lastDayOf(year, qToM))}`;

  // Current year
  const cyFrom = `${year}-01-01`;
  const cyTo = `${year}-12-31`;

  // Last year
  const lyFrom = `${year - 1}-01-01`;
  const lyTo = `${year - 1}-12-31`;

  const MONTHS_ES = [
    "Ene", "Feb", "Mar", "Abr", "May", "Jun",
    "Jul", "Ago", "Sep", "Oct", "Nov", "Dic",
  ];

  return [
    { key: "cm",   label: `${MONTHS_ES[month]} ${year}`,          from: cmFrom, to: cmTo },
    { key: "pm",   label: `${MONTHS_ES[prevM]} ${prevY}`,         from: pmFrom, to: pmTo },
    { key: "q",    label: `T${Math.floor(month / 3) + 1} ${year}`, from: qFrom,  to: qTo  },
    { key: "cy",   label: `Año ${year}`,                           from: cyFrom, to: cyTo  },
    { key: "ly",   label: `Año ${year - 1}`,                       from: lyFrom, to: lyTo  },
    { key: "all",  label: "Todos",                                  from: "",     to: ""    },
  ];
}

export function getDefaultDateRange(): DateRange {
  const cm = getQuickPeriods().find((p) => p.key === "cm")!;
  return { from: cm.from, to: cm.to };
}

export function formatDateRangeLabel(range: DateRange): string {
  if (!range.from && !range.to) return "Todas las fechas";
  if (range.from && range.to) {
    const from = new Date(`${range.from}T12:00:00`);
    const to = new Date(`${range.to}T12:00:00`);
    const sameMonth =
      from.getFullYear() === to.getFullYear() && from.getMonth() === to.getMonth();
    const fromStr = from.toLocaleDateString("es-EC", { day: "numeric", month: "short", year: "numeric" });
    const toStr = to.toLocaleDateString("es-EC", { day: "numeric", month: "short", year: "numeric" });
    if (sameMonth && from.getDate() === 1) {
      const lastDay = new Date(from.getFullYear(), from.getMonth() + 1, 0).getDate();
      if (to.getDate() === lastDay) {
        return from.toLocaleDateString("es-EC", { month: "long", year: "numeric" });
      }
    }
    return `${fromStr} – ${toStr}`;
  }
  return "Rango personalizado";
}

export function toDateRangeParams(range: DateRange): { fechaDesde?: string; fechaHasta?: string } {
  return {
    ...(range.from ? { fechaDesde: range.from } : {}),
    ...(range.to ? { fechaHasta: range.to } : {}),
  };
}

/** Máximo de comprobantes a listar cuando hay filtro de fecha de emisión */
export const COMPROBANTES_PERIOD_LIST_LIMIT = 2000;
export const COMPROBANTES_DEFAULT_LIST_LIMIT = 200;

export function getComprobantesListLimit(range: DateRange): number {
  if (range.from || range.to) return COMPROBANTES_PERIOD_LIST_LIMIT;
  return COMPROBANTES_DEFAULT_LIST_LIMIT;
}

/** Vencimiento IVA: día 15 del mes siguiente al período */
export function getIvaVencimiento(range: DateRange): {
  fecha: string;
  diasRestantes: number | null;
} {
  if (!range.to) return { fecha: "—", diasRestantes: null };
  const end = new Date(`${range.to}T12:00:00`);
  const venc = new Date(end.getFullYear(), end.getMonth() + 1, 15, 12, 0, 0);
  const hoy = new Date();
  hoy.setHours(12, 0, 0, 0);
  const dias = Math.ceil((venc.getTime() - hoy.getTime()) / 86400000);
  return {
    fecha: venc.toLocaleDateString("es-EC", {
      day: "numeric",
      month: "short",
      year: "numeric",
    }),
    diasRestantes: dias,
  };
}

interface DateRangeFilterProps {
  value: DateRange;
  onChange: (range: DateRange) => void;
  /** Etiqueta del filtro (por defecto: fecha de emisión) */
  filterLabel?: string;
  /** Show the custom date pickers inline (default: true) */
  showCustom?: boolean;
  /** Extra class for the root wrapper */
  className?: string;
}

export default function DateRangeFilter({
  value,
  onChange,
  filterLabel = "Fecha emisión",
  showCustom = true,
  className = "",
}: DateRangeFilterProps) {
  const periods = getQuickPeriods();
  const [showCustomPicker, setShowCustomPicker] = useState(false);

  const activeKey =
    periods.find((p) => p.from === value.from && p.to === value.to)?.key ??
    "custom";

  const handleQuick = (p: QuickPeriod) => {
    onChange({ from: p.from, to: p.to });
    setShowCustomPicker(false);
  };

  const handleCustom = (field: "from" | "to", val: string) => {
    onChange({ ...value, [field]: val });
  };

  return (
    <div className={`flex flex-col gap-2 ${className}`}>
      {/* Quick period pills */}
      <div className="flex flex-wrap items-center gap-1.5">
        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mr-1 hidden sm:block">
          {filterLabel}:
        </span>
        {periods.map((p) => (
          <button
            key={p.key}
            onClick={() => handleQuick(p)}
            className={`text-[11px] font-semibold px-2.5 py-1 rounded-full border transition-all cursor-pointer whitespace-nowrap
              ${activeKey === p.key
                ? "bg-brand-navy text-white border-brand-navy shadow-sm"
                : "bg-white text-slate-600 border-slate-200 hover:border-slate-400 hover:text-slate-800"
              }`}
          >
            {p.label}
          </button>
        ))}

        {/* Custom range toggle */}
        {showCustom && (
          <button
            onClick={() => setShowCustomPicker((v) => !v)}
            className={`text-[11px] font-semibold px-2.5 py-1 rounded-full border transition-all cursor-pointer flex items-center gap-1
              ${activeKey === "custom" || showCustomPicker
                ? "bg-slate-800 text-white border-slate-800"
                : "bg-white text-slate-600 border-slate-200 hover:border-slate-400"
              }`}
          >
            <svg width="11" height="11" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
              <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
              <line x1="16" y1="2" x2="16" y2="6" />
              <line x1="8" y1="2" x2="8" y2="6" />
              <line x1="3" y1="10" x2="21" y2="10" />
            </svg>
            Rango
          </button>
        )}

        {/* Active custom label */}
        {activeKey === "custom" && value.from && value.to && !showCustomPicker && (
          <span className="text-[11px] text-slate-500 font-medium">
            {value.from} → {value.to}
          </span>
        )}
        {value.from && value.to && activeKey !== "custom" && (
          <span className="text-[10px] text-slate-400 font-medium hidden md:inline">
            {value.from} → {value.to}
          </span>
        )}
      </div>

      {/* Custom date inputs */}
      {showCustom && showCustomPicker && (
        <div className="flex items-center gap-2 flex-wrap bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5">
          <div className="flex items-center gap-1.5">
            <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wide whitespace-nowrap">
              Desde
            </label>
            <input
              type="date"
              value={value.from}
              onChange={(e) => handleCustom("from", e.target.value)}
              className="text-[12px] font-medium text-slate-800 bg-white border border-slate-200 rounded-lg px-2 py-1 outline-none focus:border-brand-navy transition-colors cursor-pointer"
            />
          </div>
          <span className="text-slate-300 text-sm">—</span>
          <div className="flex items-center gap-1.5">
            <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wide whitespace-nowrap">
              Hasta
            </label>
            <input
              type="date"
              value={value.to}
              onChange={(e) => handleCustom("to", e.target.value)}
              className="text-[12px] font-medium text-slate-800 bg-white border border-slate-200 rounded-lg px-2 py-1 outline-none focus:border-brand-navy transition-colors cursor-pointer"
            />
          </div>
          <button
            onClick={() => {
              onChange({ from: "", to: "" });
              setShowCustomPicker(false);
            }}
            className="ml-auto text-[11px] text-slate-400 hover:text-red-500 transition-colors cursor-pointer"
          >
            Limpiar
          </button>
        </div>
      )}
    </div>
  );
}

/** Utility: filter an array of objects by a date field against a DateRange */
export function filterByDateRange<T>(
  items: T[],
  getDate: (item: T) => string | Date | null | undefined,
  range: DateRange
): T[] {
  if (!range.from && !range.to) return items;

  const from = range.from ? new Date(range.from + "T00:00:00") : null;
  const to = range.to ? new Date(range.to + "T23:59:59") : null;

  return items.filter((item) => {
    const raw = getDate(item);
    if (!raw) return false;
    const d = typeof raw === "string" ? new Date(raw) : raw;
    if (isNaN(d.getTime())) return false;
    if (from && d < from) return false;
    if (to && d > to) return false;
    return true;
  });
}
