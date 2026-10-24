// Traduce un aviso (webhook) de Lemon Squeezy a los parámetros de registrar_evento_cobro.
// Los campos usados vienen de la documentación oficial: meta.event_name, meta.custom_data,
// data.id, data.attributes.{status, renews_at, ends_at, updated_at, customer_id, subscription_id, total, currency}.
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export type EventoCobro = {
  p_proveedor: "lemonsqueezy"; p_evento_id: string; p_tipo: string; p_barberia: string | null; p_estado: string | null;
  p_periodo_hasta: string | null; p_cliente_id: string | null; p_suscripcion_id: string | null;
  p_pago_id: string | null; p_monto: number | null; p_moneda: string | null; p_pago_estado: string;
};

type Payload = {
  meta?: { event_name?: string; custom_data?: { barberia_id?: unknown } };
  data?: { id?: string | number; type?: string; attributes?: Record<string, unknown> };
};

const ESTADO_SUSCRIPCION: Record<string, string> = {
  active: "activa", on_trial: "activa", past_due: "activa", // past_due: Lemon Squeezy reintenta el cobro; rige la gracia
  cancelled: "cancelada", expired: "vencida", unpaid: "vencida", paused: "vencida",
};

const fechaIso = (v: unknown) => (typeof v === "string" && !Number.isNaN(Date.parse(v)) ? new Date(v).toISOString() : null);
const texto = (v: unknown) => (v === undefined || v === null || v === "" ? null : String(v));

export function interpretarLemon(ev: Payload, nombreHeader?: string | null): EventoCobro | null {
  const nombre = ev.meta?.event_name ?? nombreHeader ?? "";
  const d = ev.data;
  const a = d?.attributes ?? {};
  if (!d?.id || !nombre.startsWith("subscription_")) return null; // otros eventos (ej. order_created) se ignoran

  const custom = ev.meta?.custom_data?.barberia_id;
  const barberia = typeof custom === "string" && UUID.test(custom) ? custom : null;
  const clave = `${nombre}:${d.type ?? ""}:${d.id}:${texto(a.updated_at) ?? texto(a.created_at) ?? ""}`;

  const esCobro = nombre.startsWith("subscription_payment_");
  if (esCobro) {
    const moneda = texto(a.currency)?.toUpperCase() ?? null;
    const total = Number(a.total); // en centavos
    const monedaValida = moneda === "USD" || moneda === "ARS";
    const pagoEstado = nombre === "subscription_payment_failed" ? "fallido" : nombre === "subscription_payment_refunded" ? "reembolsado" : "pagado";
    return {
      p_proveedor: "lemonsqueezy", p_evento_id: clave, p_tipo: nombre, p_barberia: barberia,
      p_estado: pagoEstado === "pagado" ? "activa" : null,
      p_periodo_hasta: null, p_cliente_id: null, p_suscripcion_id: texto(a.subscription_id),
      p_pago_id: monedaValida && Number.isFinite(total) ? String(d.id) : null,
      p_monto: monedaValida && Number.isFinite(total) ? total / 100 : null, p_moneda: monedaValida ? moneda : null, p_pago_estado: pagoEstado,
    };
  }

  const estado = ESTADO_SUSCRIPCION[String(a.status ?? "")] ?? null;
  const termina = estado === "cancelada" || estado === "vencida";
  return {
    p_proveedor: "lemonsqueezy", p_evento_id: clave, p_tipo: nombre, p_barberia: barberia, p_estado: estado,
    p_periodo_hasta: fechaIso(termina ? (a.ends_at ?? a.renews_at) : (a.renews_at ?? a.ends_at)),
    p_cliente_id: texto(a.customer_id), p_suscripcion_id: String(d.id),
    p_pago_id: null, p_monto: null, p_moneda: null, p_pago_estado: "pagado",
  };
}
