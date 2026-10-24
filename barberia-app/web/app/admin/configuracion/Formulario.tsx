"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { guardarConfigCobro } from "../actions";

const campo = "rounded-lg border border-zinc-300 px-3 py-2 dark:border-zinc-700 dark:bg-zinc-900";

export default function Formulario({ inicial }: { inicial: { cobro_activo: boolean; dias_prueba: number; dias_gracia: number } }) {
  const router = useRouter();
  const [activo, setActivo] = useState(inicial.cobro_activo);
  const [prueba, setPrueba] = useState(String(inicial.dias_prueba));
  const [gracia, setGracia] = useState(String(inicial.dias_gracia));
  const [msg, setMsg] = useState<{ ok: boolean; texto: string } | null>(null);
  const [pendiente, iniciar] = useTransition();

  function guardar(e: React.FormEvent) {
    e.preventDefault();
    if (activo && !inicial.cobro_activo && !confirm("Al activar el cobro, las barberías con la prueba vencida o sin pago dejan de recibir reservas (después de los días de gracia). ¿Seguro?")) return;
    setMsg(null);
    iniciar(async () => {
      const r = await guardarConfigCobro(activo, Number(prueba), Number(gracia));
      setMsg(r.ok ? { ok: true, texto: "Guardado." } : { ok: false, texto: r.error });
      if (r.ok) router.refresh();
    });
  }

  return (
    <form onSubmit={guardar} className="flex flex-col gap-4">
      <label className="flex items-center gap-2 rounded-lg border border-zinc-300 p-3 font-medium dark:border-zinc-700">
        <input type="checkbox" checked={activo} onChange={(e) => setActivo(e.target.checked)} /> Cobro automático activado
      </label>
      <label className="flex flex-col gap-1 text-sm">Días de prueba gratis para barberías nuevas
        <input type="number" min="0" max="365" value={prueba} onChange={(e) => setPrueba(e.target.value)} className={campo} /></label>
      <label className="flex flex-col gap-1 text-sm">Días de gracia después de vencer el pago (siguen recibiendo reservas)
        <input type="number" min="0" max="90" value={gracia} onChange={(e) => setGracia(e.target.value)} className={campo} /></label>
      {msg && <p role="status" className={msg.ok ? "text-green-700 dark:text-green-400" : "text-red-700 dark:text-red-400"}>{msg.texto}</p>}
      <button disabled={pendiente} className="rounded-lg bg-zinc-900 px-4 py-3 font-medium text-white disabled:opacity-60 dark:bg-white dark:text-zinc-900">{pendiente ? "Guardando…" : "Guardar"}</button>
    </form>
  );
}
