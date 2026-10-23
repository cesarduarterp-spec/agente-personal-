"use client";

import { useEffect, useState, useTransition } from "react";
import { cancelar, obtenerHorariosTurno, reprogramar } from "./actions";
import type { Dia } from "@/lib/public";
import { mapaUrl, textoSobre, urlLogo } from "@/lib/marca";
import CabeceraMarca from "@/components/CabeceraMarca";
import type { Turno } from "./page";

export default function Gestion({ token, turno, cuando, dias }: { token: string; turno: Turno; cuando: string; dias: Dia[] }) {
  const tz = turno.barberia.timezone;
  const [estado, setEstado] = useState(turno.estado);
  const [msg, setMsg] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [cambiando, setCambiando] = useState(false);
  const [fecha, setFecha] = useState("");
  const [resultado, setResultado] = useState<{ fecha: string; horas: string[] } | null>(null);
  const [pendiente, iniciar] = useTransition();

  useEffect(() => {
    if (!cambiando || !fecha) return;
    let vigente = true;
    obtenerHorariosTurno(turno.barberia.slug, turno.barbero_id, turno.servicio_id, fecha, turno.modalidad).then(
      (horas) => vigente && setResultado({ fecha, horas }),
    );
    return () => { vigente = false; };
  }, [cambiando, fecha, turno]);
  const horarios = resultado?.fecha === fecha ? resultado.horas : null;

  const hora = (iso: string) => new Intl.DateTimeFormat("es-AR", { timeZone: tz, timeStyle: "short" }).format(new Date(iso));
  const modificable = turno.puede_modificar && estado === "confirmado";

  function accion(fn: () => Promise<{ ok: boolean; error?: string }>, ok: string, nuevoEstado?: string) {
    setError(null);
    iniciar(async () => {
      const r = await fn();
      if (r.ok) { setMsg(ok); if (nuevoEstado) setEstado(nuevoEstado); setCambiando(false); }
      else setError(r.error ?? "Error");
    });
  }

  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col gap-5 px-4 py-10"
      style={{ "--marca": turno.barberia.color, "--marca-texto": textoSobre(turno.barberia.color) } as React.CSSProperties}>
      <CabeceraMarca nombre={turno.barberia.nombre} logo={urlLogo(turno.barberia.logo_path)} alto={56} />
      <div className="rounded-lg border border-zinc-300 p-4 dark:border-zinc-700">
        <p className="font-medium">{cuando}</p>
        <p>{turno.servicio} con {turno.barbero}</p>
        <p className="text-sm text-zinc-600 dark:text-zinc-400">
          {turno.modalidad === "local"
            ? <a className="underline" target="_blank" rel="noreferrer" href={mapaUrl(turno.barberia.direccion, turno.barberia.lat, turno.barberia.lng)}>📍 {turno.barberia.direccion ?? "Local"}</a>
            : <a className="underline" target="_blank" rel="noreferrer" href={mapaUrl(turno.direccion_turno, turno.lat_turno, turno.lng_turno)}>🏠 {turno.direccion_turno ?? "A domicilio"}</a>}
        </p>
        <p className="mt-2 text-sm">{estado === "cancelado" ? "❌ Cancelado" : estado === "confirmado" ? "✅ Confirmado" : estado}</p>
      </div>

      {msg && <p role="status" className="text-green-700 dark:text-green-400">{msg}</p>}
      {error && <p role="alert" className="text-red-700 dark:text-red-400">{error}</p>}

      {estado === "confirmado" && !modificable && (
        <p className="text-sm text-zinc-600 dark:text-zinc-400">
          Ya no se puede modificar online (hasta {turno.horas_min_cancelacion} h antes). Contactá al barbero.
        </p>
      )}

      {modificable && !cambiando && (
        <div className="flex flex-col gap-2">
          <button onClick={() => setCambiando(true)} className="rounded-lg border border-zinc-300 px-4 py-3 dark:border-zinc-700">Reprogramar</button>
          <button disabled={pendiente} onClick={() => confirm("¿Cancelar el turno?") && accion(() => cancelar(token), "Turno cancelado.", "cancelado")}
            className="rounded-lg px-4 py-3 text-red-700 underline dark:text-red-400">Cancelar turno</button>
        </div>
      )}

      {modificable && cambiando && (
        <div className="flex flex-col gap-3">
          <div className="flex gap-2 overflow-x-auto pb-1">
            {dias.map((d) => (
              <button key={d.fecha} onClick={() => setFecha(d.fecha)}
                className={`shrink-0 rounded-lg border px-3 py-2 text-sm ${fecha === d.fecha ? "border-[var(--marca)] bg-[var(--marca)] text-[var(--marca-texto)]" : "border-zinc-300 dark:border-zinc-700"}`}>{d.etiqueta}</button>
            ))}
          </div>
          {fecha && (horarios === null ? <p className="text-sm text-zinc-500">Buscando…</p>
            : horarios.length === 0 ? <p className="text-sm text-zinc-500">No hay horarios libres ese día.</p>
            : (
              <div className="grid grid-cols-4 gap-2">
                {horarios.map((h) => (
                  <button key={h} disabled={pendiente} onClick={() => accion(() => reprogramar(token, h), `Reprogramado para ${hora(h)}. Te llega un nuevo mail al instante si aplica.`)}
                    className="rounded-lg border border-zinc-300 py-2 text-sm dark:border-zinc-700">{hora(h)}</button>
                ))}
              </div>
            ))}
          <button onClick={() => setCambiando(false)} className="w-fit text-sm underline">Volver</button>
        </div>
      )}
    </main>
  );
}
