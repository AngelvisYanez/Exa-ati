"use client";

import Link from "next/link";
import Image from "next/image";
import { motion, useReducedMotion } from "motion/react";
import { ArrowUpRight, BadgeCheck, Phone, ShieldCheck, Star } from "lucide-react";
import DashboardMock from "./DashboardMock";

const CHIPS = ["Facturación SRI", "Cobros y cartera", "ATS y control tributario", "Contabilidad"];

const fade = (delay: number) => ({
  initial: { opacity: 0, y: 18 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.65, delay, ease: [0.22, 1, 0.36, 1] as const },
});

export default function Hero() {
  const reduce = useReducedMotion();
  const anim = (d: number) => (reduce ? {} : fade(d));

  return (
    <section className="relative px-3 sm:px-5 pt-[4.75rem] sm:pt-[5.5rem]">
      <div className="mx-auto max-w-7xl">
        <div className="relative isolate overflow-hidden rounded-[1.75rem] sm:rounded-[2.25rem] bg-brand-gray-900 text-white">
          {/* Imagen de fondo */}
          <Image
            src="/marketing/hero-bg.jpg"
            alt=""
            fill
            priority
            sizes="(max-width: 1280px) 100vw, 1280px"
            className="object-cover object-[70%_center] opacity-70 lg:opacity-90"
          />
          <div
            className="absolute inset-0 -z-0"
            aria-hidden
            style={{
              background:
                "linear-gradient(90deg, rgba(26,26,24,0.96) 0%, rgba(26,26,24,0.9) 35%, rgba(26,26,24,0.45) 65%, rgba(26,26,24,0.25) 100%), linear-gradient(180deg, rgba(26,26,24,0.2) 0%, rgba(26,26,24,0) 40%, rgba(26,26,24,0.85) 100%)",
            }}
          />
          <div
            className="absolute -left-24 -top-24 size-[28rem] rounded-full blur-3xl animate-blob"
            aria-hidden
            style={{ background: "radial-gradient(circle, rgba(160,37,37,0.45), transparent 65%)" }}
          />

          <div className="relative grid gap-10 px-5 py-10 sm:px-8 sm:py-14 lg:grid-cols-12 lg:gap-6 lg:px-12 lg:py-16 xl:px-14">
            {/* Copy */}
            <div className="lg:col-span-7 flex flex-col justify-center">
              <motion.div {...anim(0.05)} className="flex flex-wrap items-center gap-2.5">
                <span className="inline-flex items-center gap-1.5 rounded-full bg-white/10 px-3 py-1.5 text-[11px] font-bold backdrop-blur-sm ring-1 ring-white/15">
                  <span className="flex size-4 items-center justify-center rounded-full bg-brand-red text-[8px] font-extrabold">e</span>
                  <span className="flex text-brand-amber">
                    {[0, 1, 2, 3, 4].map((i) => (
                      <Star key={i} className="size-3 fill-current" />
                    ))}
                  </span>
                  <span>Plataforma 100% en la nube</span>
                </span>
                <span className="inline-flex items-center gap-1.5 rounded-full bg-success/20 px-3 py-1.5 text-[11px] font-bold text-success-light ring-1 ring-success/30">
                  <BadgeCheck className="size-3.5" /> Alineado al SRI Ecuador
                </span>
              </motion.div>

              <motion.ul {...anim(0.15)} className="mt-5 flex flex-wrap gap-1.5">
                {CHIPS.map((c) => (
                  <li
                    key={c}
                    className="rounded-full border border-white/15 bg-white/[0.06] px-2.5 py-1 text-[10.5px] font-semibold text-white/80"
                  >
                    {c}
                  </li>
                ))}
              </motion.ul>

              <motion.h1
                {...anim(0.25)}
                className="mt-5 text-[2.25rem] leading-[1.02] font-extrabold tracking-[-0.02em] sm:text-5xl lg:text-[3.6rem] xl:text-[4rem]"
              >
                Factura, cobra y cumple
                <br />
                con el SRI,{" "}
                <span className="mk-serif-accent text-brand-red-bright">
                  sin complicarte.
                </span>
              </motion.h1>

              <motion.p
                {...anim(0.35)}
                className="mt-5 max-w-xl text-[15px] leading-relaxed text-white/75 sm:text-base"
              >
                EXA ATI une facturación electrónica, cuentas por cobrar,
                sincronización con el SRI, ATS y contabilidad en un solo panel.
                Para emprendedores y contadores en Quito, Guayaquil, Cuenca y
                todo Ecuador.
              </motion.p>

              <motion.div {...anim(0.45)} className="mt-7 flex flex-wrap items-center gap-3">
                <Link
                  href="/precios"
                  className="group inline-flex h-12 items-center gap-2 rounded-full bg-brand-red pl-5 pr-1.5 text-sm font-bold text-white shadow-[0_12px_30px_-10px_rgba(160,37,37,0.8)] hover:bg-brand-red-bright transition-colors"
                >
                  Ver planes y empezar
                  <span className="flex size-9 items-center justify-center rounded-full bg-white text-brand-red transition-transform duration-300 group-hover:rotate-45">
                    <ArrowUpRight className="size-4" strokeWidth={2.5} />
                  </span>
                </Link>
                <Link
                  href="/#contacto"
                  className="inline-flex h-12 items-center gap-2 rounded-full px-4 text-sm font-bold text-white/90 hover:text-white underline-offset-4 hover:underline"
                >
                  <Phone className="size-4" /> Hablar con un asesor
                </Link>
              </motion.div>

              <motion.dl
                {...anim(0.55)}
                className="mt-9 grid max-w-md grid-cols-3 gap-4 border-t border-white/10 pt-6"
              >
                {[
                  { k: "3", v: "planes en USD" },
                  { k: "12+", v: "ciudades del Ecuador" },
                  { k: "9", v: "módulos de gestión" },
                ].map((s) => (
                  <div key={s.v}>
                    <dt className="text-xl font-extrabold tabular-nums sm:text-2xl">{s.k}</dt>
                    <dd className="text-[11px] font-medium text-white/60">{s.v}</dd>
                  </div>
                ))}
              </motion.dl>
            </div>

            {/* Panel */}
            <div className="lg:col-span-5 relative flex items-end">
              <motion.div
                initial={reduce ? false : { opacity: 0, y: 40, rotate: 1.5 }}
                animate={{ opacity: 1, y: 0, rotate: 0 }}
                transition={{ duration: 0.9, delay: 0.5, ease: [0.22, 1, 0.36, 1] }}
                className="relative w-full lg:-mr-4 xl:-mr-6"
              >
                <div className="absolute -top-4 right-3 z-10 hidden sm:flex items-center gap-2 rounded-2xl bg-white px-3 py-2 text-brand-gray-900 shadow-xl">
                  <span className="flex size-8 items-center justify-center rounded-xl bg-success-pale text-success">
                    <ShieldCheck className="size-4" />
                  </span>
                  <div className="leading-tight">
                    <p className="text-[11px] font-extrabold">Firma digital al día</p>
                    <p className="text-[10px] text-brand-gray-500">Comprobantes autorizados</p>
                  </div>
                </div>
                <div className="animate-float-slow">
                  <DashboardMock compact />
                </div>
              </motion.div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
