"use client";

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from "recharts";
import {
  CHART_COLORS,
  CHART_TICK,
  CHART_TOOLTIP_STYLE,
  formatCurrency,
} from "@/lib/chartTheme";

interface CategoryItem {
  name: string;
  amount: number;
}

export default function ExpenseCategoryChart({ categories }: { categories: CategoryItem[] }) {
  const data = categories
    .filter((c) => c.amount > 0)
    .sort((a, b) => b.amount - a.amount)
    .map((c) => ({ name: c.name, monto: c.amount }));

  if (data.length === 0) {
    return (
      <div className="h-48 flex items-center justify-center text-brand-gray-400 text-xs">
        Sin categorías con gastos registrados
      </div>
    );
  }

  return (
    <ResponsiveContainer width="100%" height={Math.max(180, data.length * 36)}>
      <BarChart data={data} layout="vertical" margin={{ top: 4, right: 16, left: 4, bottom: 4 }}>
        <XAxis type="number" hide />
        <YAxis
          type="category"
          dataKey="name"
          width={110}
          tick={{ fontSize: 10, fill: CHART_TICK }}
          axisLine={false}
          tickLine={false}
        />
        <Tooltip
          formatter={(value) => [formatCurrency(Number(value ?? 0)), "Gasto"]}
          contentStyle={CHART_TOOLTIP_STYLE}
        />
        <Bar dataKey="monto" radius={[0, 4, 4, 0]} barSize={18}>
          {data.map((_, index) => (
            <Cell key={index} fill={CHART_COLORS[index % CHART_COLORS.length]} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}
