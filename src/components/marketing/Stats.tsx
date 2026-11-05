"use client";

import { CountUp, Stagger, StaggerItem } from "./Reveal";

const STATS = [
  { value: 9, suffix: "", label: "módulos de gestión", hint: "Emisión, CxC, inventario, POS, SRI, ATS, contabilidad, nómina e IA" },
  { value: 12, suffix: "+", label: "ciudades cubiertas", hint: "Quito, Guayaquil, Cuenca, Ambato, Manta y más" },
  { value: 5, suffix: "", label: "empresas por cuenta", hint: "Hasta 5 RUCs en el plan Despacho" },
  { value: 19, prefix: "$", suffix: "", label: "desde / mes", hint: "Plan Emprendedor, pago con PayPhone" },
];

export default function Stats() {
  return (
    <section className="py-8 sm:py-10">
      <div className="mx-auto max-w-7xl px-4 sm:px-6">
        <Stagger className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {STATS.map((s) => (
            <StaggerItem
              key={s.label}
              className="group rounded-3xl border border-brand-gray-200 bg-white p-6 transition-shadow hover:shadow-[0_20px_50px_-30px_rgba(26,26,24,0.4)]"
            >
              <p className="text-4xl font-extrabold tracking-tight text-brand-gray-900 tabular-nums">
                <CountUp value={s.value} prefix={s.prefix} suffix={s.suffix} />
              </p>
              <p className="mt-1 text-sm font-bold text-brand-red">{s.label}</p>
              <p className="mt-2 text-xs leading-relaxed text-brand-gray-500">{s.hint}</p>
            </StaggerItem>
          ))}
        </Stagger>
      </div>
    </section>
  );
}
