"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { guardarCliente, type ClienteInput } from "./actions";

const campo = "rounded-lg border border-zinc-300 px-3 py-3 dark:border-zinc-700 dark:bg-zinc-900";

export default function FichaForm({ id, inicial }: { id: string | null; inicial: ClienteInput }) {
  const router = useRouter();
  const [v, setV] = useState(inicial);
  const [msg, setMsg] = useState<{ ok: boolean; texto: string } | null>(null);
  const [pendiente, iniciar] = useTransition();
  const set = (k: keyof ClienteInput) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setV((x) => ({ ...x, [k]: e.target.value }));

  function enviar(e: React.FormEvent) {
    e.preventDefault();
    setMsg(null);
    iniciar(async () => {
      const r = await guardarCliente(id, v);
      if (!r.ok) return setMsg({ ok: false, texto: r.error });
      if (id) { setMsg({ ok: true, texto: "Cambios guardados." }); router.refresh(); }
      else router.push(`/panel/clientes/${r.id}`);
    });
  }

  return (
    <form onSubmit={enviar} className="flex flex-col gap-3">
      <div className="grid grid-cols-2 gap-3">
        <input required placeholder="Nombre" value={v.nombre} onChange={set("nombre")} className={campo} />
        <input placeholder="Apellido" value={v.apellido} onChange={set("apellido")} className={campo} />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <input type="tel" placeholder="Teléfono" value={v.telefono} onChange={set("telefono")} className={campo} />
        <input type="number" min="1" max="120" placeholder="Edad" value={v.edad} onChange={set("edad")} className={campo} />
      </div>
      <input type="email" placeholder="Mail" value={v.email} onChange={set("email")} className={campo} />
      <input placeholder="Dirección (si lo atendés a domicilio)" value={v.direccion} onChange={set("direccion")} className={campo} />
      <textarea rows={4} placeholder="Observaciones (gustos, tipo de pelo, sensibilidad, máquina que prefiere…)" value={v.observaciones} onChange={set("observaciones")} className={campo} />
      {msg && <p role="status" className={msg.ok ? "text-green-700 dark:text-green-400" : "text-red-700 dark:text-red-400"}>{msg.texto}</p>}
      <button disabled={pendiente} className="rounded-lg bg-zinc-900 px-4 py-3 font-medium text-white disabled:opacity-60 dark:bg-white dark:text-zinc-900">
        {pendiente ? "Guardando…" : id ? "Guardar cambios" : "Crear ficha"}
      </button>
    </form>
  );
}
