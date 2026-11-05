"use client";

import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export type ConfigTabId =
  | "general"
  | "clientes"
  | "notificaciones"
  | "integraciones"
  | "ia"
  | "desarrollo";

export type ConfigTabDef = {
  id: ConfigTabId;
  label: string;
  icon: ReactNode;
  roles?: string[];
};

type ConfigTabsNavProps = {
  tabs: ConfigTabDef[];
  activeTab: ConfigTabId;
  onChange: (tab: ConfigTabId) => void;
};

export function ConfigTabsNav({ tabs, activeTab, onChange }: ConfigTabsNavProps) {
  return (
    <nav
      className="flex gap-1 overflow-x-auto border-b border-brand-gray-200 pb-px"
      aria-label="Secciones de configuración"
      role="tablist"
    >
      {tabs.map((tab) => {
        const isActive = activeTab === tab.id;
        return (
          <button
            key={tab.id}
            type="button"
            role="tab"
            id={`config-tab-${tab.id}`}
            aria-selected={isActive}
            aria-controls={`config-panel-${tab.id}`}
            tabIndex={isActive ? 0 : -1}
            onClick={() => onChange(tab.id)}
            className={cn(
              "flex items-center gap-2 px-3.5 py-2.5 text-xs font-semibold whitespace-nowrap rounded-t-lg border-b-2 transition-colors cursor-pointer",
              isActive
                ? "border-brand-red text-brand-red bg-brand-red-subtle"
                : "border-transparent text-brand-gray-500 hover:text-brand-gray-800 hover:bg-brand-gray-100"
            )}
          >
            {tab.icon}
            {tab.label}
          </button>
        );
      })}
    </nav>
  );
}

type ConfigTabPanelProps = {
  id: ConfigTabId;
  activeTab: ConfigTabId;
  children: ReactNode;
  className?: string;
};

export function ConfigTabPanel({
  id,
  activeTab,
  children,
  className,
}: ConfigTabPanelProps) {
  if (activeTab !== id) return null;
  return (
    <div
      role="tabpanel"
      id={`config-panel-${id}`}
      aria-labelledby={`config-tab-${id}`}
      className={className}
    >
      {children}
    </div>
  );
}
