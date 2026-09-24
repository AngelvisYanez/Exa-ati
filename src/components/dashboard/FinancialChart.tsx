"use client";

import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
} from "recharts";

export interface MonthlyFinancialData {
  mes: string;
  ventas: number;
  compras: number;
  ivaPagar: number;
}

interface FinancialChartProps {
  data: MonthlyFinancialData[];
  title?: string;
}

export default function FinancialChart({ data, title = "Resumen de IVA y Facturación" }: FinancialChartProps) {
  return (
    <div className="bg-white border border-brand-gray-200 rounded-2xl p-4 sm:p-5 shadow-2xs w-full">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-xs font-bold text-brand-gray-800 uppercase tracking-wider">
          {title}
        </h3>
        <span className="text-[11px] bg-brand-red-subtle text-brand-red font-semibold px-2.5 py-0.5 rounded-full border border-brand-red/20">
          Proyección & Histórico SRI
        </span>
      </div>

      <div className="h-64 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={data} margin={{ top: 10, right: 10, left: -15, bottom: 0 }}>
            <defs>
              <linearGradient id="colorVentas" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#990000" stopOpacity={0.4} />
                <stop offset="95%" stopColor="#990000" stopOpacity={0.0} />
              </linearGradient>
              <linearGradient id="colorCompras" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#2563eb" stopOpacity={0.3} />
                <stop offset="95%" stopColor="#2563eb" stopOpacity={0.0} />
              </linearGradient>
              <linearGradient id="colorIva" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#059669" stopOpacity={0.4} />
                <stop offset="95%" stopColor="#059669" stopOpacity={0.0} />
              </linearGradient>
            </defs>

            <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
            <XAxis
              dataKey="mes"
              tick={{ fontSize: 11, fill: "#64748b" }}
              axisLine={{ stroke: "#cbd5e1" }}
              tickLine={false}
            />
            <YAxis
              tick={{ fontSize: 11, fill: "#64748b" }}
              axisLine={false}
              tickLine={false}
              tickFormatter={(v) => `$${v}`}
            />
            <Tooltip
              contentStyle={{
                backgroundColor: "#ffffff",
                borderRadius: "12px",
                borderColor: "#e2e8f0",
                boxShadow: "0 4px 12px rgba(0, 0, 0, 0.08)",
                fontSize: "12px",
              }}
              formatter={(value: any) => [`$${Number(value).toFixed(2)}`, ""]}
            />
            <Legend
              wrapperStyle={{ fontSize: "11px", paddingTop: "10px" }}
              iconType="circle"
            />

            <Area
              type="monotone"
              dataKey="ventas"
              name="Ventas Totales"
              stroke="#990000"
              strokeWidth={2}
              fillOpacity={1}
              fill="url(#colorVentas)"
            />
            <Area
              type="monotone"
              dataKey="compras"
              name="Compras / Gastos"
              stroke="#2563eb"
              strokeWidth={2}
              fillOpacity={1}
              fill="url(#colorCompras)"
            />
            <Area
              type="monotone"
              dataKey="ivaPagar"
              name="Estimación IVA"
              stroke="#059669"
              strokeWidth={2.5}
              fillOpacity={1}
              fill="url(#colorIva)"
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
