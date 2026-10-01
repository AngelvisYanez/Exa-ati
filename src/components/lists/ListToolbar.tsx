"use client";

import type { ReactNode } from "react";
import { LayoutGrid, List, Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import type { ViewMode } from "@/components/lists/useViewMode";

interface ListToolbarProps {
  search?: string;
  onSearchChange?: (value: string) => void;
  placeholder?: string;
  view: ViewMode;
  onViewChange: (mode: ViewMode) => void;
  children?: ReactNode;
  hideSearch?: boolean;
  className?: string;
}

export function ViewModeToggle({
  view,
  onViewChange,
}: {
  view: ViewMode;
  onViewChange: (mode: ViewMode) => void;
}) {
  return (
    <div
      role="group"
      aria-label="Modo de vista"
      className="inline-flex h-9 shrink-0 items-center rounded-lg bg-muted p-[3px] text-muted-foreground"
    >
      <ViewButton label="Lista" selected={view === "lista"} onClick={() => onViewChange("lista")}>
        <List className="h-3.5 w-3.5" />
        <span className="hidden sm:inline">Lista</span>
      </ViewButton>
      <ViewButton label="Cuadrícula" selected={view === "cuadricula"} onClick={() => onViewChange("cuadricula")}>
        <LayoutGrid className="h-3.5 w-3.5" />
        <span className="hidden sm:inline">Cuadrícula</span>
      </ViewButton>
    </div>
  );
}

export default function ListToolbar({
  search = "",
  onSearchChange,
  placeholder = "Buscar…",
  view,
  onViewChange,
  children,
  hideSearch = false,
  className,
}: ListToolbarProps) {
  return (
    <div className={cn("flex flex-col gap-2.5 lg:flex-row lg:items-center lg:gap-3", className)}>
      {!hideSearch && (
        <div className="relative min-w-0 flex-1 lg:max-w-md">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-brand-gray-400" />
          <Input
            className="h-9 bg-white pl-9"
            placeholder={placeholder}
            value={search}
            onChange={(e) => onSearchChange?.(e.target.value)}
            aria-label={placeholder}
            type="search"
          />
        </div>
      )}

      {children ? <div className="flex min-w-0 flex-wrap items-center gap-2">{children}</div> : null}

      <div className="lg:ml-auto">
        <ViewModeToggle view={view} onViewChange={onViewChange} />
      </div>
    </div>
  );
}

function ViewButton({
  label,
  selected,
  onClick,
  children,
}: {
  label: string;
  selected: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      aria-pressed={selected}
      aria-label={label}
      onClick={onClick}
      className={cn(
        "inline-flex h-[calc(100%-1px)] min-h-8 items-center justify-center gap-1.5 rounded-md border border-transparent px-2.5 text-sm font-medium whitespace-nowrap transition-all",
        selected ? "bg-background text-foreground shadow-sm" : "text-foreground/60 hover:text-foreground"
      )}
    >
      {children}
    </button>
  );
}
