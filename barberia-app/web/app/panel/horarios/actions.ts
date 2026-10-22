"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export type Rango = { dia_semana: number; desde: string; hasta: string };
type R<T = object> = ({ ok: true } & T) | { ok: false; error: string };

const HORA = /^([01]\d|2[0-3]):[0-5]\d$/;
const FECHA = /^\d{4}-\d{2}-\d{2}$/;

function mensaje(m?: string) {
  if (m?.includes("horarios_superpuestos")) return "Hay franjas que se superponen en un mismo día.";
  if (m?.includes("rango_invalido")) return "El rango de fechas u horas no es válido.";
  return "No pudimos guardar. Probá de nuevo.";
}

export async function guardarHorarios(barberiaId: string, barberoId: string, pasoMin: number, rangos: Rango[]): Promise<R> {
  if (rangos.some((r) => !HORA.test(r.desde) || !HORA.test(r.hasta) || r.hasta <= r.desde || r.dia_semana < 0 || r.dia_semana > 6))
    return { ok: false, error: "Revisá los horarios: la hora de cierre debe ser posterior a la de apertura." };
  if (![10, 15, 20, 30, 45, 60].includes(pasoMin)) return { ok: false, error: "Intervalo no válido." };

  const supabase = await createClient();
  const { error } = await supabase.rpc("guardar_horarios", { p_barbero: barberoId, p_horarios: rangos });
  if (error) return { ok: false, error: mensaje(error.message) };
  // RLS limita este UPDATE a la barbería del usuario
  const { error: e2 } = await supabase.from("barberias").update({ paso_min: pasoMin }).eq("id", barberiaId);
  if (e2) return { ok: false, error: mensaje(e2.message) };
  revalidatePath("/panel/horarios");
  return { ok: true };
}

export async function bloquear(
  barberoId: string, desde: string, hasta: string, horaDesde: string, horaHasta: string, motivo: string,
): Promise<R<{ conflictos: number }>> {
  if (!FECHA.test(desde) || !FECHA.test(hasta)) return { ok: false, error: "Elegí las fechas." };
  const parcial = horaDesde || horaHasta;
  if (parcial && (!HORA.test(horaDesde) || !HORA.test(horaHasta))) return { ok: false, error: "Completá la hora de inicio y de fin, o dejá ambas vacías para bloquear el día entero." };
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("bloquear_dias", {
    p_barbero: barberoId, p_desde: desde, p_hasta: hasta,
    p_hora_desde: parcial ? horaDesde : null, p_hora_hasta: parcial ? horaHasta : null, p_motivo: motivo.trim() || null,
  });
  if (error) return { ok: false, error: mensaje(error.message) };
  revalidatePath("/panel/horarios");
  return { ok: true, conflictos: (data as number) ?? 0 };
}

export async function quitarBloqueo(id: string): Promise<R> {
  const { error } = await (await createClient()).from("bloqueos").delete().eq("id", id);
  if (error) return { ok: false, error: "No pudimos quitar el bloqueo." };
  revalidatePath("/panel/horarios");
  return { ok: true };
}
