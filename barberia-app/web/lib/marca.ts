export const COLOR_BASE = "#111827";

// Color de texto legible (blanco o casi negro) sobre el color de marca elegido.
export function textoSobre(hex: string) {
  const n = parseInt(hex.replace("#", ""), 16);
  const lin = (c: number) => {
    const s = c / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  };
  const l = 0.2126 * lin((n >> 16) & 255) + 0.7152 * lin((n >> 8) & 255) + 0.0722 * lin(n & 255);
  return l > 0.4 ? "#111111" : "#ffffff";
}

export const urlLogo = (path?: string | null) =>
  path ? `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/marcas/${path}` : null;

const destino = (dir: string | null, lat?: number | null, lng?: number | null) =>
  encodeURIComponent(lat != null && lng != null ? `${lat},${lng}` : (dir ?? ""));

// Abre el punto en Google Maps
export const mapaUrl = (dir: string | null, lat?: number | null, lng?: number | null) =>
  `https://www.google.com/maps/search/?api=1&query=${destino(dir, lat, lng)}`;

// Abre la navegación hacia el punto ("Cómo llegar")
export const rutaUrl = (dir: string | null, lat?: number | null, lng?: number | null) =>
  `https://www.google.com/maps/dir/?api=1&destination=${destino(dir, lat, lng)}`;
