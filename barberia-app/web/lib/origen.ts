// Dirección pública de la app. Detrás del proxy de Coolify, request.url trae la dirección
// interna del contenedor (0.0.0.0:3000), así que se usa NEXT_PUBLIC_SITE_URL o, si no está,
// los encabezados que agrega el proxy.
export function origenPublico(headers: Headers, urlSolicitud: string) {
  const sitio = process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/+$/, "");
  if (sitio) return sitio;
  const host = headers.get("x-forwarded-host") ?? headers.get("host");
  if (host) return `${headers.get("x-forwarded-proto") ?? "https"}://${host}`;
  return new URL(urlSolicitud).origin;
}
