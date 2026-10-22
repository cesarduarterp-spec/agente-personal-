"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { abrirFecha, bloquear, guardarHorarios, quitarApertura, quitarBloqueo, type Rango } from "./actions";

const DIAS = ["Domingo", "Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado"];
const ORDEN = [1, 2, 3, 4, 5, 6, 0]; // semana que empieza el lunes
const campo = "rounded-lg border border-zinc-300 px-3 py-2 dark:border-zinc-700 dark:bg-zinc-900";

type Props = {
  barberiaId: string; timezone: string; pasoMin: number;
  barberos: { id: string; nombre: string }[];
  horarios: (Rango & { barbero_id: string })[];
  bloqueos: { id: string; barbero_id: string; inicio: string; fin: string; motivo: string | null }[];
  aperturas: { id: string; barbero_id: string; inicio: string; fin: string; motivo: string | null }[];
};

export default function Editor({ barberiaId, timezone, pasoMin, barberos, horarios, bloqueos, aperturas }: Props) {
  const router = useRouter();
  const [barbero, setBarbero] = useState(barberos[0]?.id ?? "");
  // franjas por barbero, editables; se guardan juntas con el botón
  const [porBarbero, setPorBarbero] = useState<Record<string, Rango[]>>(() =>
    Object.fromEntries(barberos.map((b) => [b.id, horarios.filter((h) => h.barbero_id === b.id).map(({ dia_semana, desde, hasta }) => ({ dia_semana, desde, hasta }))])),
  );
  const [paso, setPaso] = useState(pasoMin);
  const [msg, setMsg] = useState<{ ok: boolean; texto: string } | null>(null);
  const [pendiente, iniciar] = useTransition();

  const rangos = porBarbero[barbero] ?? [];
  const setRangos = (f: (r: Rango[]) => Rango[]) => setPorBarbero((p) => ({ ...p, [barbero]: f(p[barbero] ?? []) }));
  const franjasDe = (d: number) => rangos.map((r, i) => ({ r, i })).filter(({ r }) => r.dia_semana === d);

  function alternarDia(d: number, activo: boolean) {
    setRangos((l) => (activo ? [...l, { dia_semana: d, desde: "09:00", hasta: "19:00" }] : l.filter((r) => r.dia_semana !== d)));
  }
  function editar(i: number, parche: Partial<Rango>) {
    setRangos((l) => l.map((r, j) => (j === i ? { ...r, ...parche } : r)));
  }

  function guardar() {
    setMsg(null);
    iniciar(async () => {
      const r = await guardarHorarios(barberiaId, barbero, paso, rangos);
      setMsg(r.ok ? { ok: true, texto: "Horarios guardados." } : { ok: false, texto: r.error });
      if (r.ok) router.refresh();
    });
  }

  // --- bloqueos
  const [desde, setDesde] = useState("");
  const [hasta, setHasta] = useState("");
  const [hDesde, setHDesde] = useState("");
  const [hHasta, setHHasta] = useState("");
  const [motivo, setMotivo] = useState("");
  const [msgB, setMsgB] = useState<{ ok: boolean; texto: string } | null>(null);
  const fmt = new Intl.DateTimeFormat("es-AR", { timeZone: timezone, dateStyle: "medium", timeStyle: "short" });
  const fmtDia = new Intl.DateTimeFormat("es-AR", { timeZone: timezone, dateStyle: "medium" });

  function agregarBloqueo(e: React.FormEvent) {
    e.preventDefault();
    setMsgB(null);
    iniciar(async () => {
      const r = await bloquear(barbero, desde, hasta || desde, hDesde, hHasta, motivo);
      if (!r.ok) return setMsgB({ ok: false, texto: r.error });
      setMsgB({ ok: true, texto: r.conflictos ? `Bloqueado. Atención: ya hay ${r.conflictos} turno(s) reservado(s) en ese período; cancelalos o avisá a los clientes.` : "Período bloqueado." });
      setDesde(""); setHasta(""); setHDesde(""); setHHasta(""); setMotivo("");
      router.refresh();
    });
  }

  // --- aperturas (fechas extra fuera del horario semanal)
  const [aFecha, setAFecha] = useState("");
  const [aDesde, setADesde] = useState("10:00");
  const [aHasta, setAHasta] = useState("14:00");
  const [aMotivo, setAMotivo] = useState("");
  const [msgA, setMsgA] = useState<{ ok: boolean; texto: string } | null>(null);

  function agregarApertura(e: React.FormEvent) {
    e.preventDefault();
    setMsgA(null);
    iniciar(async () => {
      const r = await abrirFecha(barbero, aFecha, aDesde, aHasta, aMotivo);
      if (!r.ok) return setMsgA({ ok: false, texto: r.error });
      setMsgA({ ok: true, texto: r.bloqueos ? "Fecha abierta, pero se superpone con un bloqueo: mientras esté el bloqueo, esos horarios siguen cerrados. Quitalo más abajo." : "Fecha abierta: los clientes ya pueden reservar." });
      setAFecha(""); setAMotivo("");
      router.refresh();
    });
  }

  return (
    <div className="flex flex-col gap-10">
      {barberos.length > 1 && (
        <select value={barbero} onChange={(e) => setBarbero(e.target.value)} className={campo} aria-label="Barbero">
          {barberos.map((b) => <option key={b.id} value={b.id}>{b.nombre}</option>)}
        </select>
      )}

      <section className="flex flex-col gap-3">
        {ORDEN.map((d) => {
          const franjas = franjasDe(d);
          return (
            <div key={d} className="rounded-lg border border-zinc-300 p-3 dark:border-zinc-700">
              <label className="flex items-center gap-2 font-medium">
                <input type="checkbox" checked={franjas.length > 0} onChange={(e) => alternarDia(d, e.target.checked)} /> {DIAS[d]}
                {franjas.length === 0 && <span className="text-sm font-normal text-zinc-500">No atiendo</span>}
              </label>
              {franjas.map(({ r, i }) => (
                <div key={i} className="mt-2 flex items-center gap-2">
                  <input type="time" value={r.desde} onChange={(e) => editar(i, { desde: e.target.value })} className={campo} aria-label="Desde" />
                  <span>a</span>
                  <input type="time" value={r.hasta} onChange={(e) => editar(i, { hasta: e.target.value })} className={campo} aria-label="Hasta" />
                  {franjas.length > 1 && <button type="button" aria-label="Quitar franja" onClick={() => setRangos((l) => l.filter((_, j) => j !== i))}>✕</button>}
                </div>
              ))}
              {franjas.length > 0 && (
                <button type="button" className="mt-2 text-sm underline" onClick={() => setRangos((l) => [...l, { dia_semana: d, desde: "15:00", hasta: "19:00" }])}>
                  + Agregar franja (ej: corte de almuerzo)
                </button>
              )}
            </div>
          );
        })}

        <label className="flex items-center gap-2 text-sm">
          Un turno cada
          <select value={paso} onChange={(e) => setPaso(Number(e.target.value))} className={campo}>
            {[10, 15, 20, 30, 45, 60].map((m) => <option key={m} value={m}>{m} min</option>)}
          </select>
          <span className="text-zinc-500">(intervalo entre horarios ofrecidos)</span>
        </label>

        {msg && <p role="status" className={msg.ok ? "text-green-700 dark:text-green-400" : "text-red-700 dark:text-red-400"}>{msg.texto}</p>}
        <button type="button" onClick={guardar} disabled={pendiente || !barbero}
          className="rounded-lg bg-zinc-900 px-4 py-3 font-medium text-white disabled:opacity-60 dark:bg-white dark:text-zinc-900">
          {pendiente ? "Guardando…" : "Guardar horarios"}
        </button>
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="text-lg font-medium">Abrir una fecha especial</h2>
        <p className="text-sm text-zinc-600 dark:text-zinc-400">Para atender un día que normalmente no trabajás (ej: un domingo extra).</p>
        <form onSubmit={agregarApertura} className="flex flex-col gap-3 rounded-lg border border-zinc-300 p-4 dark:border-zinc-700">
          <div className="grid grid-cols-3 gap-3">
            <label className="flex flex-col text-sm">Fecha<input type="date" required value={aFecha} onChange={(e) => setAFecha(e.target.value)} className={campo} /></label>
            <label className="flex flex-col text-sm">Desde<input type="time" required value={aDesde} onChange={(e) => setADesde(e.target.value)} className={campo} /></label>
            <label className="flex flex-col text-sm">Hasta<input type="time" required value={aHasta} onChange={(e) => setAHasta(e.target.value)} className={campo} /></label>
          </div>
          <input placeholder="Motivo (opcional)" value={aMotivo} onChange={(e) => setAMotivo(e.target.value)} className={campo} />
          {msgA && <p role="status" className={msgA.ok ? "text-green-700 dark:text-green-400" : "text-red-700 dark:text-red-400"}>{msgA.texto}</p>}
          <button disabled={pendiente || !barbero} className="rounded-lg border border-zinc-300 px-4 py-2 dark:border-zinc-700">Abrir fecha</button>
        </form>
        {aperturas.filter((a) => a.barbero_id === barbero).map((a) => (
          <div key={a.id} className="flex items-center justify-between gap-3 rounded-lg border border-zinc-300 p-3 text-sm dark:border-zinc-700">
            <span>{fmt.format(new Date(a.inicio))} → {new Intl.DateTimeFormat("es-AR", { timeZone: timezone, timeStyle: "short" }).format(new Date(a.fin))}{a.motivo && <span className="text-zinc-500"> · {a.motivo}</span>}</span>
            <button className="text-red-700 underline dark:text-red-400" disabled={pendiente}
              onClick={() => iniciar(async () => { await quitarApertura(a.id); router.refresh(); })}>Quitar</button>
          </div>
        ))}
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="text-lg font-medium">Días libres y vacaciones</h2>
        <form onSubmit={agregarBloqueo} className="flex flex-col gap-3 rounded-lg border border-zinc-300 p-4 dark:border-zinc-700">
          <div className="grid grid-cols-2 gap-3">
            <label className="flex flex-col text-sm">Desde<input type="date" required value={desde} onChange={(e) => setDesde(e.target.value)} className={campo} /></label>
            <label className="flex flex-col text-sm">Hasta (opcional)<input type="date" min={desde} value={hasta} onChange={(e) => setHasta(e.target.value)} className={campo} /></label>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <label className="flex flex-col text-sm">Hora desde (vacío = día entero)<input type="time" value={hDesde} onChange={(e) => setHDesde(e.target.value)} className={campo} /></label>
            <label className="flex flex-col text-sm">Hora hasta<input type="time" value={hHasta} onChange={(e) => setHHasta(e.target.value)} className={campo} /></label>
          </div>
          <input placeholder="Motivo (opcional)" value={motivo} onChange={(e) => setMotivo(e.target.value)} className={campo} />
          {msgB && <p role="status" className={msgB.ok ? "text-green-700 dark:text-green-400" : "text-red-700 dark:text-red-400"}>{msgB.texto}</p>}
          <button disabled={pendiente || !barbero} className="rounded-lg border border-zinc-300 px-4 py-2 dark:border-zinc-700">Bloquear</button>
        </form>

        {bloqueos.filter((b) => b.barbero_id === barbero).map((b) => {
          const diaEntero = new Date(b.fin).getTime() - new Date(b.inicio).getTime() >= 864e5 - 1000;
          return (
            <div key={b.id} className="flex items-center justify-between gap-3 rounded-lg border border-zinc-300 p-3 text-sm dark:border-zinc-700">
              <span>
                {diaEntero ? `${fmtDia.format(new Date(b.inicio))} → ${fmtDia.format(new Date(new Date(b.fin).getTime() - 1000))}` : `${fmt.format(new Date(b.inicio))} → ${fmt.format(new Date(b.fin))}`}
                {b.motivo && <span className="text-zinc-500"> · {b.motivo}</span>}
              </span>
              <button className="text-red-700 underline dark:text-red-400" disabled={pendiente}
                onClick={() => iniciar(async () => { await quitarBloqueo(b.id); router.refresh(); })}>Quitar</button>
            </div>
          );
        })}
      </section>
    </div>
  );
}
