"use server";

import { createAdminClient } from "@/lib/supabase/admin";
import { createPublicClient, mensajeError } from "@/lib/public";
import { enviarConfirmaciones } from "@/lib/email";

export async function obtenerHorarios(slug: string, barbero: string, servicio: string, fecha: string, modalidad: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(fecha)) return [];
  try {
    const { data, error } = await createPublicClient().rpc("disponibilidad", {
      p_slug: slug, p_barbero: barbero, p_servicio: servicio, p_fecha: fecha, p_modalidad: modalidad,
    });
    if (error) console.error("[horarios] la base respondió con error:", error.message);
    return (data as string[] | null) ?? [];
  } catch (e) {
    console.error("[horarios] fallo inesperado:", e);
    return [];
  }
}

export type ReservaInput = {
  slug: string; barbero: string; servicio: string; inicio: string; modalidad: "local" | "domicilio";
  nombre: string; apellido: string; telefono: string; email: string;
  direccion: string; lat: number | null; lng: number | null; indicaciones: string;
  consentimiento: boolean; turnstile: string;
};
export type ReservaResult = { ok: true; token: string; mailEnviado: boolean } | { ok: false; error: string };

async function turnstileValido(token: string) {
  const secret = process.env.TURNSTILE_SECRET_KEY;
  if (!secret) return process.env.NODE_ENV !== "production"; // en producción es obligatorio
  if (!token) return false;
  try {
    const r = await fetch(process.env.TURNSTILE_VERIFY_URL ?? "https://challenges.cloudflare.com/turnstile/v0/siteverify", {
      method: "POST",
      body: new URLSearchParams({ secret, response: token }),
    });
    const j = (await r.json()) as { success?: boolean; "error-codes"?: string[] };
    if (j.success !== true) console.error("[reservar] Turnstile rechazó la verificación:", j["error-codes"]?.join(", ") ?? "sin detalle (revisá TURNSTILE_SECRET_KEY y que el widget sea del dominio correcto)");
    return j.success === true;
  } catch (e) {
    console.error("[reservar] no se pudo contactar a Turnstile:", e);
    return false;
  }
}

const ERROR_GENERICO = "No pudimos completar tu reserva por un problema del servidor. Probá de nuevo en un minuto.";

export async function reservar(i: ReservaInput): Promise<ReservaResult> {
  // Ningún fallo debe llegar al cliente como pantalla de error: se registra la causa y se responde con un mensaje claro.
  try {
    if (!(await turnstileValido(i.turnstile))) return { ok: false, error: "No pudimos verificar que sos una persona. Recargá la página." };

    if (!process.env.SUPABASE_SERVICE_ROLE_KEY || !process.env.NEXT_PUBLIC_SUPABASE_URL) {
      console.error("[reservar] FALTA configurar SUPABASE_SERVICE_ROLE_KEY (o la URL de Supabase) en el servidor");
      return { ok: false, error: ERROR_GENERICO };
    }

    const { data, error } = await createAdminClient().rpc("crear_reserva", {
      p_slug: i.slug, p_barbero: i.barbero, p_servicio: i.servicio, p_inicio: i.inicio, p_modalidad: i.modalidad,
      p_nombre: i.nombre, p_apellido: i.apellido, p_telefono: i.telefono, p_email: i.email,
      p_direccion: i.direccion || null, p_lat: i.lat, p_lng: i.lng,
      p_indicaciones: i.indicaciones || null, p_consentimiento: i.consentimiento,
    });
    if (error || !data) {
      const claro = mensajeError(error?.message);
      if (claro.startsWith("Ocurrió un error")) console.error("[reservar] la base respondió con un error no esperado:", error?.code, error?.message, error?.hint);
      return { ok: false, error: claro };
    }

    const r = data as { gestion_token: string } & Parameters<typeof enviarConfirmaciones>[0];
    // el mail no debe frenar ni romper la reserva ya confirmada
    const salio = await enviarConfirmaciones(r).catch((e) => { console.error("[mail] confirmación", e); return false; });
    if (!salio) console.error("[mail] la confirmación NO salió (revisá RESEND_API_KEY, MAIL_FROM y que el dominio esté verificado en Resend)");
    return { ok: true, token: r.gestion_token, mailEnviado: salio };
  } catch (e) {
    console.error("[reservar] fallo inesperado:", e);
    return { ok: false, error: ERROR_GENERICO };
  }
}
