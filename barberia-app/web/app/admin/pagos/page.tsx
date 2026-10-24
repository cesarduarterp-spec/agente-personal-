import Link from "next/link";
import { cargarAdmin, type PagoFila } from "@/lib/admin";
import { dinero, fechaHora } from "@/lib/format";

export const dynamic = "force-dynamic";

export default async function Pagos() {
  const { supabase } = await cargarAdmin();
  const { data } = await supabase.rpc("admin_pagos", { p_limite: 300 });
  const filas = (data ?? []) as PagoFila[];
  const total = filas.filter((p) => p.estado === "pagado").reduce<Record<string, number>>((a, p) => ({ ...a, [p.moneda]: (a[p.moneda] ?? 0) + Number(p.monto) }), {});
  return (
    <main className="mx-auto w-full max-w-4xl flex-1 px-4 py-8">
      <h1 className="text-2xl font-semibold">Pagos</h1>
      <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">Total de lo que se ve acá (pagados): <b>{dinero(total)}</b></p>
      <ul className="mt-4 flex flex-col gap-2">
        {filas.length === 0 && <li className="text-zinc-600 dark:text-zinc-400">Todavía no hay pagos registrados.</li>}
        {filas.map((p) => (
          <li key={p.id} className="rounded-lg border border-zinc-300 p-4 dark:border-zinc-700">
            <div className="flex flex-wrap justify-between gap-2">
              <p className="font-medium">{p.moneda === "ARS" ? dinero({ ARS: p.monto }) : `${p.moneda} ${p.monto}`} <span className="text-sm font-normal text-zinc-500">· {p.estado}</span></p>
              <p className="text-sm text-zinc-600 dark:text-zinc-400">{fechaHora(p.fecha)}</p>
            </div>
            <p className="text-sm"><Link className="underline" href={`/admin/barberias/${p.barberia_id}`}>{p.barberia}</Link> · {p.email}</p>
            <p className="text-sm text-zinc-600 dark:text-zinc-400">{p.proveedor}{p.metodo ? ` · ${p.metodo}` : ""}{p.periodo_hasta ? ` · cubre hasta ${fechaHora(p.periodo_hasta).split(",")[0]}` : ""}{p.nota ? ` · ${p.nota}` : ""}</p>
          </li>
        ))}
      </ul>
    </main>
  );
}
