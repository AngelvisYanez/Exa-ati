"use client";

import Link from "next/link";
import { motion } from "motion/react";
import { ArrowUpRight, Building2, Check, Store } from "lucide-react";
import { Reveal } from "./Reveal";
import DashboardMock from "./DashboardMock";

const CARDS = [
  {
    icon: Store,
    kicker: "Emprendedor",
    title: "Una empresa. Ventas y cobros primero.",
    body: "Factura, inventario, punto de venta y cartera — sin módulos de declaraciones que no necesitas. Ideal si tu foco es vender.",
    bullets: ["1 RUC", "Emitir y documentos", "CxC / CxP e inventario", "Asistente IA"],
    href: "/registro?plan=emprendedor&periodo=mensual",
    cta: "Empezar como emprendedor",
    dark: true,
  },
  {
    icon: Building2,
    kicker: "Contador / Despacho",
    title: "Varias empresas. Cumplimiento y sync.",
    body: "Hasta 3 o 5 RUCs, sincronización con el SRI, ATS, control tributario, contabilidad y nómina. Pensado para estudios en Ecuador.",
    bullets: ["3 a 5 empresas", "Sync SRI y comprobantes", "ATS y control tributario", "Contabilidad y nómina"],
    href: "/registro?plan=contador&periodo=mensual",
    cta: "Empezar como contador",
    dark: false,
  },
];

export default function Audiences() {
  return (
    <section className="py-12 sm:py-16">
      <div className="mx-auto max-w-7xl px-4 sm:px-6">
        <Reveal className="max-w-2xl">
          <p className="inline-flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.16em] text-brand-red">
            <span className="size-1.5 rounded-full bg-brand-red" /> Para quién es
          </p>
          <h2 className="mt-3 text-3xl font-extrabold tracking-tight text-brand-gray-900 sm:text-4xl">
            Dos audiencias.{" "}
            <span className="mk-serif-accent text-brand-red">Un solo producto.</span>
          </h2>
          <p className="mt-3 text-sm text-brand-gray-500">
            Elige el camino según cómo operas en Ecuador. Puedes cambiar de
            plan cuando tu negocio crezca.
          </p>
        </Reveal>

        <div className="mt-10 grid gap-5 lg:grid-cols-2">
          {CARDS.map((c, i) => (
            <motion.article
              key={c.kicker}
              initial={{ opacity: 0, y: 28 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, amount: 0.25 }}
              transition={{ duration: 0.6, delay: i * 0.1, ease: [0.22, 1, 0.36, 1] }}
              whileHover={{ y: -4 }}
              className={
                c.dark
                  ? "relative overflow-hidden rounded-[1.75rem] bg-brand-red p-7 text-white sm:p-9"
                  : "relative overflow-hidden rounded-[1.75rem] bg-white p-7 text-brand-gray-900 ring-1 ring-brand-gray-200 sm:p-9"
              }
            >
              {c.dark ? (
                <div
                  className="pointer-events-none absolute inset-0"
                  aria-hidden
                  style={{
                    background:
                      "radial-gradient(ellipse 70% 60% at 100% 0%, rgba(255,255,255,0.22), transparent 60%)",
                  }}
                />
              ) : null}
              <div className="relative">
                <span
                  className={
                    c.dark
                      ? "flex size-11 items-center justify-center rounded-2xl bg-white/15 text-white ring-1 ring-white/20"
                      : "flex size-11 items-center justify-center rounded-2xl bg-brand-red-subtle text-brand-red"
                  }
                >
                  <c.icon className="size-5" strokeWidth={2} />
                </span>
                <p
                  className={
                    c.dark
                      ? "mt-5 text-[11px] font-bold uppercase tracking-wider text-white/70"
                      : "mt-5 text-[11px] font-bold uppercase tracking-wider text-brand-red"
                  }
                >
                  {c.kicker}
                </p>
                <h3 className="mt-2 text-2xl font-extrabold leading-tight">{c.title}</h3>
                <p className={c.dark ? "mt-3 text-sm leading-relaxed text-white/80" : "mt-3 text-sm leading-relaxed text-brand-gray-500"}>
                  {c.body}
                </p>
                <ul className="mt-5 grid gap-2 sm:grid-cols-2">
                  {c.bullets.map((b) => (
                    <li key={b} className="flex items-center gap-2 text-sm font-semibold">
                      <span
                        className={
                          c.dark
                            ? "flex size-4 items-center justify-center rounded-full bg-white text-brand-red"
                            : "flex size-4 items-center justify-center rounded-full bg-success text-white"
                        }
                      >
                        <Check className="size-2.5" strokeWidth={3} />
                      </span>
                      {b}
                    </li>
                  ))}
                </ul>
                <Link
                  href={c.href}
                  className={
                    c.dark
                      ? "group mt-7 inline-flex h-11 items-center gap-2 rounded-full bg-white pl-5 pr-1.5 text-sm font-bold text-brand-red hover:bg-brand-gray-50 transition-colors"
                      : "group mt-7 inline-flex h-11 items-center gap-2 rounded-full bg-brand-gray-900 pl-5 pr-1.5 text-sm font-bold text-white hover:bg-brand-red transition-colors"
                  }
                >
                  {c.cta}
                  <span
                    className={
                      c.dark
                        ? "flex size-8 items-center justify-center rounded-full bg-brand-red text-white transition-transform duration-300 group-hover:rotate-45"
                        : "flex size-8 items-center justify-center rounded-full bg-white text-brand-gray-900 transition-transform duration-300 group-hover:rotate-45"
                    }
                  >
                    <ArrowUpRight className="size-4" strokeWidth={2.5} />
                  </span>
                </Link>
              </div>
            </motion.article>
          ))}
        </div>

        {/* Vista completa del panel */}
        <Reveal className="mt-14">
          <div className="relative rounded-[2rem] bg-brand-gray-900 p-4 sm:p-8 lg:p-10 overflow-hidden">
            <div
              className="pointer-events-none absolute inset-0"
              aria-hidden
              style={{
                background:
                  "radial-gradient(ellipse 50% 60% at 0% 100%, rgba(160,37,37,0.45), transparent 60%), radial-gradient(ellipse 40% 50% at 100% 0%, rgba(160,37,37,0.3), transparent 60%)",
              }}
            />
            <div className="relative grid gap-8 lg:grid-cols-12 lg:items-center">
              <div className="lg:col-span-4 text-white">
                <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-brand-red-bright">
                  El panel
                </p>
                <h3 className="mt-3 text-2xl font-extrabold leading-tight sm:text-3xl">
                  Toda tu operación, en una sola pantalla
                </h3>
                <p className="mt-3 text-sm leading-relaxed text-white/70">
                  Ventas, compras, retenciones y documentos en proceso ante el
                  SRI. Gráficas de flujo, comprobantes recientes y un asistente
                  IA que responde con tus datos.
                </p>
                <ul className="mt-5 space-y-2 text-sm text-white/85">
                  {["KPIs del período con un vistazo", "Estado SRI de cada comprobante", "Acciones rápidas de emisión"].map((t) => (
                    <li key={t} className="flex items-center gap-2">
                      <span className="size-1.5 rounded-full bg-brand-red-bright" /> {t}
                    </li>
                  ))}
                </ul>
              </div>
              <div className="lg:col-span-8">
                <DashboardMock />
              </div>
            </div>
          </div>
        </Reveal>
      </div>
    </section>
  );
}
