import Link from "next/link";
import { cargarAdmin, ETIQUETA, type Usuario } from "@/lib/admin";
import { dinero, fecha } from "@/lib/format";

export const dynamic = "force-dynamic";

const FILTROS: [string, string][] = [["", "Todos"], ["por_vencer", "Por vencer (7 días)"], ["prueba", "En prueba"], ["activa", "Pagando"], ["vencida", "Vencidas"], ["suspendida", "Suspendidas"], ["sin_barberia", "Sin barbería"]];

export default async function Usuarios({ searchParams }: PageProps<"/admin/usuarios">) {
  const { supabase } = await cargarAdmin();
  const sp = await searchParams;
  const q = String(sp.q ?? "").trim();
  const f = String(sp.f ?? "");
  const { data } = await supabase.rpc("admin_usuarios", { p_q: q, p_filtro: f || null, p_limite: 300 });
  const filas = (data ?? []) as Usuario[];

  return (
    <main className="mx-auto w-full max-w-4xl flex-1 px-4 py-8">
      <h1 className="text-2xl font-semibold">Usuarios</h1>
      <form className="mt-4 flex gap-2">
        {f && <input type="hidden" name="f" value={f} />}
        <input name="q" defaultValue={q} placeholder="Buscar por mail, nombre o link" className="flex-1 rounded-lg border border-zinc-300 px-3 py-3 dark:border-zinc-700 dark:bg-zinc-900" />
        <button className="rounded-lg border border-zinc-300 px-4 dark:border-zinc-700">Buscar</button>
      </form>
      <div className="mt-3 flex flex-wrap gap-2 text-sm">
        {FILTROS.map(([v, t]) => (
          <Link key={v} href={`/admin/usuarios?${new URLSearchParams({ ...(q ? { q } : {}), ...(v ? { f: v } : {}) })}`}
            className={`rounded-full border px-3 py-1 ${f === v ? "border-zinc-900 bg-zinc-900 text-white dark:border-white dark:bg-white dark:text-zinc-900" : "border-zinc-300 dark:border-zinc-700"}`}>{t}</Link>
        ))}
      </div>
      <p className="mt-3 text-sm text-zinc-600 dark:text-zinc-400">{filas.length} resultado(s)</p>

      <ul className="mt-2 flex flex-col gap-2">
        {filas.map((u) => (
          <li key={u.user_id} className="rounded-lg border border-zinc-300 p-4 dark:border-zinc-700">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div>
                <p className="font-medium">{u.nombre ?? <span className="text-zinc-500">Sin barbería</span>}</p>
                <p className="text-sm">{u.email}{!u.confirmado && <span className="ml-2 text-amber-700">· mail sin confirmar</span>}</p>
              </div>
              <span className="rounded-full bg-zinc-100 px-3 py-1 text-xs font-medium dark:bg-zinc-800">{ETIQUETA[u.estado ?? "sin_barberia"] ?? u.estado}</span>
            </div>
            <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
              Registrado {fecha(u.creado)} · último ingreso {fecha(u.ultimo_ingreso)}
              {u.barberia_id && <> · {u.turnos_30d} turnos/30d · {u.clientes} clientes</>}
            </p>
            {u.barberia_id && (
              <p className="text-sm text-zinc-600 dark:text-zinc-400">
                {u.estado === "prueba" && <>Prueba hasta {fecha(u.prueba_hasta)} · </>}
                {u.periodo_hasta && <>Pago hasta {fecha(u.periodo_hasta)} · </>}
                Pagado: {dinero(u.pagado)}
              </p>
            )}
            <div className="mt-2 flex gap-4 text-sm">
              {u.barberia_id && <Link className="underline" href={`/admin/barberias/${u.barberia_id}`}>Gestionar</Link>}
              {u.slug && <a className="underline" target="_blank" rel="noreferrer" href={`/${u.slug}`}>Ver su página</a>}
              <a className="underline" href={`mailto:${u.email}`}>Escribirle</a>
            </div>
          </li>
        ))}
      </ul>
    </main>
  );
}
