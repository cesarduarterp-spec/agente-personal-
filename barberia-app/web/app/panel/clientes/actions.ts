"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export type ClienteInput = {
  nombre: string; apellido: string; telefono: string; email: string;
  edad: string; direccion: string; observaciones: string;
};
export type Resultado<T = object> = ({ ok: true } & T) | { ok: false; error: string };

const vacio = (s: string) => (s.trim() === "" ? null : s.trim());

export async function guardarCliente(id: string | null, i: ClienteInput): Promise<Resultado<{ id: string }>> {
  if (!i.nombre.trim()) return { ok: false, error: "El nombre es obligatorio." };
  const edad = i.edad.trim() === "" ? null : Number(i.edad);
  if (edad !== null && !(Number.isInteger(edad) && edad >= 1 && edad <= 120)) return { ok: false, error: "La edad no es válida." };
  const email = vacio(i.email)?.toLowerCase() ?? null;
  if (email && !email.includes("@")) return { ok: false, error: "El mail no es válido." };

  const supabase = await createClient();
  const datos = {
    nombre: i.nombre.trim(), apellido: vacio(i.apellido), telefono: vacio(i.telefono), email,
    edad, direccion: vacio(i.direccion), observaciones: vacio(i.observaciones),
  };

  if (id) {
    const { error } = await supabase.from("clientes").update(datos).eq("id", id);
    if (error) return { ok: false, error: error.code === "23505" ? "Ya hay otra ficha con ese mail." : "No pudimos guardar los cambios." };
    revalidatePath("/panel/clientes");
    return { ok: true, id };
  }

  const { data: barberia } = await supabase.from("barberias").select("id").limit(1).single();
  if (!barberia) return { ok: false, error: "Tu sesión expiró. Ingresá de nuevo." };
  // una ficha cargada a mano por el barbero cuenta como consentida por él (responsable del dato)
  const { data, error } = await supabase
    .from("clientes").insert({ ...datos, barberia_id: barberia.id, consentimiento_at: new Date().toISOString() })
    .select("id").single();
  if (error) return { ok: false, error: error.code === "23505" ? "Ya hay una ficha con ese mail." : "No pudimos crear la ficha." };
  revalidatePath("/panel/clientes");
  return { ok: true, id: data.id };
}

export type CorteInput = { fecha: string; servicio: string; nota: string; precio: string; fotos: string[] };

export async function guardarCorte(clienteId: string, i: CorteInput): Promise<Resultado> {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(i.fecha)) return { ok: false, error: "Elegí la fecha del corte." };
  const precio = i.precio.trim() === "" ? null : Number(i.precio);
  if (precio !== null && !(precio >= 0)) return { ok: false, error: "El precio no es válido." };

  const supabase = await createClient();
  const { data: c } = await supabase.from("clientes").select("barberia_id").eq("id", clienteId).single();
  if (!c) return { ok: false, error: "No encontramos la ficha." };
  // las fotos solo pueden estar en la carpeta de esta ficha
  const prefijo = `${c.barberia_id}/${clienteId}/`;
  if (i.fotos.some((p) => !p.startsWith(prefijo) || p.includes(".."))) return { ok: false, error: "Foto inválida." };

  const { error } = await supabase.from("cortes").insert({
    barberia_id: c.barberia_id, cliente_id: clienteId, fecha: i.fecha,
    servicio: vacio(i.servicio), nota: vacio(i.nota), precio, fotos: i.fotos,
  });
  if (error) return { ok: false, error: "No pudimos guardar el corte." };
  revalidatePath(`/panel/clientes/${clienteId}`);
  return { ok: true };
}

export async function borrarCorte(corteId: string, clienteId: string): Promise<Resultado> {
  const supabase = await createClient();
  const { data: corte } = await supabase.from("cortes").select("fotos").eq("id", corteId).single();
  const { error } = await supabase.from("cortes").delete().eq("id", corteId);
  if (error) return { ok: false, error: "No pudimos borrar el corte." };
  if (corte?.fotos?.length) await supabase.storage.from("cortes").remove(corte.fotos);
  revalidatePath(`/panel/clientes/${clienteId}`);
  return { ok: true };
}
