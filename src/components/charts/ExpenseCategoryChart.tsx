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

const COLORS = ["#0F2D5E", "#2256A8", "#0EA5E9", "#1B7A3E", "#2EAA58", "#F59E0B", "#94A3B8"];

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
      <div className="h-48 flex items-center justify-center text-slate-400 text-xs">
        Sin categorías con gastos registrados
      </div>
    );
  }

  const formatCurrency = (v: number) =>
    `$${v.toLocaleString("es-EC", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

  return (
    <ResponsiveContainer width="100%" height={Math.max(180, data.length * 36)}>
      <BarChart data={data} layout="vertical" margin={{ top: 4, right: 16, left: 4, bottom: 4 }}>
        <XAxis type="number" hide />
        <YAxis
          type="category"
          dataKey="name"
          width={110}
          tick={{ fontSize: 10, fill: "#64748B" }}
          axisLine={false}
          tickLine={false}
        />
        <Tooltip
          formatter={(value) => [formatCurrency(Number(value ?? 0)), "Gasto"]}
          contentStyle={{ borderRadius: 8, border: "1px solid #E2E8F0", fontSize: 12 }}
        />
        <Bar dataKey="monto" radius={[0, 4, 4, 0]} barSize={18}>
          {data.map((_, index) => (
            <Cell key={index} fill={COLORS[index % COLORS.length]} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}
