"use client";

import type { ReactNode } from "react";
import DateRangeFilter, { type DateRange } from "@/components/DateRangeFilter";
import { Input } from "@/components/ui/input";
import { Search } from "lucide-react";
import { cn } from "@/lib/utils";

/** Vista unificada: flujo (emitidos/recibidos) + retenciones en un solo control. */
export type DocumentosViewFilter = "todos" | "emitidos" | "recibidos" | "retenciones";

interface DocumentosFiltersProps {
  search: string;
  onSearchChange: (value: string) => void;
  viewFilter: DocumentosViewFilter;
  onViewFilterChange: (value: DocumentosViewFilter) => void;
  dateRange: DateRange;
  onDateRangeChange: (value: DateRange) => void;
  /** Acciones primarias (p. ej. Descarga masiva) — visibles siempre. */
  primaryActions?: ReactNode;
  /** Acciones secundarias — menú “Más” en móvil / fila compacta en desktop. */
  secondaryActions?: ReactNode;
  children?: ReactNode;
}

const VIEW_TABS: { value: DocumentosViewFilter; label: string; short: string }[] = [
  { value: "todos", label: "Todos", short: "Todos" },
  { value: "emitidos", label: "Emitidos", short: "Emit." },
  { value: "recibidos", label: "Recibidos", short: "Recib." },
  { value: "retenciones", label: "Retenciones", short: "Ret." },
];

export default function DocumentosFilters({
  search,
  onSearchChange,
  viewFilter,
  onViewFilterChange,
  dateRange,
  onDateRangeChange,
  primaryActions,
  secondaryActions,
  children,
}: DocumentosFiltersProps) {
  return (
    <div className="flex flex-col gap-3">
      <DateRangeFilter
        value={dateRange}
        onChange={onDateRangeChange}
        variant="compact"
        className="bg-white border border-brand-gray-200 rounded-xl px-3 py-2.5 sm:px-4"
      />

      <div className="flex flex-col gap-2.5 lg:flex-row lg:items-center lg:gap-3">
        <div className="relative min-w-0 flex-1 lg:max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-brand-gray-400 pointer-events-none" />
          <Input
            className="pl-9 bg-white h-9"
            placeholder="Buscar proveedor, RUC o Nº…"
            value={search}
            onChange={(e) => onSearchChange(e.target.value)}
            aria-label="Buscar comprobantes"
            type="search"
          />
        </div>

        <div className="overflow-x-auto -mx-0.5 px-0.5 shrink-0">
          <div
            role="tablist"
            aria-label="Filtrar comprobantes"
            className="inline-flex h-9 w-max items-center rounded-lg bg-muted p-[3px] text-muted-foreground"
          >
            {VIEW_TABS.map((tab) => {
              const selected = viewFilter === tab.value;
              return (
                <button
                  key={tab.value}
                  type="button"
                  role="tab"
                  aria-selected={selected}
                  tabIndex={selected ? 0 : -1}
                  onClick={() => onViewFilterChange(tab.value)}
                  className={cn(
                    "relative inline-flex h-[calc(100%-1px)] min-h-8 items-center justify-center rounded-md border border-transparent px-2.5 sm:px-3 text-sm font-medium whitespace-nowrap transition-all",
                    selected
                      ? "bg-background text-foreground shadow-sm"
                      : "text-foreground/60 hover:text-foreground"
                  )}
                >
                  <span className="sm:hidden">{tab.short}</span>
                  <span className="hidden sm:inline">{tab.label}</span>
                </button>
              );
            })}
          </div>
        </div>

        {(primaryActions || secondaryActions || children) && (
          <div className="flex items-center gap-2 flex-wrap lg:ml-auto lg:justify-end">
            {primaryActions}
            {secondaryActions}
            {children}
          </div>
        )}
      </div>
    </div>
  );
}
