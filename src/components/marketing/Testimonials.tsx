"use client";

import { useEffect, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { ChevronLeft, ChevronRight, Quote, Star } from "lucide-react";
import { Reveal } from "./Reveal";
import { cn } from "@/lib/utils";

/** Casos de uso ilustrativos (no testimonios de clientes reales). */
const CASES = [
  {
    role: "Emprendedora · tienda de barrio, Quito",
    initials: "MA",
    quote:
      "Antes facturaba desde el portal del SRI y anotaba cobros en un cuaderno. Con un solo panel emito, veo quién me debe y cuándo vence cada factura.",
    tags: ["Emisión SRI", "Cuentas por cobrar"],
  },
  {
    role: "Contador independiente · 3 clientes, Guayaquil",
    initials: "JR",
    quote:
      "La sincronización de comprobantes recibidos y el ATS armado al cierre del mes me ahorran las noches de fin de período. Todo por RUC, separado.",
    tags: ["Sync SRI", "ATS"],
  },
  {
    role: "Despacho contable · equipo de 4, Cuenca",
    initials: "LC",
    quote:
      "Manejamos varias empresas con roles por usuario, nómina y control tributario en el mismo lugar. El asistente IA responde dudas con nuestros propios datos.",
    tags: ["Multiempresa", "Nómina", "IA"],
  },
];

export default function Testimonials() {
  const [i, setI] = useState(0);
  const reduce = useReducedMotion();

  useEffect(() => {
    if (reduce) return;
    const t = setInterval(() => setI((v) => (v + 1) % CASES.length), 6500);
    return () => clearInterval(t);
  }, [reduce]);

  const go = (dir: 1 | -1) => setI((v) => (v + dir + CASES.length) % CASES.length);
  const c = CASES[i];

  return (
    <section className="py-12 sm:py-16">
      <div className="mx-auto max-w-7xl px-4 sm:px-6">
        <div className="grid gap-8 lg:grid-cols-12 lg:items-center">
          <Reveal className="lg:col-span-4">
            <p className="inline-flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.16em] text-brand-red">
              <span className="size-1.5 rounded-full bg-brand-red" /> Casos de uso
            </p>
            <h2 className="mt-3 text-3xl font-extrabold tracking-tight text-brand-gray-900 sm:text-4xl">
              Así se usa EXA ATI{" "}
              <span className="mk-serif-accent text-brand-red">en el día a día</span>
            </h2>
            <p className="mt-3 text-sm text-brand-gray-500">
              Escenarios ilustrativos de cómo emprendedores, contadores y
              despachos en Ecuador organizan su operación con la plataforma.
            </p>
            <div className="mt-6 flex items-center gap-2">
              <button
                type="button"
                onClick={() => go(-1)}
                aria-label="Caso anterior"
                className="flex size-10 items-center justify-center rounded-full border border-brand-gray-300 text-brand-gray-800 hover:border-brand-red hover:text-brand-red transition-colors cursor-pointer"
              >
                <ChevronLeft className="size-4" />
              </button>
              <button
                type="button"
                onClick={() => go(1)}
                aria-label="Caso siguiente"
                className="flex size-10 items-center justify-center rounded-full bg-brand-gray-900 text-white hover:bg-brand-red transition-colors cursor-pointer"
              >
                <ChevronRight className="size-4" />
              </button>
              <div className="ml-3 flex gap-1.5">
                {CASES.map((_, idx) => (
                  <button
                    key={idx}
                    type="button"
                    aria-label={`Ir al caso ${idx + 1}`}
                    onClick={() => setI(idx)}
                    className={cn(
                      "h-1.5 rounded-full transition-all cursor-pointer",
                      idx === i ? "w-6 bg-brand-red" : "w-1.5 bg-brand-gray-300",
                    )}
                  />
                ))}
              </div>
            </div>
          </Reveal>

          <div className="lg:col-span-8">
            <div className="relative min-h-[300px] sm:min-h-[260px]">
              <AnimatePresence mode="wait">
                <motion.blockquote
                  key={i}
                  initial={reduce ? false : { opacity: 0, x: 30 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={reduce ? undefined : { opacity: 0, x: -30 }}
                  transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
                  className="relative flex h-full flex-col rounded-[1.75rem] bg-white p-7 ring-1 ring-brand-gray-200 shadow-[0_30px_60px_-40px_rgba(26,26,24,0.4)] sm:p-9"
                >
                  <Quote className="absolute right-7 top-7 size-10 text-brand-red-pale" />
                  <div className="flex text-brand-amber">
                    {[0, 1, 2, 3, 4].map((s) => (
                      <Star key={s} className="size-4 fill-current" />
                    ))}
                  </div>
                  <p className="mt-4 text-lg leading-relaxed text-brand-gray-800 sm:text-xl">
                    “{c.quote}”
                  </p>
                  <footer className="mt-6 flex flex-wrap items-center justify-between gap-4">
                    <div className="flex items-center gap-3">
                      <span className="flex size-11 items-center justify-center rounded-full bg-brand-red text-sm font-extrabold text-white">
                        {c.initials}
                      </span>
                      <div>
                        <p className="text-sm font-bold text-brand-gray-900">Caso ilustrativo</p>
                        <p className="text-xs text-brand-gray-500">{c.role}</p>
                      </div>
                    </div>
                    <ul className="flex flex-wrap gap-1.5">
                      {c.tags.map((t) => (
                        <li
                          key={t}
                          className="rounded-full bg-brand-red-subtle px-2.5 py-1 text-[11px] font-bold text-brand-red"
                        >
                          {t}
                        </li>
                      ))}
                    </ul>
                  </footer>
                </motion.blockquote>
              </AnimatePresence>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
