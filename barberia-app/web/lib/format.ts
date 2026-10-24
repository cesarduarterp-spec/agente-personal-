const pesos = new Intl.NumberFormat("es-AR", { style: "currency", currency: "ARS", maximumFractionDigits: 0 });

// 10000 -> "$ 10.000"
export const peso = (n: number | null | undefined) => (n == null ? "" : pesos.format(n).replace(/ /g, " "));

// { USD: 30, ARS: 20000 } -> "USD 30 · $ 20.000"
export function dinero(totales: Record<string, number> | null | undefined) {
  const e = Object.entries(totales ?? {}).filter(([, v]) => Number(v) !== 0);
  if (e.length === 0) return "—";
  return e.map(([m, v]) => (m === "ARS" ? peso(Number(v)) : `${m} ${new Intl.NumberFormat("es-AR", { maximumFractionDigits: 2 }).format(Number(v))}`)).join(" · ");
}

const TZ = "America/Argentina/Buenos_Aires";
export const fecha = (iso: string | null | undefined) =>
  iso ? new Intl.DateTimeFormat("es-AR", { dateStyle: "medium", timeZone: TZ }).format(new Date(iso)) : "—";
export const fechaHora = (iso: string | null | undefined) =>
  iso ? new Intl.DateTimeFormat("es-AR", { dateStyle: "medium", timeStyle: "short", timeZone: TZ }).format(new Date(iso)) : "—";
