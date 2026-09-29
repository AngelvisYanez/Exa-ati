import type { Metadata } from "next";
import Link from "next/link";
import { ArrowUpRight, Mail, MapPin, Phone } from "lucide-react";
import BrandLogo from "@/components/brand/BrandLogo";
import MarketingHeader from "@/components/marketing/MarketingHeader";
import { getSiteUrl } from "@/lib/marketing";

const siteUrl = getSiteUrl();

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    default:
      "EXA ATI | Facturación electrónica SRI y contabilidad en Ecuador",
    template: "%s | EXA ATI",
  },
  description:
    "Software para facturar, cobrar y cumplir con el SRI en Ecuador. Emprendedores y contadores en Quito, Guayaquil, Cuenca y todo el país.",
  robots: { index: true, follow: true },
  openGraph: {
    type: "website",
    locale: "es_EC",
    url: siteUrl,
    siteName: "EXA ATI",
    title: "EXA ATI — Facturación SRI y operación en Ecuador",
    description:
      "Emite, cobra y cumple. Planes para emprendedores y contadores en Ecuador.",
    images: [
      { url: "/marketing/hero-bg.jpg", width: 1024, height: 576, alt: "EXA ATI" },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "EXA ATI — Asistente Tributario Inteligente Ecuador",
    description:
      "Facturación electrónica, CxC, sync SRI y contabilidad. Hecho para Ecuador.",
  },
  alternates: { canonical: siteUrl },
  keywords: [
    "facturación electrónica Ecuador",
    "software SRI Ecuador",
    "ATS Ecuador",
    "facturación Quito",
    "facturación Guayaquil",
    "software contable Ecuador",
    "comprobantes electrónicos SRI",
    "EXA ATI",
    "OFSERCONT IA",
  ],
};

const FOOTER_COLS = [
  {
    title: "Producto",
    links: [
      { href: "/#servicios", label: "Módulos" },
      { href: "/#proceso", label: "Cómo funciona" },
      { href: "/precios", label: "Precios y planes" },
      { href: "/#faq", label: "Preguntas frecuentes" },
    ],
  },
  {
    title: "Cuenta",
    links: [
      { href: "/registro", label: "Crear cuenta" },
      { href: "/iniciar-sesion", label: "Iniciar sesión" },
      { href: "/#contacto", label: "Solicitar demo" },
    ],
  },
];

export default function MarketingLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen flex flex-col bg-brand-gray-50 text-brand-gray-800">
      <MarketingHeader />
      <div className="flex-1">{children}</div>

      <footer className="relative overflow-hidden bg-brand-gray-900 text-white">
        <div
          className="pointer-events-none absolute inset-0"
          aria-hidden
          style={{
            background:
              "radial-gradient(ellipse 60% 50% at 100% 0%, rgba(160,37,37,0.35), transparent 60%)",
          }}
        />
        <div className="relative mx-auto max-w-7xl px-4 sm:px-6 pt-14 pb-8">
          <div className="grid gap-10 lg:grid-cols-12">
            <div className="lg:col-span-5">
              <Link href="/" className="inline-flex" aria-label="EXA ATI — inicio">
                <BrandLogo variant="onDark" className="h-10 sm:h-11 w-auto" />
              </Link>
              <p className="mt-5 max-w-sm text-sm leading-relaxed text-white/65">
                OFSERCONT IA — facturación electrónica, cobros, sync SRI,
                control tributario y contabilidad para emprendedores y
                contadores en Ecuador. 100% en la nube, en español.
              </p>
              <ul className="mt-6 space-y-2.5 text-sm text-white/75">
                <li className="flex items-center gap-2.5">
                  <MapPin className="size-4 text-brand-red-bright" />
                  Quito · Guayaquil · Cuenca · todo Ecuador
                </li>
                <li className="flex items-center gap-2.5">
                  <Phone className="size-4 text-brand-red-bright" />
                  Atención en horario laboral Ecuador
                </li>
                <li className="flex items-center gap-2.5">
                  <Mail className="size-4 text-brand-red-bright" />
                  <Link href="/#contacto" className="hover:text-white">
                    Escríbenos desde el formulario de contacto
                  </Link>
                </li>
              </ul>
            </div>

            {FOOTER_COLS.map((col) => (
              <div key={col.title} className="lg:col-span-2">
                <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-white/40">
                  {col.title}
                </p>
                <ul className="mt-4 space-y-2.5 text-sm font-semibold text-white/75">
                  {col.links.map((l) => (
                    <li key={l.href}>
                      <Link
                        href={l.href}
                        className="inline-flex items-center gap-1 hover:text-white transition-colors"
                      >
                        {l.label}
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            ))}

            <div className="lg:col-span-3">
              <div className="rounded-3xl border border-white/10 bg-white/5 p-5">
                <p className="text-sm font-bold">¿Listo para empezar?</p>
                <p className="mt-1 text-xs leading-relaxed text-white/60">
                  Planes desde $19/mes. Activa tu panel al aprobarse el pago
                  con PayPhone.
                </p>
                <Link
                  href="/registro"
                  className="group mt-4 inline-flex h-10 items-center gap-2 rounded-full bg-brand-red pl-4 pr-1.5 text-sm font-bold text-white hover:bg-brand-red-bright transition-colors"
                >
                  Crear cuenta
                  <span className="flex size-7 items-center justify-center rounded-full bg-white text-brand-red transition-transform duration-300 group-hover:rotate-45">
                    <ArrowUpRight className="size-4" strokeWidth={2.5} />
                  </span>
                </Link>
              </div>
            </div>
          </div>

          <div className="mt-12 flex flex-col gap-3 border-t border-white/10 pt-6 text-[11px] text-white/45 sm:flex-row sm:items-center sm:justify-between">
            <p>© {new Date().getFullYear()} EXA ATI / OFSERCONT IA. Ecuador.</p>
            <p>Plataforma en la nube · Facturación electrónica alineada al SRI</p>
          </div>
        </div>
      </footer>
    </div>
  );
}
