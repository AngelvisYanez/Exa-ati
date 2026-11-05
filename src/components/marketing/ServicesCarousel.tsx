"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { motion } from "motion/react";
import {
  ArrowRight,
  ArrowLeft,
  ArrowUpRight,
  BookOpenText,
  FileCheck2,
  Landmark,
  Package,
  Sparkles,
  Users,
  Wallet,
} from "lucide-react";
import { Reveal } from "./Reveal";
import { cn } from "@/lib/utils";

type Service = {
  badge: string;
  title: string;
  body: string;
  img: string;
  icon: typeof Landmark;
  href: string;
  plan: string;
};

const SERVICES: Service[] = [
  {
    badge: "Núcleo",
    title: "Emisión electrónica SRI",
    body: "Facturas, retenciones, notas de crédito y débito con firma digital y autorización del SRI.",
    img: "/marketing/service-emision.jpg",
    icon: FileCheck2,
    href: "/registro?plan=emprendedor&periodo=mensual",
    plan: "Todos los planes",
  },
  {
    badge: "Flujo de caja",
    title: "Cobros y cartera",
    body: "Cuentas por cobrar y pagar con vencimientos claros para que el dinero no se te escape.",
    img: "/marketing/service-cobros.jpg",
    icon: Wallet,
    href: "/registro?plan=emprendedor&periodo=mensual",
    plan: "Todos los planes",
  },
  {
    badge: "Cumplimiento",
    title: "Sync SRI, ATS y control tributario",
    body: "Descarga comprobantes recibidos, arma el ATS y controla IVA y retenciones mes a mes.",
    img: "/marketing/service-sri.jpg",
    icon: Landmark,
    href: "/registro?plan=contador&periodo=mensual",
    plan: "Contador y Despacho",
  },
  {
    badge: "Finanzas",
    title: "Contabilidad",
    body: "Plan de cuentas, diario, balances e impuestos conectados a tus comprobantes.",
    img: "/marketing/service-contabilidad.jpg",
    icon: BookOpenText,
    href: "/registro?plan=contador&periodo=mensual",
    plan: "Contador y Despacho",
  },
  {
    badge: "Operación",
    title: "Inventario y punto de venta",
    body: "Stock, productos y ventas en mostrador en el mismo sistema donde facturas.",
    img: "/marketing/service-inventario.jpg",
    icon: Package,
    href: "/registro?plan=emprendedor&periodo=mensual",
    plan: "Todos los planes",
  },
  {
    badge: "Equipo",
    title: "Nómina",
    body: "Roles de pago, empleados y formulario 107 para despachos con equipo a cargo.",
    img: "/marketing/service-nomina.jpg",
    icon: Users,
    href: "/registro?plan=despacho&periodo=mensual",
    plan: "Despacho",
  },
  {
    badge: "IA",
    title: "Asistente tributario IA",
    body: "Pregunta en español sobre IVA, retenciones o plazos y obtén respuestas con tus datos.",
    img: "/marketing/service-ia.jpg",
    icon: Sparkles,
    href: "/registro?plan=emprendedor&periodo=mensual",
    plan: "Todos los planes",
  },
];

export default function ServicesCarousel() {
  const ref = useRef<HTMLUListElement>(null);
  const [canPrev, setCanPrev] = useState(false);
  const [canNext, setCanNext] = useState(true);

  const update = useCallback(() => {
    const el = ref.current;
    if (!el) return;
    setCanPrev(el.scrollLeft > 8);
    setCanNext(el.scrollLeft + el.clientWidth < el.scrollWidth - 8);
  }, []);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    update();
    el.addEventListener("scroll", update, { passive: true });
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => {
      el.removeEventListener("scroll", update);
      ro.disconnect();
    };
  }, [update]);

  const scrollBy = (dir: 1 | -1) => {
    const el = ref.current;
    if (!el) return;
    const card = el.querySelector<HTMLElement>("li");
    const step = card ? card.offsetWidth + 16 : el.clientWidth * 0.8;
    el.scrollBy({ left: dir * step, behavior: "smooth" });
  };

  return (
    <section id="servicios" className="scroll-mt-24 py-12 sm:py-16">
      <div className="mx-auto max-w-7xl px-4 sm:px-6">
        <div className="flex flex-col gap-6 sm:flex-row sm:items-end sm:justify-between">
          <Reveal>
            <p className="inline-flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.16em] text-brand-red">
              <span className="size-1.5 rounded-full bg-brand-red" /> Nuestros módulos
            </p>
            <h2 className="mt-3 text-3xl font-extrabold tracking-tight text-brand-gray-900 sm:text-4xl">
              Todo lo que tu{" "}
              <span className="mk-serif-accent text-brand-red">negocio</span>
              <br className="hidden sm:block" /> necesita
            </h2>
          </Reveal>
          <Reveal delay={0.1} className="flex items-end justify-between gap-6 sm:flex-col sm:items-end">
            <p className="max-w-xs text-sm text-brand-gray-500 sm:text-right">
              Cubrimos el ciclo completo: vender, cobrar, sincronizar y
              declarar — sin saltar entre sistemas.
            </p>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => scrollBy(-1)}
                disabled={!canPrev}
                aria-label="Anterior"
                className="flex size-10 items-center justify-center rounded-full border border-brand-gray-300 text-brand-gray-800 transition-colors hover:border-brand-red hover:text-brand-red disabled:opacity-35 disabled:hover:border-brand-gray-300 disabled:hover:text-brand-gray-800 cursor-pointer disabled:cursor-default"
              >
                <ArrowLeft className="size-4" />
              </button>
              <button
                type="button"
                onClick={() => scrollBy(1)}
                disabled={!canNext}
                aria-label="Siguiente"
                className="flex size-10 items-center justify-center rounded-full bg-brand-gray-900 text-white transition-colors hover:bg-brand-red disabled:opacity-35 disabled:hover:bg-brand-gray-900 cursor-pointer disabled:cursor-default"
              >
                <ArrowRight className="size-4" />
              </button>
            </div>
          </Reveal>
        </div>
      </div>

      <div className="mt-8">
        <ul
          ref={ref}
          className="mk-scrollbar-none flex snap-x snap-mandatory gap-4 overflow-x-auto px-4 pb-4 sm:px-6 [scroll-padding-inline:1rem] sm:[scroll-padding-inline:1.5rem] lg:[scroll-padding-inline:max(1.5rem,calc((100vw-80rem)/2+1.5rem))] lg:[padding-inline:max(1.5rem,calc((100vw-80rem)/2+1.5rem))]"
        >
          {SERVICES.map((s, i) => (
            <li
              key={s.title}
              className="snap-start shrink-0 w-[78vw] max-w-[300px] sm:w-[300px] lg:w-[310px]"
            >
              <motion.article
                initial={{ opacity: 0, y: 24 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, amount: 0.3 }}
                transition={{ duration: 0.55, delay: Math.min(i, 3) * 0.08 }}
                whileHover={{ y: -6 }}
                className="group relative flex h-[420px] flex-col overflow-hidden rounded-[1.5rem] bg-brand-gray-900 text-white shadow-[0_20px_50px_-24px_rgba(26,26,24,0.6)]"
              >
                <div className="relative h-[52%] overflow-hidden">
                  <Image
                    src={s.img}
                    alt={s.title}
                    fill
                    sizes="(max-width: 640px) 80vw, 320px"
                    className="object-cover transition-transform duration-700 ease-out group-hover:scale-105"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-brand-gray-900 via-brand-gray-900/10 to-transparent" />
                  <span className="absolute left-4 top-4 rounded-full bg-white/12 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-white backdrop-blur-sm ring-1 ring-white/20">
                    {s.badge}
                  </span>
                  <span className="absolute right-4 top-4 flex size-9 items-center justify-center rounded-full bg-white text-brand-red shadow-md">
                    <s.icon className="size-4" strokeWidth={2.2} />
                  </span>
                </div>
                <div className="flex flex-1 flex-col p-5">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-white/45">{s.plan}</p>
                  <h3 className="mt-1.5 text-lg font-extrabold leading-tight">{s.title}</h3>
                  <p className="mt-2 text-[13px] leading-relaxed text-white/70">{s.body}</p>
                  <Link
                    href={s.href}
                    className={cn(
                      "mt-auto inline-flex w-fit items-center gap-2 rounded-full bg-white/10 pl-4 pr-1.5 py-1.5 text-[12.5px] font-bold text-white ring-1 ring-white/15 transition-colors hover:bg-brand-red hover:ring-brand-red",
                    )}
                  >
                    Saber más
                    <span className="flex size-6 items-center justify-center rounded-full bg-white text-brand-gray-900 transition-transform duration-300 group-hover:rotate-45">
                      <ArrowUpRight className="size-3.5" strokeWidth={2.5} />
                    </span>
                  </Link>
                </div>
              </motion.article>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
