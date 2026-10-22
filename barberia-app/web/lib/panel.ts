import "server-only";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export type BarberiaPanel = {
  id: string; nombre: string; slug: string; modo: string; timezone: string; paso_min: number;
};

// Sesión + barbería del usuario (o redirige a ingresar / onboarding).
export async function cargarPanel() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/ingresar");
  const { data: barberia } = await supabase
    .from("barberias").select("id, nombre, slug, modo, timezone, paso_min").limit(1).maybeSingle();
  if (!barberia) redirect("/panel/onboarding");
  return { supabase, user, barberia: barberia as BarberiaPanel };
}

export function ventana(dias: number) {
  const ahora = Date.now();
  return { desde: new Date(ahora).toISOString(), hasta: new Date(ahora + dias * 864e5).toISOString() };
}
