"use client";

import {
  PieChart,
  Pie,
  Cell,
  ResponsiveContainer,
  Tooltip,
  Legend,
} from "recharts";
import {
  CHART_COLORS,
  CHART_TOOLTIP_STYLE,
  formatCount,
} from "@/lib/chartTheme";

interface DocumentDistributionChartProps {
  ventas: number;
  compras: number;
  retenciones: number;
  notasCredito: number;
  notasDebito: number;
}

export default function DocumentDistributionChart({
  ventas,
  compras,
  retenciones,
  notasCredito,
  notasDebito,
}: DocumentDistributionChartProps) {
  const data = [
    { name: "Facturas de Venta", value: ventas },
    { name: "Facturas de Compra", value: compras },
    { name: "Retenciones", value: retenciones },
    { name: "Notas de Crédito", value: notasCredito },
    { name: "Notas de Débito", value: notasDebito },
  ].filter((d) => d.value > 0);

  if (data.length === 0) {
    return (
      <div className="h-48 flex items-center justify-center text-brand-gray-400 text-xs">
        Sin datos de distribución
      </div>
    );
  }

  return (
    <ResponsiveContainer width="100%" height={240}>
      <PieChart>
        <Pie
          data={data}
          cx="50%"
          cy="50%"
          innerRadius={50}
          outerRadius={85}
          paddingAngle={3}
          dataKey="value"
        >
          {data.map((_, index) => (
            <Cell key={index} fill={CHART_COLORS[index % CHART_COLORS.length]} />
          ))}
        </Pie>
        <Tooltip
          formatter={(value, name) => [formatCount(Number(value ?? 0)), name]}
          contentStyle={CHART_TOOLTIP_STYLE}
        />
        <Legend
          wrapperStyle={{ fontSize: 10, paddingTop: 8 }}
          iconType="circle"
          iconSize={8}
        />
      </PieChart>
    </ResponsiveContainer>
  );
}
