import { createHmac, timingSafeEqual } from "node:crypto";
import { NextResponse, type NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { interpretarLemon } from "@/lib/cobros";

export const dynamic = "force-dynamic";

function firmaValida(cuerpo: string, firma: string, secreto: string) {
  const esperada = Buffer.from(createHmac("sha256", secreto).update(cuerpo).digest("hex"));
  const recibida = Buffer.from(firma.trim().toLowerCase());
  return recibida.length === esperada.length && timingSafeEqual(recibida, esperada);
}

// Avisos de Lemon Squeezy. Se verifica la firma sobre el cuerpo tal cual llegó, ANTES de leerlo como JSON.
export async function POST(request: NextRequest) {
  const secreto = process.env.LEMONSQUEEZY_WEBHOOK_SECRET;
  if (!secreto) return NextResponse.json({ error: "no configurado" }, { status: 503 });

  const cuerpo = await request.text();
  if (!firmaValida(cuerpo, request.headers.get("x-signature") ?? "", secreto)) {
    return NextResponse.json({ error: "firma inválida" }, { status: 401 });
  }

  let evento;
  try { evento = JSON.parse(cuerpo); } catch { return NextResponse.json({ error: "json inválido" }, { status: 400 }); }

  const params = interpretarLemon(evento, request.headers.get("x-event-name"));
  if (!params) return NextResponse.json({ ok: true, ignorado: true });

  const { data, error } = await createAdminClient().rpc("registrar_evento_cobro", params);
  if (error) {
    if (error.message.includes("barberia_no_existe")) {
      // puede ser un cobro que llegó antes que el aviso de alta de la suscripción: se responde con error
      // para que el proveedor reintente (la base deshace todo, así que el reintento se procesa normalmente).
      // Un aviso realmente huérfano agota sus reintentos, sin consecuencias.
      console.error("[cobros] aviso sin barbería asociada (se reintentará):", params.p_tipo, params.p_suscripcion_id);
      return NextResponse.json({ error: "barbería aún no asociada" }, { status: 503 });
    }
    console.error("[cobros] error al registrar:", error.message);
    return NextResponse.json({ error: "error interno" }, { status: 500 }); // el proveedor reintenta
  }
  return NextResponse.json(data ?? { ok: true });
}
