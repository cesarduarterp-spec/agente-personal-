"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { alternarServicio, borrarServicio, guardarServicio } from "./actions";

const campo = "w-full min-w-0 rounded-lg border border-zinc-300 px-3 py-2 dark:border-zinc-700 dark:bg-zinc-900";
type S = { id: string; nombre: string; precio: number; duracion_min: number; activo: boolean };

function Fila({ barberiaId, s, alTerminar }: { barberiaId: string; s: S | null; alTerminar: () => void }) {
  const [nombre, setNombre] = useState(s?.nombre ?? "");
  const [precio, setPrecio] = useState(s ? String(s.precio) : "");
  const [dur, setDur] = useState(s ? String(s.duracion_min) : "30");
  const [error, setError] = useState<string | null>(null);
  const [pendiente, iniciar] = useTransition();
  const cambiado = !s || nombre !== s.nombre || precio !== String(s.precio) || dur !== String(s.duracion_min);

  const ejecutar = (f: () => Promise<{ ok: boolean; error?: string }>, despues?: () => void) => {
    setError(null);
    iniciar(async () => {
      const r = await f();
      if (!r.ok) return setError(r.error ?? "Error");
      despues?.();
      alTerminar();
    });
  };

  return (
    <div className={`flex flex-col gap-2 rounded-lg border border-zinc-300 p-3 dark:border-zinc-700 ${s && !s.activo ? "opacity-60" : ""}`}>
      <div className="grid grid-cols-[1fr_6rem_5rem] gap-2">
        <input placeholder="Servicio" value={nombre} onChange={(e) => setNombre(e.target.value)} className={campo} />
        <input type="number" min="0" placeholder="$" value={precio} onChange={(e) => setPrecio(e.target.value)} className={campo} />
        <input type="number" min="5" max="480" placeholder="min" value={dur} onChange={(e) => setDur(e.target.value)} className={campo} />
      </div>
      <div className="flex flex-wrap items-center gap-3 text-sm">
        {cambiado && (
          <button disabled={pendiente} className="font-medium underline"
            onClick={() => ejecutar(() => guardarServicio(barberiaId, s?.id ?? null, { nombre, precio, duracion_min: dur }), () => { if (!s) { setNombre(""); setPrecio(""); setDur("30"); } })}>
            {s ? "Guardar" : "Agregar servicio"}
          </button>
        )}
        {s && <button disabled={pendiente} className="underline" onClick={() => ejecutar(() => alternarServicio(s.id, !s.activo))}>{s.activo ? "Desactivar" : "Activar"}</button>}
        {s && <button disabled={pendiente} className="text-red-700 underline dark:text-red-400" onClick={() => confirm("¿Borrar este servicio?") && ejecutar(() => borrarServicio(s.id))}>Borrar</button>}
      </div>
      {error && <p role="alert" className="text-sm text-red-700 dark:text-red-400">{error}</p>}
    </div>
  );
}

export default function Servicios({ barberiaId, servicios }: { barberiaId: string; servicios: S[] }) {
  const router = useRouter();
  const refrescar = () => router.refresh();
  return (
    <section className="flex flex-col gap-3">
      <h2 className="text-lg font-medium">Servicios</h2>
      <p className="text-sm text-zinc-600 dark:text-zinc-400">Nombre, precio y duración en minutos. Un servicio desactivado no aparece para reservar pero conserva su historial.</p>
      {servicios.map((s) => <Fila key={`${s.id}-${s.nombre}-${s.precio}-${s.duracion_min}`} barberiaId={barberiaId} s={s} alTerminar={refrescar} />)}
      <Fila key={`nuevo-${servicios.length}`} barberiaId={barberiaId} s={null} alTerminar={refrescar} />
    </section>
  );
}
