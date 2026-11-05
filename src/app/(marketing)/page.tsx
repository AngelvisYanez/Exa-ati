import type { Metadata } from "next";
import Hero from "@/components/marketing/Hero";
import LogoStrip from "@/components/marketing/LogoStrip";
import About from "@/components/marketing/About";
import ServicesCarousel from "@/components/marketing/ServicesCarousel";
import ProcessSteps from "@/components/marketing/ProcessSteps";
import Audiences from "@/components/marketing/Audiences";
import Stats from "@/components/marketing/Stats";
import Testimonials from "@/components/marketing/Testimonials";
import PricingTeaser from "@/components/marketing/PricingTeaser";
import Faq from "@/components/marketing/Faq";
import FinalCta from "@/components/marketing/FinalCta";
import {
  HOME_FAQS,
  buildFaqJsonLd,
  buildOrganizationJsonLd,
  buildSoftwareJsonLd,
  getSiteUrl,
} from "@/lib/marketing";

const siteUrl = getSiteUrl();

export const metadata: Metadata = {
  title:
    "Facturación electrónica SRI Ecuador | Software para emprendedores y contadores",
  description:
    "EXA ATI: emite facturas electrónicas, gestiona cobros, sync SRI, ATS y contabilidad. Ideal para negocios y despachos en Quito, Guayaquil, Cuenca y todo Ecuador. Planes desde $19/mes.",
  alternates: { canonical: siteUrl },
  openGraph: {
    title: "EXA ATI — Facturación electrónica y SRI en Ecuador",
    description:
      "Opera tu negocio y cumple con el SRI. Emprendedores y contadores en Ecuador.",
    url: siteUrl,
    locale: "es_EC",
  },
};

export default function HomePage() {
  const jsonLd = [
    buildOrganizationJsonLd(siteUrl),
    buildSoftwareJsonLd(siteUrl),
    buildFaqJsonLd(HOME_FAQS),
  ];

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />

      <main id="main-content" className="overflow-x-clip">
        <Hero />
        <LogoStrip />
        <About />
        <ServicesCarousel />
        <ProcessSteps />
        <Audiences />
        <Stats />
        <Testimonials />
        <PricingTeaser />
        <Faq items={HOME_FAQS} />
        <FinalCta />
      </main>
    </>
  );
}
