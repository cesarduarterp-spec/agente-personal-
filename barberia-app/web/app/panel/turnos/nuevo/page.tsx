import { cargarPanel } from "@/lib/panel";
import Formulario from "./Formulario";

export const dynamic = "force-dynamic";

export default async function NuevoTurno() {
  const { supabase, barberia } = await cargarPanel();
  const [{ data: barberos }, { data: servicios }, { data: b }] = await Promise.all([
    supabase.from("barberos").select("id, nombre").eq("barberia_id", barberia.id).eq("activo", true).order("nombre"),
    supabase.from("servicios").select("id, nombre, precio, duracion_min").eq("barberia_id", barberia.id).eq("activo", true).order("nombre"),
    supabase.from("barberias").select("modo").eq("id", barberia.id).single(),
  ]);
  const hoy = new Intl.DateTimeFormat("en-CA", { timeZone: barberia.timezone }).format(new Date());
  return (
    <main className="mx-auto w-full max-w-xl flex-1 px-4 py-8">
      <h1 className="text-2xl font-semibold">Cargar un turno</h1>
      <p className="mb-6 mt-1 text-zinc-600 dark:text-zinc-400">Para el cliente que llama o llega sin reservar. Podés agendar fuera de tu horario habitual; solo no se permite superponer otro turno.</p>
      <Formulario barberos={barberos ?? []} servicios={servicios ?? []} modo={(b?.modo ?? "local") as "local" | "domicilio" | "ambos"} hoy={hoy} />
    </main>
  );
}
