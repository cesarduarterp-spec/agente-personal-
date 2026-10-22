"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { alternarBarbero, guardarBarbero } from "./actions";

const campo = "flex-1 rounded-lg border border-zinc-300 px-3 py-2 dark:border-zinc-700 dark:bg-zinc-900";
type B = { id: string; nombre: string; activo: boolean };

function Fila({ barberiaId, b }: { barberiaId: string; b: B | null }) {
  const router = useRouter();
  const [nombre, setNombre] = useState(b?.nombre ?? "");
  const [error, setError] = useState<string | null>(null);
  const [pendiente, iniciar] = useTransition();

  const ejecutar = (f: () => Promise<{ ok: boolean; error?: string }>, limpiar = false) => {
    setError(null);
    iniciar(async () => {
      const r = await f();
      if (!r.ok) return setError(r.error ?? "Error");
      if (limpiar) setNombre("");
      router.refresh();
    });
  };

  return (
    <div className={`flex flex-col gap-1 ${b && !b.activo ? "opacity-60" : ""}`}>
      <div className="flex items-center gap-2">
        <input placeholder="Nombre del barbero" value={nombre} onChange={(e) => setNombre(e.target.value)} className={campo} />
        {(!b || nombre !== b.nombre) && (
          <button disabled={pendiente} className="text-sm font-medium underline" onClick={() => ejecutar(() => guardarBarbero(barberiaId, b?.id ?? null, nombre), !b)}>
            {b ? "Guardar" : "Agregar"}
          </button>
        )}
        {b && <button disabled={pendiente} className="text-sm underline" onClick={() => ejecutar(() => alternarBarbero(barberiaId, b.id, !b.activo))}>{b.activo ? "Desactivar" : "Activar"}</button>}
      </div>
      {error && <p role="alert" className="text-sm text-red-700 dark:text-red-400">{error}</p>}
    </div>
  );
}

export default function Barberos({ barberiaId, barberos }: { barberiaId: string; barberos: B[] }) {
  return (
    <section className="flex flex-col gap-3">
      <h2 className="text-lg font-medium">Barberos</h2>
      <p className="text-sm text-zinc-600 dark:text-zinc-400">Si sumás más barberos, cada uno tiene su propia agenda y el cliente elige con quién reservar. Después de agregar uno, cargale sus horarios en la pestaña Horarios.</p>
      {barberos.map((b) => <Fila key={`${b.id}-${b.nombre}`} barberiaId={barberiaId} b={b} />)}
      <Fila key={`nuevo-${barberos.length}`} barberiaId={barberiaId} b={null} />
    </section>
  );
}
