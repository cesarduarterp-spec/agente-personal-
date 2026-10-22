import Link from "next/link";
import { cargarPanel } from "@/lib/panel";

export const dynamic = "force-dynamic";

type Ficha = { id: string; numero: number; nombre: string; apellido: string | null; telefono: string | null; email: string | null };

export default async function Clientes({ searchParams }: PageProps<"/panel/clientes">) {
  const { supabase } = await cargarPanel();
  const q = String((await searchParams).q ?? "").trim();

  let consulta = supabase.from("clientes").select("id, numero, nombre, apellido, telefono, email").limit(500);
  if (q) {
    // se quitan los caracteres con significado especial en los filtros de PostgREST
    const t = q.replace(/[,()%*\\"]/g, " ").trim();
    const filtros = [`nombre.ilike.%${t}%`, `apellido.ilike.%${t}%`, `email.ilike.%${t}%`, `telefono.ilike.%${t}%`];
    if (/^#?\d+$/.test(t)) filtros.push(`numero.eq.${t.replace("#", "")}`);
    consulta = consulta.or(filtros.join(","));
  }
  const { data } = await consulta;
  // orden alfabético por primer nombre, respetando tildes y la ñ
  const fichas = ((data ?? []) as Ficha[]).sort(
    (a, b) => a.nombre.localeCompare(b.nombre, "es", { sensitivity: "base" }) ||
      (a.apellido ?? "").localeCompare(b.apellido ?? "", "es", { sensitivity: "base" }),
  );
  const letras = Map.groupBy(fichas, (f) => (f.nombre.trim()[0] ?? "#").toLocaleUpperCase("es"));

  return (
    <main className="mx-auto w-full max-w-2xl flex-1 px-4 py-8">
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold">Clientes</h1>
        <Link href="/panel/clientes/nuevo" className="rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white dark:bg-white dark:text-zinc-900">Nueva ficha</Link>
      </div>

      <form className="mt-4 flex gap-2">
        <input name="q" defaultValue={q} placeholder="Buscar por nombre, apellido, teléfono, mail o n° de ficha" autoFocus
          className="flex-1 rounded-lg border border-zinc-300 px-3 py-3 dark:border-zinc-700 dark:bg-zinc-900" />
        <button className="rounded-lg border border-zinc-300 px-4 dark:border-zinc-700">Buscar</button>
      </form>
      {q && <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">{fichas.length} resultado(s) · <Link className="underline" href="/panel/clientes">ver todas</Link></p>}

      {fichas.length === 0 && <p className="mt-6 text-zinc-600 dark:text-zinc-400">{q ? "No hay fichas con esa búsqueda." : "Todavía no tenés fichas. Se crean solas cuando alguien reserva, o cargá una a mano."}</p>}
      {[...letras].map(([letra, lista]) => (
        <section key={letra} className="mt-6">
          <h2 className="text-sm font-semibold text-zinc-500">{letra}</h2>
          <ul className="mt-1 divide-y divide-zinc-200 rounded-lg border border-zinc-300 dark:divide-zinc-800 dark:border-zinc-700">
            {lista.map((f) => (
              <li key={f.id}>
                <Link href={`/panel/clientes/${f.id}`} className="flex items-center justify-between gap-3 px-4 py-3 hover:bg-zinc-50 dark:hover:bg-zinc-900">
                  <span><b>{f.nombre} {f.apellido}</b><br /><span className="text-sm text-zinc-600 dark:text-zinc-400">{f.telefono ?? f.email ?? ""}</span></span>
                  <span className="text-sm text-zinc-500">#{f.numero}</span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ))}
    </main>
  );
}
