import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { origenPublico } from "@/lib/origen";

// Destino de Google OAuth y del link de confirmación por mail.
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const origin = origenPublico(request.headers, request.url);
  const code = searchParams.get("code");
  // solo rutas internas, para evitar open-redirect
  const next = searchParams.get("next");
  const destino = next && next.startsWith("/") && !next.startsWith("//") ? next : "/panel";

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) return NextResponse.redirect(`${origin}${destino}`);
  }
  return NextResponse.redirect(`${origin}/ingresar?error=auth`);
}
