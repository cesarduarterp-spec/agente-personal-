"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { enviarMail } from "@/lib/email";
import { fmtFechaHora } from "@/lib/public";

const ESTADOS = ["confirmado", "completado", "ausente", "cancelado"] as const;
type Estado = (typeof ESTADOS)[number];

// El barbero puede cambiar el estado de cualquier turno (sin plazo mínimo, a diferencia del cliente).
export async function cambiarEstadoTurno(id: string, estado: Estado): Promise<{ ok: boolean; error?: string }> {
  if (!ESTADOS.includes(estado)) return { ok: false, error: "Estado inválido." };
  const supabase = await createClient();

  const { data: t } = await supabase
    .from("turnos")
    .select("inicio, estado, barberia_id, clientes(nombre, email)")
    .eq("id", id).maybeSingle();
  if (!t) return { ok: false, error: "No encontramos el turno." };

  const { error } = await supabase.from("turnos").update({ estado }).eq("id", id);
  if (error) {
    // reactivar un turno cancelado puede chocar con otro que ocupó el horario
    return { ok: false, error: error.code === "23P01" ? "Ese horario ya fue ocupado por otro turno." : "No pudimos cambiar el turno." };
  }

  if (estado === "cancelado" && t.estado !== "cancelado") {
    const c = t.clientes as unknown as { nombre: string; email: string | null } | null;
    const { data: b } = await supabase.from("barberias").select("nombre, timezone").eq("id", t.barberia_id).maybeSingle();
    if (c?.email && b) {
      const cuando = fmtFechaHora(t.inicio, b.timezone);
      await enviarMail(
        c.email, `Tu turno fue cancelado: ${cuando}`,
        `<div style="font-family:sans-serif;max-width:480px"><h2>Turno cancelado</h2><p>Hola ${c.nombre.replace(/[<>&]/g, "")}, <b>${b.nombre.replace(/[<>&]/g, "")}</b> canceló tu turno del <b>${cuando}</b>. Disculpá las molestias; podés reservar uno nuevo cuando quieras.</p></div>`,
      ).catch(() => false);
    }
  }
  revalidatePath("/panel");
  return { ok: true };
}
