import { cargarPanel } from "@/lib/panel";
import FormBarberia from "./FormBarberia";
import Servicios from "./Servicios";
import Barberos from "./Barberos";

export const dynamic = "force-dynamic";

export default async function Configuracion() {
  const { supabase, barberia } = await cargarPanel();
  const [{ data: b }, { data: servicios }, { data: barberos }] = await Promise.all([
    supabase.from("barberias").select("*").eq("id", barberia.id).single(),
    supabase.from("servicios").select("id, nombre, precio, duracion_min, activo").eq("barberia_id", barberia.id).order("nombre"),
    supabase.from("barberos").select("id, nombre, activo").eq("barberia_id", barberia.id).order("nombre"),
  ]);
  if (!b) return null;
  return (
    <main className="mx-auto flex w-full max-w-xl flex-1 flex-col gap-10 px-4 py-8">
      <h1 className="text-2xl font-semibold">Configuración</h1>
      <FormBarberia b={b} />
      <Servicios barberiaId={barberia.id} servicios={servicios ?? []} />
      <Barberos barberiaId={barberia.id} barberos={barberos ?? []} />
    </main>
  );
}
