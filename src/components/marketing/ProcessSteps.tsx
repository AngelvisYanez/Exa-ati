"use client";

import Image from "next/image";
import { motion, useReducedMotion } from "motion/react";
import { ArrowDown, Check, CreditCard, FileCheck2, Landmark, RefreshCw } from "lucide-react";
import { Reveal, Stagger, StaggerItem } from "./Reveal";

const CHECKS = [
  "Comprobantes autorizados por el SRI",
  "Cartera al día y vencimientos claros",
  "ATS y control tributario listos a fin de mes",
];

function SyncOrbit() {
  const reduce = useReducedMotion();
  return (
    <div className="relative mx-auto mt-6 size-40 sm:size-44">
      <motion.div
        className="absolute inset-0 rounded-full border border-dashed border-brand-gray-300"
        animate={reduce ? undefined : { rotate: 360 }}
        transition={{ duration: 22, repeat: Infinity, ease: "linear" }}
      >
        <span className="absolute -top-3 left-1/2 -ml-3 flex size-6 items-center justify-center rounded-full bg-white text-brand-red shadow-md ring-1 ring-brand-gray-200">
          <FileCheck2 className="size-3" />
        </span>
        <span className="absolute top-1/2 -right-3 -mt-3 flex size-6 items-center justify-center rounded-full bg-white text-brand-gray-700 shadow-md ring-1 ring-brand-gray-200">
          <Landmark className="size-3" />
        </span>
        <span className="absolute -bottom-3 left-1/2 -ml-3 flex size-6 items-center justify-center rounded-full bg-white text-success shadow-md ring-1 ring-brand-gray-200">
          <Check className="size-3" />
        </span>
        <span className="absolute top-1/2 -left-3 -mt-3 flex size-6 items-center justify-center rounded-full bg-white text-brand-amber shadow-md ring-1 ring-brand-gray-200">
          <CreditCard className="size-3" />
        </span>
      </motion.div>
      <div className="absolute inset-6 rounded-full bg-brand-red-subtle" />
      <div className="absolute inset-[2.6rem] flex items-center justify-center rounded-full bg-brand-red text-white shadow-[0_12px_30px_-10px_rgba(160,37,37,0.8)]">
        <motion.span
          animate={reduce ? undefined : { rotate: -360 }}
          transition={{ duration: 8, repeat: Infinity, ease: "linear" }}
          className="flex"
        >
          <RefreshCw className="size-6" strokeWidth={2.2} />
        </motion.span>
      </div>
    </div>
  );
}

export default function ProcessSteps() {
  return (
    <section id="proceso" className="scroll-mt-24 py-12 sm:py-16">
      <div className="mx-auto max-w-7xl px-4 sm:px-6">
        <div className="rounded-[2rem] bg-white p-5 shadow-[0_30px_80px_-50px_rgba(26,26,24,0.35)] ring-1 ring-brand-gray-200/70 sm:p-8 lg:p-10">
          <div className="flex flex-col gap-6 sm:flex-row sm:items-end sm:justify-between">
            <Reveal>
              <p className="inline-flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.16em] text-brand-red">
                <span className="size-1.5 rounded-full bg-brand-red" /> Nuestro proceso
              </p>
              <h2 className="mt-3 text-3xl font-extrabold tracking-tight text-brand-gray-900 sm:text-4xl">
                Cómo trabajamos,{" "}
                <span className="mk-serif-accent text-brand-red">
                  de principio a fin
                </span>
              </h2>
            </Reveal>
            <Reveal delay={0.1} className="flex items-end gap-4 sm:flex-col sm:items-end">
              <p className="max-w-xs text-sm text-brand-gray-500 sm:text-right">
                De la web al panel en minutos. Sin instalaciones ni
                configuraciones eternas.
              </p>
              <span className="hidden sm:flex size-10 items-center justify-center rounded-full border border-brand-gray-300 text-brand-gray-700">
                <ArrowDown className="size-4" />
              </span>
            </Reveal>
          </div>

          <Stagger className="mt-8 grid gap-4 lg:grid-cols-3 lg:grid-rows-[auto_auto]">
            {/* Paso 1 — alto */}
            <StaggerItem as="article" className="relative flex flex-col overflow-hidden rounded-3xl bg-brand-gray-50 ring-1 ring-brand-gray-200/70 lg:row-span-2">
              <div className="p-6">
                <p className="text-[11px] font-bold uppercase tracking-wider text-brand-gray-400">Paso 01</p>
                <h3 className="mt-2 text-xl font-extrabold text-brand-gray-900">Elige tu plan</h3>
                <p className="mt-2 text-sm leading-relaxed text-brand-gray-500">
                  Emprendedor, Contador o Despacho. Mensual o anual, en dólares,
                  según cuántas empresas manejas.
                </p>
              </div>
              <div className="relative mt-auto aspect-[4/3] w-full lg:aspect-auto lg:flex-1 lg:min-h-[260px]">
                <Image
                  src="/marketing/process-1.jpg"
                  alt="Dos socios revisando los planes de EXA ATI en una laptop"
                  fill
                  sizes="(max-width: 1024px) 100vw, 33vw"
                  className="object-cover"
                />
              </div>
            </StaggerItem>

            {/* Paso 2 */}
            <StaggerItem as="article" className="rounded-3xl bg-brand-gray-50 p-6 ring-1 ring-brand-gray-200/70">
              <p className="text-[11px] font-bold uppercase tracking-wider text-brand-gray-400">Paso 02</p>
              <h3 className="mt-2 text-xl font-extrabold text-brand-gray-900">Paga y activa</h3>
              <p className="mt-2 text-sm leading-relaxed text-brand-gray-500">
                Checkout seguro con PayPhone. Al aprobarse el cobro, tu panel
                queda activo al instante.
              </p>
              <SyncOrbit />
            </StaggerItem>

            {/* Paso 3 */}
            <StaggerItem as="article" className="flex flex-col overflow-hidden rounded-3xl bg-brand-gray-50 ring-1 ring-brand-gray-200/70">
              <div className="p-6">
                <p className="text-[11px] font-bold uppercase tracking-wider text-brand-gray-400">Paso 03</p>
                <h3 className="mt-2 text-xl font-extrabold text-brand-gray-900">Vincula tu RUC</h3>
                <p className="mt-2 text-sm leading-relaxed text-brand-gray-500">
                  Configura tu empresa, sube tu firma electrónica y sincroniza
                  comprobantes según tu plan.
                </p>
              </div>
              <div className="relative mx-6 mb-6 mt-auto aspect-[16/10] overflow-hidden rounded-2xl">
                <Image
                  src="/marketing/process-3.jpg"
                  alt="Escritorio con laptop mostrando el panel de gestión de EXA ATI"
                  fill
                  sizes="(max-width: 1024px) 100vw, 33vw"
                  className="object-cover"
                />
              </div>
            </StaggerItem>

            {/* Paso 4 — ancho */}
            <StaggerItem as="article" className="relative overflow-hidden rounded-3xl bg-brand-gray-900 p-6 text-white ring-1 ring-brand-gray-800 lg:col-span-2 sm:p-8">
              <div
                className="pointer-events-none absolute inset-0"
                aria-hidden
                style={{
                  background:
                    "radial-gradient(ellipse 60% 70% at 90% 10%, rgba(160,37,37,0.45), transparent 60%)",
                }}
              />
              <div className="relative grid gap-6 sm:grid-cols-2 sm:items-center">
                <div>
                  <p className="text-[11px] font-bold uppercase tracking-wider text-white/45">Paso 04</p>
                  <span className="mt-2 inline-flex items-center gap-1.5 rounded-full bg-success/20 px-2.5 py-1 text-[10px] font-bold text-success-light ring-1 ring-success/30">
                    <Check className="size-3" /> Cumplimiento SRI en cada paso
                  </span>
                  <h3 className="mt-3 text-2xl font-extrabold leading-tight">
                    Emite, cobra y cierra el mes tranquilo
                  </h3>
                  <p className="mt-2 text-sm leading-relaxed text-white/70">
                    Cada factura autorizada, cada cobro registrado y cada anexo
                    listo cuando toca. Tu contador y tú, sobre la misma
                    información.
                  </p>
                  <ul className="mt-4 space-y-2">
                    {CHECKS.map((c) => (
                      <li key={c} className="flex items-start gap-2 text-sm text-white/85">
                        <span className="mt-0.5 flex size-4 shrink-0 items-center justify-center rounded-full bg-success text-white">
                          <Check className="size-2.5" strokeWidth={3} />
                        </span>
                        {c}
                      </li>
                    ))}
                  </ul>
                </div>
                <div className="relative mx-auto w-full max-w-[280px] animate-float-slow">
                  <Image
                    src="/marketing/checklist.png"
                    alt="Checklist de cumplimiento tributario completado"
                    width={560}
                    height={560}
                    sizes="280px"
                    className="w-full drop-shadow-[0_30px_40px_rgba(0,0,0,0.45)]"
                  />
                </div>
              </div>
            </StaggerItem>
          </Stagger>
        </div>
      </div>
    </section>
  );
}
