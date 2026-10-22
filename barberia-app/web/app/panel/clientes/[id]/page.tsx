import Link from "next/link";
import { notFound } from "next/navigation";
import { cargarPanel } from "@/lib/panel";
import FichaForm from "../FichaForm";
import CorteForm from "../CorteForm";
import BorrarCorte from "../BorrarCorte";

export const dynamic = "force-dynamic";

type Corte = { id: string; fecha: string; servicio: string | null; nota: string | null; precio: number | null; fotos: string[] };
type TurnoFila = { id: string; inicio: string; estado: string; modalidad: string; precio: number | null; servicios: { nombre: string } | null };

export default async function Ficha({ params, searchParams }: PageProps<"/panel/clientes/[id]">) {
  const { id } = await params;
  const turnoParam = String((await searchParams).turno ?? "");
  const { supabase, barberia } = await cargarPanel();

  const { data: c } = await supabase.from("clientes").select("*").eq("id", id).maybeSingle();
  if (!c) notFound();

  const [{ data: cortesData }, { data: turnosData }, { data: servs }] = await Promise.all([
    supabase.from("cortes").select("id, fecha, servicio, nota, precio, fotos").eq("cliente_id", id).order("fecha", { ascending: false }).order("created_at", { ascending: false }),
    supabase.from("turnos").select("id, inicio, estado, modalidad, precio, servicios(nombre)").eq("cliente_id", id).order("inicio", { ascending: false }).limit(15),
    supabase.from("servicios").select("nombre").eq("activo", true),
  ]);
  const cortes = (cortesData ?? []) as Corte[];
  const turnos = (turnosData ?? []) as unknown as TurnoFila[];

  // URLs firmadas (1 h) para las fotos privadas
  const rutas = cortes.flatMap((x) => x.fotos);
  const firmadas = new Map<string, string>();
  if (rutas.length) {
    const { data } = await supabase.storage.from("cortes").createSignedUrls(rutas, 3600);
    data?.forEach((f) => f.path && f.signedUrl && firmadas.set(f.path, f.signedUrl));
  }

  const tz = barberia.timezone;
  const fecha = new Intl.DateTimeFormat("es-AR", { timeZone: tz, dateStyle: "medium", timeStyle: "short" });
  const hoy = new Intl.DateTimeFormat("en-CA", { timeZone: tz }).format(new Date());
  const turnoElegido = turnos.find((t) => t.id === turnoParam && t.estado === "confirmado");
  const fechaTurno = turnoElegido ? new Intl.DateTimeFormat("en-CA", { timeZone: tz }).format(new Date(turnoElegido.inicio)) : hoy;

  return (
    <main className="mx-auto flex w-full max-w-xl flex-1 flex-col gap-8 px-4 py-8">
      <div>
        <Link href="/panel/clientes" className="text-sm underline">← Clientes</Link>
        <h1 className="mt-2 text-2xl font-semibold">{c.nombre} {c.apellido}</h1>
        <p className="text-sm text-zinc-600 dark:text-zinc-400">Ficha n° <b>{c.numero}</b> · cliente desde {new Intl.DateTimeFormat("es-AR", { timeZone: tz, dateStyle: "medium" }).format(new Date(c.created_at))}</p>
      </div>

      <FichaForm id={c.id} inicial={{
        nombre: c.nombre, apellido: c.apellido ?? "", telefono: c.telefono ?? "", email: c.email ?? "",
        edad: c.edad?.toString() ?? "", direccion: c.direccion ?? "", observaciones: c.observaciones ?? "",
      }} />

      <section className="flex flex-col gap-4">
        <h2 className="text-lg font-medium">Cortes</h2>
        <CorteForm key={turnoElegido?.id ?? "libre"} barberiaId={barberia.id} clienteId={c.id} servicios={(servs ?? []).map((s) => s.nombre)} hoy={fechaTurno}
          turnoId={turnoElegido?.id} servicioInicial={turnoElegido?.servicios?.nombre ?? ""} precioInicial={turnoElegido?.precio?.toString() ?? ""} />
        {cortes.length === 0 && <p className="text-zinc-600 dark:text-zinc-400">Todavía no hay cortes registrados.</p>}
        {cortes.map((x) => (
          <article key={x.id} className="rounded-lg border border-zinc-300 p-4 dark:border-zinc-700">
            <div className="flex items-start justify-between gap-2">
              <p className="font-medium">{new Intl.DateTimeFormat("es-AR", { dateStyle: "long", timeZone: "UTC" }).format(new Date(x.fecha))}{x.servicio && ` · ${x.servicio}`}{x.precio != null && ` · $${x.precio}`}</p>
              <BorrarCorte corteId={x.id} clienteId={c.id} />
            </div>
            {x.nota && <p className="mt-1 whitespace-pre-line text-sm">{x.nota}</p>}
            {x.fotos.length > 0 && (
              <div className="mt-3 grid grid-cols-3 gap-2">
                {x.fotos.map((p) => firmadas.get(p) && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <a key={p} href={firmadas.get(p)} target="_blank" rel="noreferrer"><img src={firmadas.get(p)} alt="Foto del corte" className="aspect-square w-full rounded-lg object-cover" /></a>
                ))}
              </div>
            )}
          </article>
        ))}
      </section>

      <section className="flex flex-col gap-2">
        <h2 className="text-lg font-medium">Turnos</h2>
        {turnos.length === 0 && <p className="text-zinc-600 dark:text-zinc-400">Sin turnos.</p>}
        {turnos.map((t) => (
          <p key={t.id} className="text-sm">
            {fecha.format(new Date(t.inicio))} · {t.servicios?.nombre} · {t.modalidad === "local" ? "local" : "domicilio"}
            {t.estado !== "confirmado" && <span className="text-zinc-500"> ({t.estado})</span>}
            {t.estado === "confirmado" && <> · <Link className="underline" href={`/panel/clientes/${c.id}?turno=${t.id}`}>Registrar corte</Link></>}
          </p>
        ))}
      </section>
    </main>
  );
}
