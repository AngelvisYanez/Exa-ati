"use client";

import { useState } from "react";
import { Calendar, ChevronDown, X, Filter, CalendarDays } from "lucide-react";

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

export const MONTHS_FULL_ES = [
  "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
  "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"
];

export const MONTHS_SHORT_ES = [
  "Ene", "Feb", "Mar", "Abr", "May", "Jun",
  "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"
];

function pad(n: number) {
  return String(n).padStart(2, "0");
}

function lastDayOf(y: number, m: number) {
  return new Date(y, m + 1, 0).getDate();
}

export function getQuickPeriods(): QuickPeriod[] {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth(); // 0-indexed

  // Current month
  const cmFrom = `${year}-${pad(month + 1)}-01`;
  const cmTo = `${year}-${pad(month + 1)}-${pad(lastDayOf(year, month))}`;

  // Previous month
  const prevM = month === 0 ? 11 : month - 1;
  const prevY = month === 0 ? year - 1 : year;
  const pmFrom = `${prevY}-${pad(prevM + 1)}-01`;
  const pmTo = `${prevY}-${pad(prevM + 1)}-${pad(lastDayOf(prevY, prevM))}`;

  // Last 30 days
  const d30Now = new Date();
  const d30Start = new Date(d30Now.getTime() - 30 * 86400000);
  const d30From = `${d30Start.getFullYear()}-${pad(d30Start.getMonth() + 1)}-${pad(d30Start.getDate())}`;
  const d30To = `${d30Now.getFullYear()}-${pad(d30Now.getMonth() + 1)}-${pad(d30Now.getDate())}`;

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

  return [
    { key: "cm",   label: `${MONTHS_SHORT_ES[month]} ${year}`,          from: cmFrom, to: cmTo },
    { key: "pm",   label: `${MONTHS_SHORT_ES[prevM]} ${prevY}`,         from: pmFrom, to: pmTo },
    { key: "30d",  label: "Últimos 30 días",                       from: d30From, to: d30To },
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

export function getRangeDaysCount(range: DateRange): number | null {
  if (!range.from || !range.to) return null;
  const f = new Date(`${range.from}T12:00:00`).getTime();
  const t = new Date(`${range.to}T12:00:00`).getTime();
  if (isNaN(f) || isNaN(t)) return null;
  return Math.max(1, Math.round((t - f) / (1000 * 60 * 60 * 24)) + 1);
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
  /**
   * compact: franja densa con presets en scroll;
   * paneles de mes/rango solo al abrir.
   */
  variant?: "default" | "compact";
  /** Extra class for the root wrapper */
  className?: string;
}

export default function DateRangeFilter({
  value,
  onChange,
  filterLabel = "Período",
  showCustom = true,
  variant = "default",
  className = "",
}: DateRangeFilterProps) {
  const periods = getQuickPeriods();
  const [showCustomPicker, setShowCustomPicker] = useState(false);
  const [showMonthPicker, setShowMonthPicker] = useState(false);
  
  const currentYear = new Date().getFullYear();
  const [selectedPickerYear, setSelectedPickerYear] = useState<number>(currentYear);

  const activeKey =
    periods.find((p) => p.from === value.from && p.to === value.to)?.key ??
    "custom";

  const daysCount = getRangeDaysCount(value);
  const formattedLabel = formatDateRangeLabel(value);

  const handleQuick = (p: QuickPeriod) => {
    onChange({ from: p.from, to: p.to });
    setShowCustomPicker(false);
    setShowMonthPicker(false);
  };

  const handleSelectMonth = (monthIndex: number, year: number) => {
    const from = `${year}-${pad(monthIndex + 1)}-01`;
    const to = `${year}-${pad(monthIndex + 1)}-${pad(lastDayOf(year, monthIndex))}`;
    onChange({ from, to });
    setShowMonthPicker(false);
    setShowCustomPicker(false);
  };

  const handleCustom = (field: "from" | "to", val: string) => {
    onChange({ ...value, [field]: val });
  };

  const applyShortcut = (type: "today" | "yesterday" | "7d" | "30d") => {
    const now = new Date();
    const todayStr = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;

    if (type === "today") {
      onChange({ from: todayStr, to: todayStr });
    } else if (type === "yesterday") {
      const y = new Date(now.getTime() - 86400000);
      const yStr = `${y.getFullYear()}-${pad(y.getMonth() + 1)}-${pad(y.getDate())}`;
      onChange({ from: yStr, to: yStr });
    } else if (type === "7d") {
      const d7 = new Date(now.getTime() - 7 * 86400000);
      const d7Str = `${d7.getFullYear()}-${pad(d7.getMonth() + 1)}-${pad(d7.getDate())}`;
      onChange({ from: d7Str, to: todayStr });
    } else if (type === "30d") {
      const d30 = new Date(now.getTime() - 30 * 86400000);
      const d30Str = `${d30.getFullYear()}-${pad(d30.getMonth() + 1)}-${pad(d30.getDate())}`;
      onChange({ from: d30Str, to: todayStr });
    }
  };

  const isCompact = variant === "compact";

  return (
    <div className={`flex flex-col ${isCompact ? "gap-2" : "gap-2.5"} ${className}`}>
      {/* Top row: Label, active period badge & quick action pills */}
      <div className={`flex items-center gap-2 ${isCompact ? "flex-nowrap overflow-x-auto pb-0.5 -mx-0.5 px-0.5" : "flex-wrap justify-between"}`}>
        <div className="flex items-center gap-2 shrink-0 min-w-0">
          {!isCompact && (
            <span className="text-[11px] font-bold text-brand-gray-500 uppercase tracking-wider flex items-center gap-1.5">
              <Filter className="w-3.5 h-3.5 text-brand-red" />
              {filterLabel}:
            </span>
          )}

          {/* Active Period Badge */}
          <div className="flex items-center gap-1.5 bg-brand-gray-100/80 border border-brand-gray-200/80 rounded-lg px-2.5 py-0.5 min-w-0">
            <Calendar className="w-3 h-3 text-brand-gray-600 shrink-0" />
            <span className="text-[11.5px] font-bold text-brand-gray-800 capitalize truncate">
              {formattedLabel}
            </span>
            {daysCount !== null && !isCompact && (
              <span className="text-[10px] font-semibold text-brand-gray-500 bg-white border border-brand-gray-200 px-1.5 rounded">
                {daysCount} {daysCount === 1 ? "día" : "días"}
              </span>
            )}
          </div>
        </div>

        {/* Quick Month & Custom Pickers toggles */}
        <div className="flex items-center gap-1.5 shrink-0 ml-auto">
          <button
            type="button"
            onClick={() => {
              setShowMonthPicker((v) => !v);
              setShowCustomPicker(false);
            }}
            className={`text-[11px] font-semibold px-2.5 py-1.5 min-h-8 rounded-lg border transition-all cursor-pointer flex items-center gap-1.5 ${
              showMonthPicker
                ? "bg-brand-red text-white border-brand-red shadow-sm"
                : "bg-white text-brand-gray-700 border-brand-gray-200 hover:border-brand-gray-400 hover:bg-brand-gray-50"
            }`}
          >
            <CalendarDays className="w-3.5 h-3.5" />
            <span className={isCompact ? "hidden sm:inline" : ""}>{isCompact ? "Mes" : "Seleccionar Mes"}</span>
            <ChevronDown className={`w-3 h-3 transition-transform ${showMonthPicker ? "rotate-180" : ""}`} />
          </button>

          {showCustom && (
            <button
              type="button"
              onClick={() => {
                setShowCustomPicker((v) => !v);
                setShowMonthPicker(false);
              }}
              className={`text-[11px] font-semibold px-2.5 py-1.5 min-h-8 rounded-lg border transition-all cursor-pointer flex items-center gap-1.5 ${
                activeKey === "custom" || showCustomPicker
                  ? "bg-brand-gray-900 text-white border-brand-gray-900 shadow-sm"
                  : "bg-white text-brand-gray-700 border-brand-gray-200 hover:border-brand-gray-400 hover:bg-brand-gray-50"
              }`}
            >
              <Calendar className="w-3.5 h-3.5" />
              <span className={isCompact ? "hidden sm:inline" : ""}>{isCompact ? "Rango" : "Rango Libre"}</span>
            </button>
          )}

          {(value.from || value.to) && (
            <button
              type="button"
              onClick={() => {
                onChange({ from: "", to: "" });
                setShowCustomPicker(false);
                setShowMonthPicker(false);
              }}
              title="Limpiar período (Ver todos)"
              className="text-[11px] font-semibold text-brand-gray-400 hover:text-brand-red transition-colors p-1.5 min-h-8 min-w-8 hover:bg-brand-red-subtle rounded-lg cursor-pointer flex items-center justify-center gap-1"
            >
              <X className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Limpiar</span>
            </button>
          )}
        </div>
      </div>

      {/* Quick Preset Pills Bar */}
      <div
        className={`flex items-center gap-1.5 ${
          isCompact
            ? "overflow-x-auto pb-0.5 -mx-0.5 px-0.5 scrollbar-thin"
            : "flex-wrap pt-0.5"
        }`}
        role="group"
        aria-label={`Presets de ${filterLabel.toLowerCase()}`}
      >
        {periods.map((p) => {
          const isSelected = activeKey === p.key;
          return (
            <button
              key={p.key}
              type="button"
              onClick={() => handleQuick(p)}
              className={`text-[11px] font-semibold px-3 py-1.5 min-h-8 rounded-full border transition-all cursor-pointer whitespace-nowrap shrink-0 ${
                isSelected
                  ? "bg-brand-red text-white border-brand-red shadow-xs font-bold"
                  : "bg-white text-brand-gray-600 border-brand-gray-200 hover:border-brand-gray-400 hover:text-brand-gray-900 hover:bg-brand-gray-50"
              }`}
            >
              {p.label}
            </button>
          );
        })}
      </div>

      {/* Month & Year Direct Selector Grid */}
      {showMonthPicker && (
        <div className="mt-1 bg-white border border-brand-gray-200 rounded-xl p-3.5 shadow-lg flex flex-col gap-3 animate-in fade-in slide-in-from-top-2 duration-150">
          <div className="flex items-center justify-between border-b border-brand-gray-100 pb-2">
            <span className="text-[11px] font-bold text-brand-gray-600 uppercase tracking-wider">
              Seleccionar mes del año
            </span>
            {/* Year selector pills */}
            <div className="flex items-center gap-1">
              {[currentYear, currentYear - 1, currentYear - 2, currentYear - 3].map((y) => (
                <button
                  key={y}
                  onClick={() => setSelectedPickerYear(y)}
                  className={`text-[11px] font-bold px-2 py-0.5 rounded transition-colors ${
                    selectedPickerYear === y
                      ? "bg-brand-red text-white"
                      : "text-brand-gray-600 hover:bg-brand-gray-100"
                  }`}
                >
                  {y}
                </button>
              ))}
            </div>
          </div>

          {/* 12 Months Grid */}
          <div className="grid grid-cols-4 sm:grid-cols-6 gap-1.5">
            {MONTHS_SHORT_ES.map((monthName, idx) => {
              const mFrom = `${selectedPickerYear}-${pad(idx + 1)}-01`;
              const isSelected = value.from === mFrom;
              return (
                <button
                  key={monthName}
                  onClick={() => handleSelectMonth(idx, selectedPickerYear)}
                  className={`text-[12px] font-semibold py-2 px-1 rounded-lg border text-center transition-all cursor-pointer ${
                    isSelected
                      ? "bg-brand-red text-white border-brand-red font-bold shadow-xs"
                      : "bg-brand-gray-50/70 border-brand-gray-200 text-brand-gray-800 hover:border-brand-red hover:bg-brand-red-subtle/50 hover:text-brand-red"
                  }`}
                >
                  <div className="font-bold">{monthName}</div>
                  <div className="text-[9px] opacity-75">{selectedPickerYear}</div>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Custom Date Range Panel */}
      {showCustom && showCustomPicker && (
        <div className="mt-1 bg-white border border-brand-gray-200 rounded-xl p-3.5 shadow-lg flex flex-col gap-3 animate-in fade-in slide-in-from-top-2 duration-150">
          <div className="flex items-center justify-between border-b border-brand-gray-100 pb-2">
            <span className="text-[11px] font-bold text-brand-gray-600 uppercase tracking-wider">
              Rango de Fechas Personalizado
            </span>
            <div className="flex items-center gap-1.5">
              <span className="text-[10px] text-brand-gray-400 font-semibold">Atajos:</span>
              <button
                onClick={() => applyShortcut("today")}
                className="text-[10px] font-semibold text-brand-gray-600 hover:text-brand-red bg-brand-gray-100 hover:bg-brand-red-subtle px-1.5 py-0.5 rounded transition-colors"
              >
                Hoy
              </button>
              <button
                onClick={() => applyShortcut("yesterday")}
                className="text-[10px] font-semibold text-brand-gray-600 hover:text-brand-red bg-brand-gray-100 hover:bg-brand-red-subtle px-1.5 py-0.5 rounded transition-colors"
              >
                Ayer
              </button>
              <button
                onClick={() => applyShortcut("7d")}
                className="text-[10px] font-semibold text-brand-gray-600 hover:text-brand-red bg-brand-gray-100 hover:bg-brand-red-subtle px-1.5 py-0.5 rounded transition-colors"
              >
                7d
              </button>
              <button
                onClick={() => applyShortcut("30d")}
                className="text-[10px] font-semibold text-brand-gray-600 hover:text-brand-red bg-brand-gray-100 hover:bg-brand-red-subtle px-1.5 py-0.5 rounded transition-colors"
              >
                30d
              </button>
            </div>
          </div>

          <div className="flex items-center gap-3 flex-wrap">
            <div className="flex items-center gap-2 flex-1 min-w-[140px]">
              <label className="text-[11px] font-bold text-brand-gray-600 whitespace-nowrap">
                Desde:
              </label>
              <input
                type="date"
                value={value.from}
                onChange={(e) => handleCustom("from", e.target.value)}
                className="w-full text-[12px] font-semibold text-brand-gray-900 bg-white border border-brand-gray-300 rounded-lg px-2.5 py-1.5 outline-none focus:border-brand-red focus:ring-1 focus:ring-brand-red transition-all cursor-pointer"
              />
            </div>
            <span className="text-brand-gray-300 font-bold hidden sm:inline">—</span>
            <div className="flex items-center gap-2 flex-1 min-w-[140px]">
              <label className="text-[11px] font-bold text-brand-gray-600 whitespace-nowrap">
                Hasta:
              </label>
              <input
                type="date"
                value={value.to}
                onChange={(e) => handleCustom("to", e.target.value)}
                className="w-full text-[12px] font-semibold text-brand-gray-900 bg-white border border-brand-gray-300 rounded-lg px-2.5 py-1.5 outline-none focus:border-brand-red focus:ring-1 focus:ring-brand-red transition-all cursor-pointer"
              />
            </div>
          </div>
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
