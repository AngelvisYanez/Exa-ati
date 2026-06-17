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

interface FlowComparisonChartProps {
  ventas: number;
  compras: number;
}

export default function FlowComparisonChart({ ventas, compras }: FlowComparisonChartProps) {
  const balance = ventas - compras;
  const data = [
    { name: "Ventas", monto: ventas, fill: "#0F2D5E" },
    { name: "Compras", monto: compras, fill: "#94A3B8" },
    { name: "Balance", monto: balance, fill: balance >= 0 ? "#1B7A3E" : "#DC2626" },
  ];

  const formatCurrency = (v: number) =>
    `$${v.toLocaleString("es-EC", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

  return (
    <ResponsiveContainer width="100%" height={220}>
      <BarChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" vertical={false} />
        <XAxis dataKey="name" tick={{ fontSize: 11, fill: "#64748B" }} axisLine={false} tickLine={false} />
        <YAxis
          tick={{ fontSize: 10, fill: "#94A3B8" }}
          axisLine={false}
          tickLine={false}
          tickFormatter={(v) => `$${(v / 1000).toFixed(0)}k`}
        />
        <Tooltip
          formatter={(value) => [formatCurrency(Number(value ?? 0)), "Monto"]}
          contentStyle={{ borderRadius: 8, border: "1px solid #E2E8F0", fontSize: 12 }}
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
