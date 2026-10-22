"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

type R<T = object> = ({ ok: true } & T) | { ok: false; error: string };

export type DatosBarberia = {
  nombre: string; modo: "local" | "domicilio" | "ambos";
  direccion: string; lat: number | null; lng: number | null; place_id: string | null;
  radio_cobertura_km: string; recargo_traslado: string; buffer_traslado_min: string;
  horas_min_cancelacion: string; anticipacion_min: string;
  banner_activo: boolean; banner_texto: string;
};

const num = (s: string, d = 0) => (s.trim() === "" ? d : Number(s));

export async function guardarBarberia(id: string, d: DatosBarberia): Promise<R> {
  if (!d.nombre.trim()) return { ok: false, error: "Poné el nombre de la barbería." };
  if (!["local", "domicilio", "ambos"].includes(d.modo)) return { ok: false, error: "Modo de trabajo inválido." };
  if (d.modo !== "domicilio" && !d.direccion.trim()) return { ok: false, error: "Cargá la dirección del local." };
  const radio = d.radio_cobertura_km.trim() === "" ? null : num(d.radio_cobertura_km);
  const recargo = num(d.recargo_traslado), buffer = num(d.buffer_traslado_min);
  const horas = num(d.horas_min_cancelacion, 2), antic = num(d.anticipacion_min, 30);
  if ([recargo, buffer, horas, antic].some((n) => !Number.isFinite(n) || n < 0) || (radio !== null && !(radio >= 0)))
    return { ok: false, error: "Revisá los números: no pueden ser negativos." };
  if (d.banner_activo && !d.banner_texto.trim()) return { ok: false, error: "Escribí el texto del banner o desactivalo." };

  const { error } = await (await createClient()).from("barberias").update({
    nombre: d.nombre.trim(), modo: d.modo,
    direccion: d.direccion.trim() || null, lat: d.lat, lng: d.lng, place_id: d.place_id,
    radio_cobertura_km: d.modo !== "local" && d.lat != null ? radio : null,
    recargo_traslado: d.modo === "local" ? 0 : recargo,
    buffer_traslado_min: d.modo === "local" ? 0 : Math.round(buffer),
    horas_min_cancelacion: Math.round(horas), anticipacion_min: Math.round(antic),
    banner_activo: d.banner_activo, banner_texto: d.banner_texto.trim() || null,
  }).eq("id", id);
  if (error) return { ok: false, error: "No pudimos guardar los cambios." };
  revalidatePath("/panel", "layout");
  return { ok: true };
}

export type DatosServicio = { nombre: string; precio: string; duracion_min: string };

export async function guardarServicio(barberiaId: string, id: string | null, d: DatosServicio): Promise<R> {
  const precio = num(d.precio), dur = num(d.duracion_min);
  if (!d.nombre.trim()) return { ok: false, error: "El servicio necesita un nombre." };
  if (!(precio >= 0)) return { ok: false, error: "El precio no es válido." };
  if (!(Number.isInteger(dur) && dur >= 5 && dur <= 480)) return { ok: false, error: "La duración debe estar entre 5 y 480 minutos." };
  const supabase = await createClient();
  const fila = { nombre: d.nombre.trim(), precio, duracion_min: dur };
  const { error } = id
    ? await supabase.from("servicios").update(fila).eq("id", id)
    : await supabase.from("servicios").insert({ ...fila, barberia_id: barberiaId });
  if (error) return { ok: false, error: "No pudimos guardar el servicio." };
  revalidatePath("/panel/configuracion");
  return { ok: true };
}

export async function alternarServicio(id: string, activo: boolean): Promise<R> {
  const { error } = await (await createClient()).from("servicios").update({ activo }).eq("id", id);
  if (error) return { ok: false, error: "No pudimos cambiar el servicio." };
  revalidatePath("/panel/configuracion");
  return { ok: true };
}

export async function borrarServicio(id: string): Promise<R> {
  const { error } = await (await createClient()).from("servicios").delete().eq("id", id);
  if (error) {
    return { ok: false, error: error.code === "23503" ? "Tiene turnos asociados: desactivalo en lugar de borrarlo." : "No pudimos borrar el servicio." };
  }
  revalidatePath("/panel/configuracion");
  return { ok: true };
}

export async function guardarBarbero(barberiaId: string, id: string | null, nombre: string): Promise<R> {
  if (!nombre.trim()) return { ok: false, error: "El barbero necesita un nombre." };
  const supabase = await createClient();
  const { error } = id
    ? await supabase.from("barberos").update({ nombre: nombre.trim() }).eq("id", id)
    : await supabase.from("barberos").insert({ barberia_id: barberiaId, nombre: nombre.trim() });
  if (error) return { ok: false, error: "No pudimos guardar el barbero." };
  revalidatePath("/panel", "layout");
  return { ok: true };
}

export async function alternarBarbero(barberiaId: string, id: string, activo: boolean): Promise<R> {
  const supabase = await createClient();
  if (!activo) {
    const { count } = await supabase.from("barberos").select("id", { count: "exact", head: true })
      .eq("barberia_id", barberiaId).eq("activo", true).neq("id", id);
    if (!count) return { ok: false, error: "Tiene que quedar al menos un barbero activo." };
  }
  const { error } = await supabase.from("barberos").update({ activo }).eq("id", id);
  if (error) return { ok: false, error: "No pudimos cambiar el barbero." };
  revalidatePath("/panel", "layout");
  return { ok: true };
}
