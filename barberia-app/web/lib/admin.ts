import "server-only";
import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

// Solo administradores. Para el resto la página "no existe" (404). El permiso real lo vuelve a
// verificar la base de datos dentro de cada función admin_*; esto es solo la puerta de entrada.
export async function cargarAdmin() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/ingresar");
  const { data: esAdmin } = await supabase.rpc("es_admin");
  if (!esAdmin) notFound();
  return { supabase, user };
}

export type Usuario = {
  user_id: string; email: string; creado: string; ultimo_ingreso: string | null; confirmado: boolean;
  barberia_id: string | null; nombre: string | null; slug: string | null; modo: string | null;
  estado: string | null; prueba_hasta: string | null; periodo_hasta: string | null; proveedor: string | null; notas: string | null;
  habilitada: boolean | null; turnos_30d: number; clientes: number; pagado: Record<string, number>;
};
export type PagoFila = {
  id: string; fecha: string; barberia_id: string; barberia: string; email: string; monto: number; moneda: string;
  estado: string; proveedor: string; metodo: string | null; nota: string | null; periodo_hasta: string | null;
};

export const ETIQUETA: Record<string, string> = { prueba: "En prueba", activa: "Pagando", vencida: "Vencida", suspendida: "Suspendida", cancelada: "Cancelada", sin_barberia: "Sin barbería" };
