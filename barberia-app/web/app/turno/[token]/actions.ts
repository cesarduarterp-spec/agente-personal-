"use server";

import { createPublicClient, mensajeError } from "@/lib/public";

export async function obtenerHorariosTurno(slug: string, barbero: string, servicio: string, fecha: string, modalidad: string) {
  try {
    const { data } = await createPublicClient().rpc("disponibilidad", {
      p_slug: slug, p_barbero: barbero, p_servicio: servicio, p_fecha: fecha, p_modalidad: modalidad,
    });
    return (data as string[] | null) ?? [];
  } catch (e) {
    console.error("[turno] horarios:", e);
    return [];
  }
}

const FALLO = { ok: false as const, error: "No pudimos completar la acción. Probá de nuevo en un minuto." };

export async function cancelar(token: string) {
  try {
    const { error } = await createPublicClient().rpc("cancelar_turno", { p_token: token });
    return error ? { ok: false as const, error: mensajeError(error.message) } : { ok: true as const };
  } catch (e) {
    console.error("[turno] cancelar:", e);
    return FALLO;
  }
}

export async function reprogramar(token: string, nuevoInicio: string) {
  try {
    const { error } = await createPublicClient().rpc("reprogramar_turno", { p_token: token, p_nuevo_inicio: nuevoInicio });
    return error ? { ok: false as const, error: mensajeError(error.message) } : { ok: true as const };
  } catch (e) {
    console.error("[turno] reprogramar:", e);
    return FALLO;
  }
}
