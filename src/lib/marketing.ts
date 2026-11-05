/** Constantes SEO / GEO Ecuador para marketing EXA ATI. */

export function getSiteUrl(): string {
  const raw =
    process.env.NEXT_PUBLIC_APP_URL ||
    process.env.PAYPHONE_APP_URL ||
    process.env.APP_URL ||
    "https://exa-ati.com";
  return raw.replace(/\/$/, "");
}

export const ECUADOR_CITIES = [
  "Quito",
  "Guayaquil",
  "Cuenca",
  "Ambato",
  "Manta",
  "Santo Domingo",
  "Machala",
  "Loja",
  "Riobamba",
  "Ibarra",
  "Durán",
  "Portoviejo",
] as const;

export const HOME_FAQS: { q: string; a: string }[] = [
  {
    q: "¿EXA ATI sirve para facturación electrónica del SRI en Ecuador?",
    a: "Sí. EXA ATI (OFSERCONT IA) está pensado para emisión y organización de comprobantes electrónicos alineados al SRI, cobros e inventario para emprendedores, y sync, ATS y control tributario para contadores y despachos.",
  },
  {
    q: "¿Puedo usarlo desde Quito, Guayaquil o cualquier ciudad del Ecuador?",
    a: "Sí. Es una plataforma en la nube. Contadores y emprendedores en Quito, Guayaquil, Cuenca y el resto del país pueden operar con la misma suscripción mensual o anual.",
  },
  {
    q: "¿Cómo funciona la suscripción y el pago?",
    a: "Eliges plan Emprendedor, Contador o Despacho (mensual o anual), pagas con PayPhone y al aprobarse el cobro se activa el acceso al panel con los módulos de tu plan.",
  },
  {
    q: "¿Qué diferencia hay entre el plan Emprendedor y Contador?",
    a: "Emprendedor cubre una empresa: emitir, documentos, CxC/CxP e inventario. Contador añade hasta 3 empresas, sync SRI, declaraciones/ATS, control tributario y contabilidad. Despacho amplía a 5 empresas, nómina y administración de equipo.",
  },
  {
    q: "¿Necesito instalar software en mi PC?",
    a: "No. Accedes desde el navegador. Ideal para oficinas y despachos en Ecuador que necesitan operar desde varios dispositivos.",
  },
];

export function buildOrganizationJsonLd(siteUrl: string) {
  return {
    "@context": "https://schema.org",
    "@type": "Organization",
    name: "EXA ATI",
    alternateName: ["OFSERCONT IA", "exa — Asistente Tributario Inteligente"],
    url: siteUrl,
    logo: `${siteUrl}/exa-ati-on-light.png`,
    description:
      "Plataforma de facturación electrónica, cobros, sync SRI y contabilidad para emprendedores y contadores en Ecuador.",
    areaServed: {
      "@type": "Country",
      name: "Ecuador",
    },
    availableLanguage: "es",
  };
}

export function buildSoftwareJsonLd(siteUrl: string) {
  return {
    "@context": "https://schema.org",
    "@type": "SoftwareApplication",
    name: "EXA ATI",
    applicationCategory: "BusinessApplication",
    operatingSystem: "Web",
    offers: {
      "@type": "AggregateOffer",
      priceCurrency: "USD",
      lowPrice: "19",
      highPrice: "490",
      offerCount: 3,
    },
    description:
      "Software de facturación electrónica SRI, cuentas por cobrar, control tributario y contabilidad para Ecuador.",
    url: siteUrl,
    inLanguage: "es-EC",
    audience: {
      "@type": "Audience",
      geographicArea: {
        "@type": "Country",
        name: "Ecuador",
      },
    },
  };
}

export function buildFaqJsonLd(faqs: { q: string; a: string }[]) {
  return {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: faqs.map((f) => ({
      "@type": "Question",
      name: f.q,
      acceptedAnswer: {
        "@type": "Answer",
        text: f.a,
      },
    })),
  };
}
