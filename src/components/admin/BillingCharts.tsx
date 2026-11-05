"use client";

import {
  AreaChart,
  Area,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
  PieChart,
  Pie,
} from "recharts";
import {
  CHART_COLORS,
  CHART_VENTAS,
  CHART_GRID,
  CHART_TICK,
  CHART_TOOLTIP_STYLE,
  formatCurrency,
  formatCurrencyCompact,
} from "@/lib/chartTheme";

export function BillingMonthlyChart({
  data,
}: {
  data: { mes: string; ingresos: number }[];
}) {
  if (!data.length) {
    return (
      <div className="h-48 flex items-center justify-center text-brand-gray-400 text-xs">
        Sin ingresos registrados aún
      </div>
    );
  }

  const chartData = data.map((d) => ({
    mes: d.mes.slice(5), // MM
    ingresos: d.ingresos,
    label: d.mes,
  }));

  return (
    <ResponsiveContainer width="100%" height={220}>
      <AreaChart data={chartData} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
        <defs>
          <linearGradient id="billingIngresosGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor={CHART_VENTAS} stopOpacity={0.3} />
            <stop offset="95%" stopColor={CHART_VENTAS} stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" stroke={CHART_GRID} vertical={false} />
        <XAxis
          dataKey="mes"
          tick={{ fontSize: 10, fill: CHART_TICK }}
          axisLine={false}
          tickLine={false}
        />
        <YAxis
          tick={{ fontSize: 10, fill: CHART_TICK }}
          axisLine={false}
          tickLine={false}
          tickFormatter={(v) => formatCurrencyCompact(Number(v))}
        />
        <Tooltip
          formatter={(value) => [formatCurrency(Number(value ?? 0)), "Ingresos"]}
          labelFormatter={(_, payload) => payload?.[0]?.payload?.label || ""}
          contentStyle={CHART_TOOLTIP_STYLE}
        />
        <Area
          type="monotone"
          dataKey="ingresos"
          name="Ingresos"
          stroke={CHART_VENTAS}
          fill="url(#billingIngresosGrad)"
          strokeWidth={2}
        />
      </AreaChart>
    </ResponsiveContainer>
  );
}

export function BillingByPlanChart({
  data,
}: {
  data: { plan: string; ingresos: number }[];
}) {
  const chartData = data.filter((d) => d.ingresos > 0);
  if (!chartData.length) {
    return (
      <div className="h-48 flex items-center justify-center text-brand-gray-400 text-xs">
        Sin ingresos por plan
      </div>
    );
  }

  return (
    <ResponsiveContainer width="100%" height={220}>
      <PieChart>
        <Pie
          data={chartData}
          dataKey="ingresos"
          nameKey="plan"
          cx="50%"
          cy="50%"
          innerRadius={48}
          outerRadius={80}
          paddingAngle={2}
        >
          {chartData.map((_, index) => (
            <Cell key={index} fill={CHART_COLORS[index % CHART_COLORS.length]} />
          ))}
        </Pie>
        <Tooltip
          formatter={(value) => [formatCurrency(Number(value ?? 0)), "Ingresos"]}
          contentStyle={CHART_TOOLTIP_STYLE}
        />
      </PieChart>
    </ResponsiveContainer>
  );
}

export function BillingTopUsersChart({
  data,
}: {
  data: { email: string; ingresos: number }[];
}) {
  const chartData = data
    .filter((d) => d.ingresos > 0)
    .slice(0, 8)
    .map((d) => ({
      name: d.email.length > 22 ? d.email.slice(0, 20) + "…" : d.email,
      ingresos: d.ingresos,
    }));

  if (!chartData.length) {
    return (
      <div className="h-48 flex items-center justify-center text-brand-gray-400 text-xs">
        Sin pagos por usuario
      </div>
    );
  }

  return (
    <ResponsiveContainer width="100%" height={Math.max(180, chartData.length * 32)}>
      <BarChart data={chartData} layout="vertical" margin={{ top: 4, right: 16, left: 4, bottom: 4 }}>
        <XAxis type="number" hide />
        <YAxis
          type="category"
          dataKey="name"
          width={120}
          tick={{ fontSize: 10, fill: CHART_TICK }}
          axisLine={false}
          tickLine={false}
        />
        <Tooltip
          formatter={(value) => [formatCurrency(Number(value ?? 0)), "Ingresos"]}
          contentStyle={CHART_TOOLTIP_STYLE}
        />
        <Bar dataKey="ingresos" radius={[0, 4, 4, 0]} barSize={16}>
          {chartData.map((_, index) => (
            <Cell key={index} fill={CHART_COLORS[index % CHART_COLORS.length]} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}
