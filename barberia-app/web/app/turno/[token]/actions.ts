"use server";

import { createPublicClient, mensajeError } from "@/lib/public";

export async function obtenerHorariosTurno(slug: string, barbero: string, servicio: string, fecha: string, modalidad: string) {
  const { data } = await createPublicClient().rpc("disponibilidad", {
    p_slug: slug, p_barbero: barbero, p_servicio: servicio, p_fecha: fecha, p_modalidad: modalidad,
  });
  return (data as string[] | null) ?? [];
}

export async function cancelar(token: string) {
  const { error } = await createPublicClient().rpc("cancelar_turno", { p_token: token });
  return error ? { ok: false as const, error: mensajeError(error.message) } : { ok: true as const };
}

export async function reprogramar(token: string, nuevoInicio: string) {
  const { error } = await createPublicClient().rpc("reprogramar_turno", { p_token: token, p_nuevo_inicio: nuevoInicio });
  return error ? { ok: false as const, error: mensajeError(error.message) } : { ok: true as const };
}
