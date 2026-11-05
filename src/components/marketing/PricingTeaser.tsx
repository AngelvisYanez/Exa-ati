"use client";

import { useState } from "react";
import Link from "next/link";
import { motion } from "motion/react";
import { ArrowUpRight, Check } from "lucide-react";
import { FALLBACK_PLANS, SYSTEM_PLAN_CODES } from "@/lib/plans";
import { Reveal, Stagger, StaggerItem } from "./Reveal";
import { cn } from "@/lib/utils";

const HIGHLIGHTS: Record<string, string[]> = {
  emprendedor: ["1 empresa (RUC)", "Emitir y documentos", "CxC / CxP e inventario", "Asistente IA"],
  contador: ["Hasta 3 empresas", "Sync SRI y comprobantes", "ATS y control tributario", "Contabilidad"],
  despacho: ["Hasta 5 empresas", "Nómina y auditoría", "Administración de equipo", "Todo Contador + más"],
};

function money(n: number) {
  return new Intl.NumberFormat("es-EC", { style: "currency", currency: "USD", minimumFractionDigits: 0 }).format(n);
}

export default function PricingTeaser() {
  const [periodo, setPeriodo] = useState<"mensual" | "anual">("mensual");

  return (
    <section className="py-12 sm:py-16">
      <div className="mx-auto max-w-7xl px-4 sm:px-6">
        <div className="flex flex-col gap-6 sm:flex-row sm:items-end sm:justify-between">
          <Reveal>
            <p className="inline-flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.16em] text-brand-red">
              <span className="size-1.5 rounded-full bg-brand-red" /> Precios
            </p>
            <h2 className="mt-3 text-3xl font-extrabold tracking-tight text-brand-gray-900 sm:text-4xl">
              Planes claros,{" "}
              <span className="mk-serif-accent text-brand-red">en dólares</span>
            </h2>
            <p className="mt-3 max-w-md text-sm text-brand-gray-500">
              Mensual o anual. El panel se activa cuando PayPhone aprueba el cobro.
            </p>
          </Reveal>
          <Reveal delay={0.1}>
            <div
              role="tablist"
              aria-label="Periodo de facturación"
              className="relative inline-flex rounded-full border border-brand-gray-200 bg-white p-1 text-sm font-bold"
            >
              {(["mensual", "anual"] as const).map((p) => (
                <button
                  key={p}
                  role="tab"
                  type="button"
                  aria-selected={periodo === p}
                  onClick={() => setPeriodo(p)}
                  className={cn(
                    "relative z-10 rounded-full px-4 py-2 capitalize transition-colors cursor-pointer",
                    periodo === p ? "text-white" : "text-brand-gray-600 hover:text-brand-gray-900",
                  )}
                >
                  {periodo === p ? (
                    <motion.span
                      layoutId="pricing-pill"
                      className="absolute inset-0 -z-10 rounded-full bg-brand-gray-900"
                      transition={{ type: "spring", stiffness: 400, damping: 32 }}
                    />
                  ) : null}
                  {p}
                  {p === "anual" ? (
                    <span className="ml-1.5 rounded-full bg-success-pale px-1.5 py-0.5 text-[10px] text-success">
                      2 meses gratis
                    </span>
                  ) : null}
                </button>
              ))}
            </div>
          </Reveal>
        </div>

        <Stagger className="mt-10 grid gap-4 md:grid-cols-3">
          {SYSTEM_PLAN_CODES.map((code) => {
            const p = FALLBACK_PLANS[code];
            const featured = code === "contador";
            const price = periodo === "anual" && p.precioAnual ? p.precioAnual : p.precioMensual;
            return (
              <StaggerItem
                key={code}
                as="article"
                className={cn(
                  "relative flex flex-col rounded-[1.75rem] p-7",
                  featured
                    ? "bg-brand-gray-900 text-white shadow-[0_30px_60px_-30px_rgba(26,26,24,0.6)] md:-translate-y-3"
                    : "bg-white text-brand-gray-900 ring-1 ring-brand-gray-200",
                )}
              >
                {featured ? (
                  <span className="absolute right-6 top-6 rounded-full bg-brand-red px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-white">
                    Más elegido
                  </span>
                ) : null}
                <p className={cn("text-[11px] font-bold uppercase tracking-wider", featured ? "text-white/60" : "text-brand-red")}>
                  {p.nombre}
                </p>
                <div className="mt-4 flex items-end gap-1.5">
                  <motion.p
                    key={`${code}-${periodo}`}
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="text-4xl font-extrabold tracking-tight tabular-nums"
                  >
                    {money(price)}
                  </motion.p>
                  <span className={cn("pb-1.5 text-xs font-semibold", featured ? "text-white/50" : "text-brand-gray-400")}>
                    / {periodo === "anual" ? "año" : "mes"}
                  </span>
                </div>
                <p className={cn("mt-2 text-xs leading-relaxed", featured ? "text-white/65" : "text-brand-gray-500")}>
                  {p.descripcion}
                </p>
                <ul className="mt-6 space-y-2.5">
                  {HIGHLIGHTS[code].map((h) => (
                    <li key={h} className="flex items-center gap-2.5 text-sm font-semibold">
                      <span className={cn("flex size-5 items-center justify-center rounded-full", featured ? "bg-brand-red text-white" : "bg-success-pale text-success")}>
                        <Check className="size-3" strokeWidth={3} />
                      </span>
                      {h}
                    </li>
                  ))}
                </ul>
                <Link
                  href={`/registro?plan=${code}&periodo=${periodo}`}
                  className={cn(
                    "group mt-8 inline-flex h-11 items-center justify-between rounded-full pl-5 pr-1.5 text-sm font-bold transition-colors",
                    featured
                      ? "bg-brand-red text-white hover:bg-brand-red-bright"
                      : "bg-brand-gray-100 text-brand-gray-900 hover:bg-brand-gray-900 hover:text-white",
                  )}
                >
                  Elegir {p.nombre}
                  <span className={cn("flex size-8 items-center justify-center rounded-full transition-transform duration-300 group-hover:rotate-45", featured ? "bg-white text-brand-red" : "bg-white text-brand-gray-900")}>
                    <ArrowUpRight className="size-4" strokeWidth={2.5} />
                  </span>
                </Link>
              </StaggerItem>
            );
          })}
        </Stagger>

        <Reveal className="mt-8 text-center">
          <Link href="/precios" className="text-sm font-bold text-brand-red underline-offset-4 hover:underline">
            Comparar todos los planes y módulos →
          </Link>
        </Reveal>
      </div>
    </section>
  );
}
