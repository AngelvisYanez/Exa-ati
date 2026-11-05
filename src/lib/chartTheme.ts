import type { CSSProperties } from "react";

export const CHART_COLORS = ["#a02525", "#5c5c5a", "#D4A017", "#7a3a1b", "#c04040"] as const;
export const CHART_VENTAS = "#a02525";
export const CHART_COMPRAS = "#5c5c5a";
export const CHART_POSITIVO = "#2E7D32";
export const CHART_NEGATIVO = "#a02525";
export const CHART_GRID = "#e8e8e5";
export const CHART_TICK = "#6f6f6d";

export const CHART_TOOLTIP_STYLE: CSSProperties = {
  borderRadius: 8,
  border: "1px solid #dbdbd9",
  fontSize: 12,
  boxShadow: "0 2px 10px rgba(26, 26, 24, 0.08)",
  background: "#ffffff",
};

export function formatCurrency(v: number): string {
  return `$${v.toLocaleString("es-EC", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

export function formatCurrencyCompact(v: number): string {
  return `$${(v / 1000).toFixed(0)}k`;
}

export function formatCount(v: number): string {
  return v.toLocaleString("es-EC");
}
