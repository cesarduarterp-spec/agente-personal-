import Link from "next/link";
import { notFound } from "next/navigation";
import { cargarAdmin, ETIQUETA, type PagoFila, type Usuario } from "@/lib/admin";
import { dinero, fecha, fechaHora } from "@/lib/format";
import Acciones from "./Acciones";

export const dynamic = "force-dynamic";

export default async function Detalle({ params }: PageProps<"/admin/barberias/[id]">) {
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const { supabase } = await cargarAdmin();
  const [{ data: u }, { data: p }] = await Promise.all([
    supabase.rpc("admin_usuarios", { p_barberia: id, p_limite: 1 }),
    supabase.rpc("admin_pagos", { p_barberia: id, p_limite: 100 }),
  ]);
  const b = ((u ?? []) as Usuario[])[0];
  if (!b) notFound();
  const pagos = (p ?? []) as PagoFila[];

  return (
    <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-6 px-4 py-8">
      <div>
        <Link href="/admin/usuarios" className="text-sm underline">← Usuarios</Link>
        <h1 className="mt-2 text-2xl font-semibold">{b.nombre}</h1>
        <p className="text-sm">{b.email} · <a className="underline" href={`mailto:${b.email}`}>escribirle</a></p>
        <p className="text-sm text-zinc-600 dark:text-zinc-400">
          Registrado {fecha(b.creado)} · último ingreso {fecha(b.ultimo_ingreso)} · modo {b.modo} · {b.turnos_30d} turnos en 30 días · {b.clientes} clientes
        </p>
        {b.slug && <p className="text-sm"><a className="underline" target="_blank" rel="noreferrer" href={`/${b.slug}`}>/{b.slug}</a></p>}
      </div>

      <section className="rounded-lg border border-zinc-300 p-4 dark:border-zinc-700">
        <p className="text-sm text-zinc-600 dark:text-zinc-400">Estado</p>
        <p className="text-xl font-semibold">{ETIQUETA[b.estado ?? ""] ?? b.estado} {b.habilitada === false && <span className="text-sm font-normal text-red-700">· no recibe reservas</span>}</p>
        <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
          {b.prueba_hasta && <>Prueba hasta {fecha(b.prueba_hasta)} · </>}
          {b.periodo_hasta && <>Pago hasta {fecha(b.periodo_hasta)} · </>}
          Total pagado: {dinero(b.pagado)} {b.proveedor && <>· vía {b.proveedor}</>}
        </p>
        {b.notas && <p className="mt-1 text-sm">Notas: {b.notas}</p>}
      </section>

      <Acciones barberiaId={id} estadoActual={b.estado ?? "prueba"} />

      <section className="flex flex-col gap-2">
        <h2 className="text-lg font-medium">Pagos</h2>
        {pagos.length === 0 && <p className="text-zinc-600 dark:text-zinc-400">Sin pagos.</p>}
        {pagos.map((x) => (
          <div key={x.id} className="rounded-lg border border-zinc-300 p-3 text-sm dark:border-zinc-700">
            <b>{x.moneda === "ARS" ? dinero({ ARS: x.monto }) : `${x.moneda} ${x.monto}`}</b> · {x.estado} · {fechaHora(x.fecha)}
            <br /><span className="text-zinc-600 dark:text-zinc-400">{x.proveedor}{x.metodo ? ` · ${x.metodo}` : ""}{x.nota ? ` · ${x.nota}` : ""}</span>
          </div>
        ))}
      </section>
    </main>
  );
}
