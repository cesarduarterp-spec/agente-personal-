"use server";

import { createClient } from "@/lib/supabase/server";

export type OnboardingInput = {
  nombre: string;
  slug: string;
  modo: "local" | "domicilio" | "ambos";
  direccion: string;
  lat: number | null;
  lng: number | null;
  place_id: string | null;
  radio_cobertura_km: number | null;
  recargo_traslado: number;
  buffer_traslado_min: number;
  servicios: { nombre: string; precio: number; duracion_min: number }[];
  horarios: { dia_semana: number; desde: string; hasta: string }[];
};

export type OnboardingResult = { ok: true; slug: string } | { ok: false; error: string };

const HORA = /^([01]\d|2[0-3]):[0-5]\d$/;

export async function crearBarberia(input: OnboardingInput): Promise<OnboardingResult> {
  const nombre = input.nombre.trim();
  const slug = input.slug.trim().toLowerCase();
  if (!nombre) return { ok: false, error: "Poné el nombre de tu barbería." };
  if (!/^[a-z0-9][a-z0-9-]{1,38}[a-z0-9]$/.test(slug))
    return { ok: false, error: "El link debe tener 3 a 40 letras minúsculas, números o guiones." };
  if (!["local", "domicilio", "ambos"].includes(input.modo)) return { ok: false, error: "Elegí tu modo de trabajo." };
  const conLocal = input.modo !== "domicilio";
  const conDomicilio = input.modo !== "local";
  if (conLocal && !input.direccion.trim()) return { ok: false, error: "Cargá la dirección de tu local." };
  if (input.servicios.length === 0) return { ok: false, error: "Cargá al menos un servicio." };
  if (input.servicios.some((s) => !s.nombre.trim() || !(s.precio >= 0) || !(s.duracion_min >= 5 && s.duracion_min <= 480)))
    return { ok: false, error: "Revisá los servicios: nombre, precio y duración (5 a 480 min)." };
  if (input.horarios.length === 0) return { ok: false, error: "Elegí al menos un día de atención." };
  if (input.horarios.some((h) => !HORA.test(h.desde) || !HORA.test(h.hasta) || h.hasta <= h.desde || h.dia_semana < 0 || h.dia_semana > 6))
    return { ok: false, error: "Revisá los horarios: la hora de cierre debe ser posterior a la de apertura." };

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Tu sesión expiró. Ingresá de nuevo." };

  const { data: barberia, error } = await supabase
    .from("barberias")
    .insert({
      owner_id: user.id,
      nombre,
      slug,
      modo: input.modo,
      // en modo domicilio es el punto base de la zona de cobertura (no se publica)
      direccion: input.direccion.trim() || null,
      lat: input.lat,
      lng: input.lng,
      place_id: input.place_id,
      radio_cobertura_km: conDomicilio && input.lat != null ? input.radio_cobertura_km : null,
      recargo_traslado: conDomicilio ? Math.max(0, input.recargo_traslado || 0) : 0,
      buffer_traslado_min: conDomicilio ? Math.max(0, Math.round(input.buffer_traslado_min || 0)) : 0,
    })
    .select("id")
    .single();
  if (error) {
    return { ok: false, error: error.code === "23505" ? "Ese link ya está en uso, probá con otro." : "No pudimos crear la barbería." };
  }

  // el trigger de la base crea el primer barbero; los horarios se cargan sobre él
  const { data: barbero } = await supabase.from("barberos").select("id").eq("barberia_id", barberia.id).limit(1).single();
  const r1 = await supabase.from("servicios").insert(
    input.servicios.map((s) => ({ barberia_id: barberia.id, nombre: s.nombre.trim(), precio: s.precio, duracion_min: s.duracion_min })),
  );
  const r2 = barbero
    ? await supabase.from("horarios").insert(input.horarios.map((h) => ({ barbero_id: barbero.id, ...h })))
    : { error: new Error("sin barbero") };
  if (r1.error || r2.error) {
    // deshacer para que el barbero pueda reintentar sin quedar con una barbería a medias
    await supabase.from("barberias").delete().eq("id", barberia.id);
    return { ok: false, error: "No pudimos guardar servicios y horarios. Probá de nuevo." };
  }
  return { ok: true, slug };
}
