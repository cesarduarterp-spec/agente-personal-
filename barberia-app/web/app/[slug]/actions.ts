"use server";

import { createAdminClient } from "@/lib/supabase/admin";
import { createPublicClient, mensajeError } from "@/lib/public";
import { enviarConfirmaciones } from "@/lib/email";

export async function obtenerHorarios(slug: string, barbero: string, servicio: string, fecha: string, modalidad: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(fecha)) return [];
  const { data } = await createPublicClient().rpc("disponibilidad", {
    p_slug: slug, p_barbero: barbero, p_servicio: servicio, p_fecha: fecha, p_modalidad: modalidad,
  });
  return (data as string[] | null) ?? [];
}

export type ReservaInput = {
  slug: string; barbero: string; servicio: string; inicio: string; modalidad: "local" | "domicilio";
  nombre: string; apellido: string; telefono: string; email: string;
  direccion: string; lat: number | null; lng: number | null; indicaciones: string;
  consentimiento: boolean; turnstile: string;
};
export type ReservaResult = { ok: true; token: string } | { ok: false; error: string };

async function turnstileValido(token: string) {
  const secret = process.env.TURNSTILE_SECRET_KEY;
  if (!secret) return process.env.NODE_ENV !== "production"; // en producción es obligatorio
  if (!token) return false;
  const r = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", {
    method: "POST",
    body: new URLSearchParams({ secret, response: token }),
  });
  return ((await r.json()) as { success?: boolean }).success === true;
}

export async function reservar(i: ReservaInput): Promise<ReservaResult> {
  if (!(await turnstileValido(i.turnstile))) return { ok: false, error: "No pudimos verificar que sos una persona. Recargá la página." };

  const { data, error } = await createAdminClient().rpc("crear_reserva", {
    p_slug: i.slug, p_barbero: i.barbero, p_servicio: i.servicio, p_inicio: i.inicio, p_modalidad: i.modalidad,
    p_nombre: i.nombre, p_apellido: i.apellido, p_telefono: i.telefono, p_email: i.email,
    p_direccion: i.direccion || null, p_lat: i.lat, p_lng: i.lng,
    p_indicaciones: i.indicaciones || null, p_consentimiento: i.consentimiento,
  });
  if (error || !data) return { ok: false, error: mensajeError(error?.message) };

  const r = data as { gestion_token: string } & Parameters<typeof enviarConfirmaciones>[0];
  // el mail no debe frenar ni romper la reserva ya confirmada
  await enviarConfirmaciones(r).catch((e) => console.error("[mail] confirmación", e));
  return { ok: true, token: r.gestion_token };
}
