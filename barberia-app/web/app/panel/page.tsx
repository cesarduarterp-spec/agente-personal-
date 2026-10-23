import Link from "next/link";
import { cargarPanel, ventana } from "@/lib/panel";
import Acciones from "./Acciones";

export const dynamic = "force-dynamic";

type Fila = {
  id: string; inicio: string; modalidad: string; direccion: string | null; estado: string;
  servicios: { nombre: string } | null;
  clientes: { id: string; numero: number; nombre: string; apellido: string | null; telefono: string | null } | null;
};

export default async function Panel() {
  const { supabase, user, barberia } = await cargarPanel();
  const tz = barberia.timezone;
  const { desde, hasta } = ventana(7, 24);

  const { data } = await supabase
    .from("turnos")
    .select("id, inicio, modalidad, direccion, estado, servicios(nombre), clientes(id, numero, nombre, apellido, telefono)")
    .gte("inicio", desde)
    .lte("inicio", hasta)
    .order("inicio");
  const turnos = (data ?? []) as unknown as Fila[];

  const dia = new Intl.DateTimeFormat("es-AR", { timeZone: tz, weekday: "long", day: "numeric", month: "long" });
  const hora = new Intl.DateTimeFormat("es-AR", { timeZone: tz, timeStyle: "short" });
  const porDia = Map.groupBy(turnos, (t) => dia.format(new Date(t.inicio)));
  const base = process.env.NEXT_PUBLIC_SITE_URL ?? "";

  return (
    <main className="mx-auto w-full max-w-2xl flex-1 px-4 py-8">
      <h1 className="text-2xl font-semibold">{barberia.nombre}</h1>
      <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
        {user.email} · Tu link de reservas: <Link className="underline" href={`/${barberia.slug}`}>{base}/{barberia.slug}</Link>
      </p>

      <div className="mt-8 flex items-center justify-between gap-3">
        <h2 className="font-medium">Ayer y próximos 7 días</h2>
        <Link href="/panel/turnos/nuevo" className="rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white dark:bg-white dark:text-zinc-900">Cargar turno</Link>
      </div>
      {turnos.length === 0 && <p className="mt-2 text-zinc-600 dark:text-zinc-400">No hay turnos reservados todavía.</p>}
      {[...porDia].map(([d, lista]) => (
        <section key={d} className="mt-4">
          <h3 className="text-sm font-medium capitalize text-zinc-600 dark:text-zinc-400">{d}</h3>
          <ul className="mt-1 flex flex-col gap-2">
            {lista.map((t) => (
              <li key={t.id} className={`rounded-lg border border-zinc-300 p-3 dark:border-zinc-700 ${t.estado === "cancelado" ? "opacity-50" : ""}`}>
                <p className="font-medium">{hora.format(new Date(t.inicio))} · {t.servicios?.nombre}{t.estado !== "confirmado" && <span className="ml-2 text-sm font-normal text-zinc-500">({t.estado})</span>}</p>
                {t.clientes && (
                  <p className="text-sm">
                    <Link className="underline" href={`/panel/clientes/${t.clientes.id}`}>
                      Ficha #{t.clientes.numero} · {t.clientes.nombre} {t.clientes.apellido}
                    </Link>
                    {t.clientes.telefono && <> · {t.clientes.telefono}</>}
                  </p>
                )}
                <p className="text-sm text-zinc-600 dark:text-zinc-400">
                  {t.modalidad === "local" ? "En el local" : `🏠 ${t.direccion ?? "A domicilio"}`}
                </p>
                <Acciones turnoId={t.id} estado={t.estado} />
              </li>
            ))}
          </ul>
        </section>
      ))}
    </main>
  );
}
