import type { MetadataRoute } from "next";
import { getSiteUrl } from "@/lib/marketing";

/**
 * Marketing indexable; app autenticada noindex.
 */
export default function robots(): MetadataRoute.Robots {
  const base = getSiteUrl();
  return {
    rules: [
      {
        userAgent: "*",
        allow: ["/", "/precios", "/iniciar-sesion", "/registro"],
        disallow: [
          "/panel",
          "/api/",
          "/documentos",
          "/configuracion",
          "/administracion",
          "/suscripcion",
          "/facturacion",
          "/asistente",
          "/movil",
        ],
      },
    ],
    sitemap: `${base}/sitemap.xml`,
  };
}
