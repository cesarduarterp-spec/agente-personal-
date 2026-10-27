import type { MetadataRoute } from "next";

export default function sitemap(): MetadataRoute.Sitemap {
  const base = (process.env.NEXT_PUBLIC_SITE_URL ?? "").replace(/\/+$/, "");
  if (!base) return [];
  return ["", "/ingresar", "/privacidad", "/terminos"].map((ruta) => ({ url: `${base}${ruta}` }));
}
