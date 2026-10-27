import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import type { Usuario } from "@/lib/admin";

export const dynamic = "force-dynamic";

// Evita que Excel interprete una celda como fórmula si empieza con = + - @
const celda = (v: unknown) => {
  const t = v === null || v === undefined ? "" : String(v);
  return `"${(/^[=+\-@\t\r]/.test(t) ? `'${t}` : t).replace(/"/g, '""')}"`;
};

// Planilla de usuarios (respeta búsqueda y filtro). Solo administradores: para el resto, 404.
export async function GET(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return new NextResponse(null, { status: 404 });
  const { data: esAdmin } = await supabase.rpc("es_admin");
  if (!esAdmin) return new NextResponse(null, { status: 404 });

  const q = request.nextUrl.searchParams.get("q") ?? "";
  const f = request.nextUrl.searchParams.get("f") ?? "";
  const { data, error } = await supabase.rpc("admin_usuarios", { p_q: q, p_filtro: f || null, p_limite: 1000 });
  if (error) return new NextResponse("Error al exportar", { status: 500 });

  const dia = (iso: string | null) => (iso ? iso.slice(0, 10) : "");
  const filas = ((data ?? []) as Usuario[]).map((u) => [
    u.email, u.nombre ?? "", u.slug ?? "", u.estado ?? "sin_barberia", dia(u.creado), dia(u.ultimo_ingreso),
    dia(u.prueba_hasta), dia(u.periodo_hasta), u.turnos_30d, u.clientes, u.confirmado ? "sí" : "no",
  ]);
  const cabecera = ["mail", "barbería", "link", "estado", "registrado", "último ingreso", "prueba hasta", "pago hasta", "turnos 30 días", "clientes", "mail confirmado"];
  const csv = "﻿" + [cabecera, ...filas].map((r) => r.map(celda).join(",")).join("\r\n");

  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="usuarios-${new Date().toISOString().slice(0, 10)}.csv"`,
      "Cache-Control": "no-store",
    },
  });
}
