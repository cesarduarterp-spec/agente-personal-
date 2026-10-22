import { cargarPanel, ventana } from "@/lib/panel";
import Editor from "./Editor";

export const dynamic = "force-dynamic";

export default async function Horarios() {
  const { supabase, barberia } = await cargarPanel();
  const { data: barberos } = await supabase.from("barberos").select("id, nombre").eq("barberia_id", barberia.id).eq("activo", true).order("nombre");
  const ids = (barberos ?? []).map((b) => b.id);
  const [{ data: horarios }, { data: bloqueos }, { data: aperturas }] = await Promise.all([
    supabase.from("horarios").select("barbero_id, dia_semana, desde, hasta").in("barbero_id", ids).order("desde"),
    supabase.from("bloqueos").select("id, barbero_id, inicio, fin, motivo").in("barbero_id", ids).gte("fin", ventana(0).desde).order("inicio"),
    supabase.from("aperturas").select("id, barbero_id, inicio, fin, motivo").in("barbero_id", ids).gte("fin", ventana(0).desde).order("inicio"),
  ]);
  return (
    <main className="mx-auto w-full max-w-xl flex-1 px-4 py-8">
      <h1 className="text-2xl font-semibold">Horarios</h1>
      <p className="mb-6 mt-1 text-zinc-600 dark:text-zinc-400">Elegí qué días y en qué horarios atendés. Los clientes solo pueden reservar dentro de estas franjas.</p>
      <Editor
        barberiaId={barberia.id}
        timezone={barberia.timezone}
        pasoMin={barberia.paso_min}
        barberos={barberos ?? []}
        horarios={(horarios ?? []).map((h) => ({ ...h, desde: h.desde.slice(0, 5), hasta: h.hasta.slice(0, 5) }))}
        bloqueos={bloqueos ?? []}
        aperturas={aperturas ?? []}
      />
    </main>
  );
}
