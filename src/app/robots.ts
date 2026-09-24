import type { MetadataRoute } from "next";

/**
 * App is mostly authenticated — disallow indexing of private surfaces.
 * Public auth pages remain crawlable for brand discovery.
 */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: ["/login", "/register"],
        disallow: ["/", "/api/", "/documentos", "/configuracion", "/admin"],
      },
    ],
  };
}
