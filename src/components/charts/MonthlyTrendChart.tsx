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

export interface MonthlyPoint {
  mes: string;
  ventas: number;
  compras: number;
}

export default function MonthlyTrendChart({ data }: { data: MonthlyPoint[] }) {
  if (data.length === 0) {
    return (
      <div className="h-48 flex items-center justify-center text-slate-400 text-xs">
        Sin datos suficientes para tendencia mensual
      </div>
    );
  }

  const formatCurrency = (v: number) =>
    `$${v.toLocaleString("es-EC", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;

  return (
    <ResponsiveContainer width="100%" height={220}>
      <AreaChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
        <defs>
          <linearGradient id="ventasGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor="#0F2D5E" stopOpacity={0.3} />
            <stop offset="95%" stopColor="#0F2D5E" stopOpacity={0} />
          </linearGradient>
          <linearGradient id="comprasGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor="#94A3B8" stopOpacity={0.3} />
            <stop offset="95%" stopColor="#94A3B8" stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" vertical={false} />
        <XAxis dataKey="mes" tick={{ fontSize: 10, fill: "#64748B" }} axisLine={false} tickLine={false} />
        <YAxis
          tick={{ fontSize: 10, fill: "#94A3B8" }}
          axisLine={false}
          tickLine={false}
          tickFormatter={(v) => `$${(v / 1000).toFixed(0)}k`}
        />
        <Tooltip
          formatter={(value, name) => [
            formatCurrency(Number(value ?? 0)),
            name === "ventas" ? "Ventas" : "Compras",
          ]}
          contentStyle={{ borderRadius: 8, border: "1px solid #E2E8F0", fontSize: 12 }}
        />
        <Legend wrapperStyle={{ fontSize: 11 }} />
        <Area type="monotone" dataKey="ventas" name="Ventas" stroke="#0F2D5E" fill="url(#ventasGrad)" strokeWidth={2} />
        <Area type="monotone" dataKey="compras" name="Compras" stroke="#94A3B8" fill="url(#comprasGrad)" strokeWidth={2} />
      </AreaChart>
    </ResponsiveContainer>
  );
}
