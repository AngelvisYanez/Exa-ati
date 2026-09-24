"use client";

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  Cell,
} from "recharts";
import {
  CHART_VENTAS,
  CHART_COMPRAS,
  CHART_POSITIVO,
  CHART_NEGATIVO,
  CHART_GRID,
  CHART_TICK,
  CHART_TOOLTIP_STYLE,
  formatCurrency,
  formatCurrencyCompact,
} from "@/lib/chartTheme";

interface FlowComparisonChartProps {
  ventas: number;
  compras: number;
}

export default function FlowComparisonChart({ ventas, compras }: FlowComparisonChartProps) {
  const balance = ventas - compras;
  const data = [
    { name: "Ventas", monto: ventas, fill: CHART_VENTAS },
    { name: "Compras", monto: compras, fill: CHART_COMPRAS },
    { name: "Balance", monto: balance, fill: balance >= 0 ? CHART_POSITIVO : CHART_NEGATIVO },
  ];

  if (ventas === 0 && compras === 0) {
    return (
      <div className="h-48 flex items-center justify-center text-brand-gray-400 text-xs">
        Aún no hay flujos registrados en este período
      </div>
    );
  }

  return (
    <ResponsiveContainer width="100%" height={220}>
      <BarChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke={CHART_GRID} vertical={false} />
        <XAxis dataKey="name" tick={{ fontSize: 11, fill: CHART_TICK }} axisLine={false} tickLine={false} />
        <YAxis
          tick={{ fontSize: 10, fill: CHART_TICK }}
          axisLine={false}
          tickLine={false}
          tickFormatter={(v) => formatCurrencyCompact(Number(v))}
        />
        <Tooltip
          formatter={(value) => [formatCurrency(Number(value ?? 0)), "Monto"]}
          contentStyle={CHART_TOOLTIP_STYLE}
        />
        <Legend wrapperStyle={{ fontSize: 11 }} />
        <Bar dataKey="monto" name="Monto" radius={[6, 6, 0, 0]}>
          {data.map((entry, index) => (
            <Cell key={index} fill={entry.fill} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}
