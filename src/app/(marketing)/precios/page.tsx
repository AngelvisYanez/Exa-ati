"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Check } from "lucide-react";
import { FALLBACK_PLANS, SYSTEM_PLAN_CODES } from "@/lib/plans";

function money(n: number) {
  return new Intl.NumberFormat("es-EC", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 0,
  }).format(n);
}

const HIGHLIGHTS: Record<string, string[]> = {
  emprendedor: [
    "1 empresa (RUC)",
    "Emitir y documentos",
    "CxC / CxP e inventario",
    "Asistente IA",
  ],
  contador: [
    "Hasta 3 empresas",
    "Sync SRI y comprobantes",
    "ATS y control tributario",
    "Contabilidad básica",
  ],
  despacho: [
    "Hasta 5 empresas",
    "Nómina y auditoría IA",
    "Admin de equipo",
    "Todo Contador + más",
  ],
};

export default function PreciosPage() {
  const [periodo, setPeriodo] = useState<"mensual" | "anual">("mensual");

  const plans = useMemo(
    () => SYSTEM_PLAN_CODES.map((c) => FALLBACK_PLANS[c]),
    []
  );

  return (
    <main id="main-content" className="mx-auto max-w-6xl px-4 sm:px-6 pt-28 sm:pt-32 pb-12 sm:pb-16">
      <div className="max-w-2xl">
        <p className="text-[11px] font-bold uppercase tracking-wider text-brand-red mb-2">
          Precios
        </p>
        <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-brand-gray-900">
          Planes para facturar y cumplir en Ecuador
        </h1>
        <p className="mt-3 text-sm text-brand-gray-500 leading-relaxed">
          Suscripción mensual o anual con PayPhone. Accedes al panel cuando el
          pago queda aprobado. Emprendedores y contadores en Quito, Guayaquil,
          Cuenca y todo el país.
        </p>
      </div>

      <div className="mt-8 inline-flex rounded-lg border border-brand-gray-200 bg-white p-1">
        <button
          type="button"
          onClick={() => setPeriodo("mensual")}
          className={`px-4 py-1.5 text-xs font-bold rounded-md transition-colors cursor-pointer ${
            periodo === "mensual"
              ? "bg-brand-red text-white"
              : "text-brand-gray-600 hover:text-brand-red"
          }`}
        >
          Mensual
        </button>
        <button
          type="button"
          onClick={() => setPeriodo("anual")}
          className={`px-4 py-1.5 text-xs font-bold rounded-md transition-colors cursor-pointer ${
            periodo === "anual"
              ? "bg-brand-red text-white"
              : "text-brand-gray-600 hover:text-brand-red"
          }`}
        >
          Anual
          <span className="ml-1 font-medium opacity-80">· ahorro ~2 meses</span>
        </button>
      </div>

      <div className="mt-10 grid gap-6 md:grid-cols-3">
        {plans.map((plan) => {
          const price =
            periodo === "anual"
              ? Number(plan.precioAnual ?? plan.precioMensual * 10)
              : Number(plan.precioMensual);
          const featured = plan.codigo === "contador";
          const bullets = HIGHLIGHTS[plan.codigo] || [];

          return (
            <article
              key={plan.codigo}
              className={`relative flex flex-col rounded-xl border bg-white p-6 transition-shadow duration-200 ${
                featured
                  ? "border-brand-red shadow-sm ring-1 ring-brand-red/20"
                  : "border-brand-gray-200 hover:border-brand-gray-300"
              }`}
            >
              {featured ? (
                <span className="absolute -top-2.5 left-6 rounded-md bg-brand-red px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-white">
                  Recomendado
                </span>
              ) : null}
              <h2 className="text-lg font-extrabold text-brand-gray-900">
                {plan.nombre}
              </h2>
              <p className="mt-2 text-xs text-brand-gray-500 leading-relaxed min-h-[2.5rem]">
                {plan.descripcion}
              </p>
              <p className="mt-5 flex items-baseline gap-1">
                <span className="text-3xl font-extrabold text-brand-gray-900 tabular-nums">
                  {money(price)}
                </span>
                <span className="text-xs font-semibold text-brand-gray-400">
                  / {periodo === "anual" ? "año" : "mes"}
                </span>
              </p>
              <ul className="mt-5 flex flex-col gap-2.5 flex-1">
                {bullets.map((b) => (
                  <li
                    key={b}
                    className="flex items-start gap-2 text-xs text-brand-gray-700"
                  >
                    <Check
                      className="mt-0.5 size-3.5 shrink-0 text-brand-red"
                      strokeWidth={2.5}
                    />
                    {b}
                  </li>
                ))}
              </ul>
              <Link
                href={`/registro?plan=${plan.codigo}&periodo=${periodo}`}
                className={`mt-6 inline-flex w-full items-center justify-center rounded-lg px-4 py-2.5 text-sm font-bold transition-colors ${
                  featured
                    ? "bg-brand-red text-white hover:bg-brand-red-bright"
                    : "border border-brand-gray-300 text-brand-gray-800 hover:border-brand-red hover:text-brand-red"
                }`}
              >
                Empezar con {plan.nombre}
              </Link>
            </article>
          );
        })}
      </div>

      <p className="mt-10 text-center text-xs text-brand-gray-400">
        ¿Ya tienes cuenta?{" "}
        <Link
          href="/iniciar-sesion"
          className="font-semibold text-brand-red hover:underline"
        >
          Inicia sesión
        </Link>{" "}
        y ve a Suscripción para renovar o cambiar de plan.
      </p>
    </main>
  );
}
