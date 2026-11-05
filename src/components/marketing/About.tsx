import Link from "next/link";
import Image from "next/image";
import { ArrowUpRight, Phone } from "lucide-react";
import { Reveal } from "./Reveal";

export default function About() {
  return (
    <section id="nosotros" className="scroll-mt-24 py-10 sm:py-14">
      <div className="mx-auto max-w-7xl px-4 sm:px-6">
        <div className="grid items-center gap-8 lg:grid-cols-12 lg:gap-12">
          <Reveal className="lg:col-span-5">
            <div className="relative">
              <div className="relative aspect-[4/3] overflow-hidden rounded-[1.75rem] shadow-[0_30px_60px_-30px_rgba(26,26,24,0.4)]">
                <Image
                  src="/marketing/about.jpg"
                  alt="Emprendedora ecuatoriana revisando sus ventas y facturas electrónicas en una tablet"
                  fill
                  sizes="(max-width: 1024px) 100vw, 40vw"
                  className="object-cover"
                />
              </div>
              <div className="absolute -bottom-5 left-5 flex items-center gap-3 rounded-2xl border border-brand-gray-200 bg-white px-4 py-3 shadow-xl">
                <span className="flex -space-x-2">
                  {["QU", "GY", "CU"].map((t) => (
                    <span
                      key={t}
                      className="flex size-8 items-center justify-center rounded-full border-2 border-white bg-brand-red text-[9px] font-extrabold text-white"
                    >
                      {t}
                    </span>
                  ))}
                </span>
                <div className="leading-tight">
                  <p className="text-xs font-extrabold text-brand-gray-900">Todo Ecuador</p>
                  <p className="text-[10px] text-brand-gray-500">Sierra, Costa y Oriente</p>
                </div>
              </div>
            </div>
          </Reveal>

          <div className="lg:col-span-7 pt-6 lg:pt-0">
            <Reveal>
              <p className="inline-flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.16em] text-brand-red">
                <span className="size-1.5 rounded-full bg-brand-red" /> Sobre EXA ATI
              </p>
            </Reveal>
            <Reveal delay={0.08}>
              <h2 className="mt-4 text-2xl leading-snug font-bold tracking-tight text-brand-gray-900 sm:text-[1.9rem] lg:text-[2.1rem]">
                EXA ATI nació con un objetivo simple: darle a emprendedores y
                contadores del Ecuador un sistema en el que{" "}
                <span className="mk-serif-accent text-brand-red">
                  realmente puedan confiar
                </span>
                . Facturar, cobrar y cumplir con el SRI sin hojas de cálculo
                ni software extranjero adaptado a la fuerza.
              </h2>
            </Reveal>
            <Reveal delay={0.16}>
              <p className="mt-5 max-w-xl text-[15px] leading-relaxed text-brand-gray-500">
                OFSERCONT IA une la operación diaria del negocio —emisión,
                inventario, punto de venta, cartera— con el cumplimiento
                tributario ecuatoriano: sync de comprobantes, ATS, control
                tributario y contabilidad. Un panel, en español, para todo el
                ciclo.
              </p>
            </Reveal>
            <Reveal delay={0.24} className="mt-7 flex flex-wrap items-center gap-3">
              <Link
                href="/precios"
                className="group inline-flex h-11 items-center gap-2 rounded-full bg-brand-red pl-5 pr-1.5 text-sm font-bold text-white hover:bg-brand-red-bright transition-colors"
              >
                Ver planes
                <span className="flex size-8 items-center justify-center rounded-full bg-white text-brand-red transition-transform duration-300 group-hover:rotate-45">
                  <ArrowUpRight className="size-4" strokeWidth={2.5} />
                </span>
              </Link>
              <Link
                href="/#contacto"
                className="inline-flex h-11 items-center gap-2 rounded-full px-3 text-sm font-bold text-brand-gray-800 hover:text-brand-red transition-colors"
              >
                <Phone className="size-4" /> Hablar con un asesor
              </Link>
            </Reveal>
          </div>
        </div>
      </div>
    </section>
  );
}
