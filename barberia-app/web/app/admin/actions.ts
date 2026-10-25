"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

type R = { ok: true } | { ok: false; error: string };

// Todas estas llamadas van con la sesión del administrador: la base verifica es_admin() en cada función.
function mensaje(m?: string) {
  if (m?.includes("no_autorizado")) return "No tenés permiso.";
  if (m?.includes("meses_invalidos")) return "Los meses deben ser entre 1 y 24.";
  if (m?.includes("dias_invalidos")) return "Los días deben ser entre 1 y 365.";
  if (m?.includes("barberia_no_existe")) return "No encontramos la barbería.";
  return "No se pudo completar la acción.";
}

export async function registrarPago(barberiaId: string, monto: number, moneda: string, metodo: string, nota: string, meses: number): Promise<R> {
  if (!(monto >= 0) || !["USD", "ARS"].includes(moneda)) return { ok: false, error: "Revisá el monto y la moneda." };
  const { error } = await (await createClient()).rpc("admin_registrar_pago", {
    p_barberia: barberiaId, p_monto: monto, p_moneda: moneda, p_metodo: metodo, p_nota: nota, p_meses: meses,
  });
  if (error) return { ok: false, error: mensaje(error.message) };
  revalidatePath("/admin", "layout");
  return { ok: true };
}

export async function extenderPrueba(barberiaId: string, dias: number): Promise<R> {
  const { error } = await (await createClient()).rpc("admin_extender_prueba", { p_barberia: barberiaId, p_dias: dias });
  if (error) return { ok: false, error: mensaje(error.message) };
  revalidatePath("/admin", "layout");
  return { ok: true };
}

export async function cambiarEstado(barberiaId: string, estado: string, nota: string): Promise<R> {
  const { error } = await (await createClient()).rpc("admin_cambiar_estado", { p_barberia: barberiaId, p_estado: estado, p_nota: nota });
  if (error) return { ok: false, error: mensaje(error.message) };
  revalidatePath("/admin", "layout");
  return { ok: true };
}

export async function guardarConfigCobro(cobroActivo: boolean, diasPrueba: number, diasGracia: number, precio: string, instrucciones: string): Promise<R> {
  if (!Number.isInteger(diasPrueba) || !Number.isInteger(diasGracia)) return { ok: false, error: "Los días deben ser números enteros." };
  const { error } = await (await createClient()).rpc("admin_config", {
    p_cobro_activo: cobroActivo, p_dias_prueba: diasPrueba, p_dias_gracia: diasGracia, p_precio_texto: precio, p_instrucciones: instrucciones,
  });
  if (error) return { ok: false, error: "No se pudo guardar (revisá los valores)." };
  revalidatePath("/admin", "layout");
  return { ok: true };
}
