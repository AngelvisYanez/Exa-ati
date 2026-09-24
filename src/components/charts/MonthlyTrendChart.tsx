"use client";

import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";
import {
  CHART_VENTAS,
  CHART_COMPRAS,
  CHART_GRID,
  CHART_TICK,
  CHART_TOOLTIP_STYLE,
  formatCurrency,
  formatCurrencyCompact,
} from "@/lib/chartTheme";

export interface MonthlyPoint {
  mes: string;
  ventas: number;
  compras: number;
}

export default function MonthlyTrendChart({ data }: { data: MonthlyPoint[] }) {
  if (data.length === 0) {
    return (
      <div className="h-48 flex items-center justify-center text-brand-gray-400 text-xs">
        Sin datos suficientes para tendencia mensual
      </div>
    );
  }

  return (
    <ResponsiveContainer width="100%" height={220}>
      <AreaChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
        <defs>
          <linearGradient id="ventasGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor={CHART_VENTAS} stopOpacity={0.3} />
            <stop offset="95%" stopColor={CHART_VENTAS} stopOpacity={0} />
          </linearGradient>
          <linearGradient id="comprasGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor={CHART_COMPRAS} stopOpacity={0.3} />
            <stop offset="95%" stopColor={CHART_COMPRAS} stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" stroke={CHART_GRID} vertical={false} />
        <XAxis dataKey="mes" tick={{ fontSize: 10, fill: CHART_TICK }} axisLine={false} tickLine={false} />
        <YAxis
          tick={{ fontSize: 10, fill: CHART_TICK }}
          axisLine={false}
          tickLine={false}
          tickFormatter={(v) => formatCurrencyCompact(Number(v))}
        />
        <Tooltip
          formatter={(value, name) => [
            formatCurrency(Number(value ?? 0)),
            name === "ventas" ? "Ventas" : "Compras",
          ]}
          contentStyle={CHART_TOOLTIP_STYLE}
        />
        <Legend wrapperStyle={{ fontSize: 11 }} />
        <Area type="monotone" dataKey="ventas" name="Ventas" stroke={CHART_VENTAS} fill="url(#ventasGrad)" strokeWidth={2} />
        <Area type="monotone" dataKey="compras" name="Compras" stroke={CHART_COMPRAS} fill="url(#comprasGrad)" strokeWidth={2} />
      </AreaChart>
    </ResponsiveContainer>
  );
}
