import Link from "next/link";
import { ArrowUpRight, Clock, MessageCircle, ShieldCheck } from "lucide-react";
import LeadForm from "./LeadForm";
import { Reveal } from "./Reveal";

const POINTS = [
  { icon: MessageCircle, t: "Demo orientada a tu caso SRI" },
  { icon: Clock, t: "Respuesta en horario laboral Ecuador" },
  { icon: ShieldCheck, t: "Sin compromiso de compra" },
];

export default function FinalCta() {
  return (
    <section id="contacto" className="scroll-mt-24 px-3 sm:px-5 pb-6 pt-8 sm:pt-12">
      <div className="mx-auto max-w-7xl">
        <div className="relative isolate overflow-hidden rounded-[1.75rem] sm:rounded-[2.25rem] bg-brand-red text-white">
          <div
            className="pointer-events-none absolute inset-0"
            aria-hidden
            style={{
              background:
                "radial-gradient(ellipse 60% 80% at 0% 100%, rgba(255,255,255,0.18), transparent 60%), radial-gradient(ellipse 50% 60% at 100% 0%, rgba(26,26,24,0.35), transparent 60%)",
            }}
          />
          <div
            className="pointer-events-none absolute -right-20 -top-20 size-[26rem] rounded-full blur-3xl animate-blob"
            aria-hidden
            style={{ background: "radial-gradient(circle, rgba(255,255,255,0.18), transparent 65%)" }}
          />

          <div className="relative grid gap-10 px-5 py-10 sm:px-8 sm:py-14 lg:grid-cols-12 lg:gap-12 lg:px-12 lg:py-16">
            <div className="lg:col-span-6 flex flex-col justify-center">
              <Reveal>
                <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-white/70">
                  Hablemos
                </p>
                <h2 className="mt-3 text-3xl font-extrabold leading-tight tracking-tight sm:text-4xl lg:text-[2.75rem]">
                  ¿Listo para operar con claridad{" "}
                  <span className="mk-serif-accent text-white/90">en Ecuador?</span>
                </h2>
                <p className="mt-4 max-w-md text-[15px] leading-relaxed text-white/80">
                  Déjanos tus datos y te orientamos sobre el plan ideal —
                  Emprendedor, Contador o Despacho — según tu ciudad y tipo de
                  negocio. O crea tu cuenta y paga cuando quieras.
                </p>
              </Reveal>
              <Reveal delay={0.1}>
                <ul className="mt-7 space-y-3">
                  {POINTS.map((p) => (
                    <li key={p.t} className="flex items-center gap-3 text-sm font-semibold">
                      <span className="flex size-9 items-center justify-center rounded-full bg-white/15 ring-1 ring-white/20">
                        <p.icon className="size-4" />
                      </span>
                      {p.t}
                    </li>
                  ))}
                </ul>
              </Reveal>
              <Reveal delay={0.2}>
                <Link
                  href="/registro"
                  className="group mt-8 inline-flex h-12 items-center gap-2 rounded-full bg-white pl-5 pr-1.5 text-sm font-bold text-brand-red hover:bg-brand-gray-50 transition-colors"
                >
                  Prefiero registrarme ahora
                  <span className="flex size-9 items-center justify-center rounded-full bg-brand-red text-white transition-transform duration-300 group-hover:rotate-45">
                    <ArrowUpRight className="size-4" strokeWidth={2.5} />
                  </span>
                </Link>
              </Reveal>
            </div>

            <Reveal delay={0.15} className="lg:col-span-6">
              <div className="rounded-[1.5rem] bg-white p-6 text-brand-gray-900 shadow-2xl sm:p-8">
                <h3 className="text-lg font-extrabold">Solicitar contacto</h3>
                <p className="mt-1 text-xs text-brand-gray-500">
                  Te respondemos en horario laboral de Ecuador.
                </p>
                <div className="mt-5">
                  <LeadForm fuente="homepage" />
                </div>
              </div>
            </Reveal>
          </div>
        </div>
      </div>
    </section>
  );
}
