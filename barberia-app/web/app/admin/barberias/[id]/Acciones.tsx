"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { cambiarEstado, extenderPrueba, registrarPago } from "../../actions";

const campo = "rounded-lg border border-zinc-300 px-3 py-2 dark:border-zinc-700 dark:bg-zinc-900";

export default function Acciones({ barberiaId, estadoActual }: { barberiaId: string; estadoActual: string }) {
  const router = useRouter();
  const [pendiente, iniciar] = useTransition();
  const [msg, setMsg] = useState<{ ok: boolean; texto: string } | null>(null);
  const [monto, setMonto] = useState("");
  const [moneda, setMoneda] = useState("USD");
  const [metodo, setMetodo] = useState("transferencia");
  const [nota, setNota] = useState("");
  const [meses, setMeses] = useState("1");
  const [dias, setDias] = useState("14");
  const [estado, setEstado] = useState(estadoActual);
  const [notaEstado, setNotaEstado] = useState("");

  const ejecutar = (f: () => Promise<{ ok: boolean; error?: string }>, ok: string) => {
    setMsg(null);
    iniciar(async () => {
      const r = await f();
      setMsg(r.ok ? { ok: true, texto: ok } : { ok: false, texto: r.error ?? "Error" });
      if (r.ok) router.refresh();
    });
  };

  return (
    <section className="flex flex-col gap-4">
      <h2 className="text-lg font-medium">Acciones</h2>

      <form className="flex flex-col gap-2 rounded-lg border border-zinc-300 p-4 dark:border-zinc-700"
        onSubmit={(e) => { e.preventDefault(); ejecutar(() => registrarPago(barberiaId, Number(monto), moneda, metodo, nota, Number(meses)), "Pago registrado y plan activado."); setMonto(""); setNota(""); }}>
        <p className="font-medium">Registrar un pago (transferencia, Mercado Pago, efectivo)</p>
        <div className="grid grid-cols-3 gap-2">
          <label className="flex flex-col gap-1 text-xs text-zinc-600 dark:text-zinc-400">Monto
            <input required type="number" min="0" step="0.01" value={monto} onChange={(e) => setMonto(e.target.value)} className={campo} /></label>
          <label className="flex flex-col gap-1 text-xs text-zinc-600 dark:text-zinc-400">Moneda
            <select value={moneda} onChange={(e) => setMoneda(e.target.value)} className={campo}><option>USD</option><option>ARS</option></select></label>
          <label className="flex flex-col gap-1 text-xs text-zinc-600 dark:text-zinc-400">Meses que cubre
            <input required type="number" min="1" max="24" value={meses} onChange={(e) => setMeses(e.target.value)} className={campo} /></label>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <input placeholder="Método" value={metodo} onChange={(e) => setMetodo(e.target.value)} className={campo} />
          <input placeholder="Nota (opcional)" value={nota} onChange={(e) => setNota(e.target.value)} className={campo} />
        </div>
        <p className="text-xs text-zinc-500">El plan queda activo y se suma ese tiempo a lo que ya tuviera pagado.</p>
        <button disabled={pendiente} className="rounded-lg bg-zinc-900 px-4 py-2 font-medium text-white disabled:opacity-60 dark:bg-white dark:text-zinc-900">Registrar pago</button>
      </form>

      <form className="flex items-center gap-2 rounded-lg border border-zinc-300 p-4 dark:border-zinc-700"
        onSubmit={(e) => { e.preventDefault(); ejecutar(() => extenderPrueba(barberiaId, Number(dias)), "Prueba extendida."); }}>
        <span className="text-sm">Extender la prueba gratis</span>
        <input type="number" min="1" max="365" value={dias} onChange={(e) => setDias(e.target.value)} className={`${campo} w-20`} />
        <span className="text-sm">días</span>
        <button disabled={pendiente} className="ml-auto rounded-lg border border-zinc-300 px-4 py-2 dark:border-zinc-700">Extender</button>
      </form>

      <form className="flex flex-col gap-2 rounded-lg border border-zinc-300 p-4 dark:border-zinc-700"
        onSubmit={(e) => { e.preventDefault(); if (estado === "suspendida" && !confirm("¿Suspender? Dejará de recibir reservas.")) return; ejecutar(() => cambiarEstado(barberiaId, estado, notaEstado), "Estado actualizado."); }}>
        <p className="font-medium">Cambiar el estado</p>
        <div className="grid grid-cols-2 gap-2">
          <select value={estado} onChange={(e) => setEstado(e.target.value)} className={campo}>
            <option value="prueba">En prueba</option><option value="activa">Pagando</option><option value="vencida">Vencida</option>
            <option value="cancelada">Cancelada</option><option value="suspendida">Suspendida (bloquea reservas)</option>
          </select>
          <input placeholder="Nota (opcional)" value={notaEstado} onChange={(e) => setNotaEstado(e.target.value)} className={campo} />
        </div>
        <button disabled={pendiente} className="rounded-lg border border-zinc-300 px-4 py-2 dark:border-zinc-700">Guardar estado</button>
      </form>

      {msg && <p role="status" className={msg.ok ? "text-green-700 dark:text-green-400" : "text-red-700 dark:text-red-400"}>{msg.texto}</p>}
    </section>
  );
}
