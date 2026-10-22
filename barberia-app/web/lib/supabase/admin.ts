import "server-only";
import { createClient } from "@supabase/supabase-js";

// Cliente con service_role: SOLO en el servidor (server actions / route handlers).
// La clave nunca lleva el prefijo NEXT_PUBLIC_.
export function createAdminClient() {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
