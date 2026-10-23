import { timingSafeEqual } from "node:crypto";
import { NextResponse, type NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { enviarRecordatorio, type Recordatorio } from "@/lib/email";

export const dynamic = "force-dynamic";

function autorizado(request: NextRequest) {
  const secreto = process.env.CRON_SECRET;
  if (!secreto) return null; // sin configurar: el endpoint queda deshabilitado
  const dado = request.headers.get("authorization") ?? "";
  const esperado = `Bearer ${secreto}`;
  const a = Buffer.from(dado), b = Buffer.from(esperado);
  return a.length === b.length && timingSafeEqual(a, b);
}

// Lo llama n8n cada ~10 minutos. La base reclama los turnos de forma atómica, así que
// ejecuciones superpuestas nunca envían el mismo recordatorio dos veces.
export async function POST(request: NextRequest) {
  const ok = autorizado(request);
  if (ok === null) return NextResponse.json({ error: "CRON_SECRET no configurada" }, { status: 503 });
  if (!ok) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const supabase = createAdminClient();
  const resumen = { "24h": { enviados: 0, fallidos: 0 }, "2h": { enviados: 0, fallidos: 0 } };

  for (const tipo of ["24h", "2h"] as const) {
    const { data, error } = await supabase.rpc("reclamar_recordatorios", { p_tipo: tipo, p_limite: 50 });
    if (error) {
      console.error("[recordatorios] reclamar", tipo, error.message);
      return NextResponse.json({ error: "Error al reclamar recordatorios", resumen }, { status: 500 });
    }
    for (const item of (data ?? []) as Recordatorio[]) {
      let enviado = false;
      try { enviado = await enviarRecordatorio(item); } catch (e) { console.error("[recordatorios] envío", e); }
      if (enviado) resumen[tipo].enviados++;
      else {
        resumen[tipo].fallidos++;
        // se libera para reintentar en la próxima corrida
        await supabase.rpc("liberar_recordatorio", { p_turno: item.turno_id, p_tipo: tipo });
      }
    }
  }
  return NextResponse.json({ ok: true, resumen });
}
