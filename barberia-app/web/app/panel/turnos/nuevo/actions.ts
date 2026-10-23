"use server";

import { createClient } from "@/lib/supabase/server";
import { mensajeError } from "@/lib/public";
import { enviarConfirmaciones } from "@/lib/email";

export type FichaCorta = { id: string; numero: number; nombre: string; apellido: string | null; telefono: string | null };

export async function buscarFichas(q: string): Promise<FichaCorta[]> {
  const { data } = await (await createClient()).rpc("buscar_clientes", { p_q: q, p_limite: 8 });
  return (data ?? []) as FichaCorta[];
}

export type TurnoManualInput = {
  clienteId: string | null;
  nuevo: { nombre: string; apellido: string; telefono: string; email: string };
  barbero: string; servicio: string; fecha: string; hora: string;
  modalidad: "local" | "domicilio"; direccion: string; lat: number | null; lng: number | null; indicaciones: string;
  avisarPorMail: boolean;
};
export type TurnoManualResult = { ok: true; clienteId: string; mail: "enviado" | "no_enviado" | "sin_mail" } | { ok: false; error: string };

export async function crearTurnoManual(i: TurnoManualInput): Promise<TurnoManualResult> {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(i.fecha) || !/^([01]\d|2[0-3]):[0-5]\d$/.test(i.hora)) return { ok: false, error: "Elegí fecha y hora." };
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Tu sesión expiró. Ingresá de nuevo." };

  let clienteId = i.clienteId;
  if (!clienteId) {
    const n = i.nuevo;
    if (!n.nombre.trim()) return { ok: false, error: "Poné el nombre del cliente." };
    const email = n.email.trim().toLowerCase();
    if (email && !email.includes("@")) return { ok: false, error: "El mail no es válido." };
    const { data: barbero } = await supabase.from("barberos").select("barberia_id").eq("id", i.barbero).maybeSingle();
    if (!barbero) return { ok: false, error: "Elegí el barbero." };
    const { data: c, error } = await supabase.from("clientes").insert({
      barberia_id: barbero.barberia_id, nombre: n.nombre.trim(), apellido: n.apellido.trim() || null,
      telefono: n.telefono.trim() || null, email: email || null, consentimiento_at: new Date().toISOString(),
    }).select("id").single();
    if (error) return { ok: false, error: error.code === "23505" ? "Ya existe una ficha con ese mail: buscala en la lista." : "No pudimos crear la ficha." };
    clienteId = c.id;
  }

  const { data, error } = await supabase.rpc("crear_turno_manual", {
    p_barbero: i.barbero, p_servicio: i.servicio, p_cliente: clienteId, p_fecha: i.fecha, p_hora: i.hora,
    p_modalidad: i.modalidad, p_direccion: i.direccion || null, p_lat: i.lat, p_lng: i.lng, p_indicaciones: i.indicaciones || null,
  });
  if (error || !data) return { ok: false, error: mensajeError(error?.message) };

  const t = data as { turno_id: string; inicio: string; fin: string; precio: number | null; gestion_token: string };
  let mail: "enviado" | "no_enviado" | "sin_mail" = "sin_mail";
  if (i.avisarPorMail) {
    const [{ data: c }, { data: s }, { data: br }] = await Promise.all([
      supabase.from("clientes").select("nombre, apellido, telefono, email").eq("id", clienteId).single(),
      supabase.from("servicios").select("nombre").eq("id", i.servicio).single(),
      supabase.from("barberos").select("nombre, barberia_id").eq("id", i.barbero).single(),
    ]);
    const { data: b } = br ? await supabase.from("barberias").select("nombre, slug, direccion, lat, lng, timezone").eq("id", br.barberia_id).single() : { data: null };
    if (c?.email && s && br && b) {
      mail = "no_enviado";
      try {
        const salio = await enviarConfirmaciones({
          turno_id: t.turno_id, gestion_token: t.gestion_token, inicio: t.inicio, fin: t.fin, modalidad: i.modalidad,
          direccion_turno: i.modalidad === "domicilio" ? i.direccion : null, indicaciones: i.indicaciones || null, precio: t.precio,
          cliente: { nombre: c.nombre, apellido: c.apellido, telefono: c.telefono ?? "", email: c.email },
          servicio: s.nombre, barbero: br.nombre, email_barbero: null,
          barberia: { nombre: b.nombre, direccion: b.direccion, lat: b.lat, lng: b.lng, timezone: b.timezone },
        });
        mail = salio ? "enviado" : "no_enviado";
      } catch { /* el turno ya está creado; se informa que el mail no salió */ }
    }
  }
  return { ok: true, clienteId: clienteId!, mail };
}
