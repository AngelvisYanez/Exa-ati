import type { Metadata } from "next";
import { getSiteUrl } from "@/lib/marketing";

const siteUrl = getSiteUrl();

export const metadata: Metadata = {
  title: "Precios y planes de suscripción | Facturación SRI Ecuador",
  description:
    "Planes Emprendedor, Contador y Despacho. Suscripción mensual o anual en USD con PayPhone. Software de facturación electrónica y SRI para Ecuador.",
  alternates: { canonical: `${siteUrl}/precios` },
  openGraph: {
    title: "Precios EXA ATI — Planes para Ecuador",
    description:
      "Desde $19/mes. Emprendedor, Contador y Despacho. Pago con PayPhone.",
    url: `${siteUrl}/precios`,
    locale: "es_EC",
  },
};

export default function PreciosLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
