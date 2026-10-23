"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import DireccionInput, { type Direccion } from "@/components/DireccionInput";
import { buscarFichas, crearTurnoManual, type FichaCorta } from "./actions";

const campo = "rounded-lg border border-zinc-300 px-3 py-3 dark:border-zinc-700 dark:bg-zinc-900";
type Modo = "local" | "domicilio" | "ambos";

export default function Formulario({
  barberos, servicios, modo, hoy,
}: { barberos: { id: string; nombre: string }[]; servicios: { id: string; nombre: string; precio: number; duracion_min: number }[]; modo: Modo; hoy: string }) {
  const router = useRouter();
  const [pendiente, iniciar] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const [q, setQ] = useState("");
  const [resultados, setResultados] = useState<FichaCorta[]>([]);
  const [elegida, setElegida] = useState<FichaCorta | null>(null);
  const [esNuevo, setEsNuevo] = useState(false);
  const [nuevo, setNuevo] = useState({ nombre: "", apellido: "", telefono: "", email: "" });

  const [barbero, setBarbero] = useState(barberos.length === 1 ? barberos[0].id : "");
  const [servicio, setServicio] = useState("");
  const [fecha, setFecha] = useState(hoy);
  const [hora, setHora] = useState("");
  const [modalidad, setModalidad] = useState<"local" | "domicilio">(modo === "domicilio" ? "domicilio" : "local");
  const [dir, setDir] = useState<Direccion>({ direccion: "", lat: null, lng: null, place_id: null });
  const [indicaciones, setIndicaciones] = useState("");
  const [avisar, setAvisar] = useState(true);

  function buscar() {
    iniciar(async () => setResultados(await buscarFichas(q)));
  }

  function enviar(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!elegida && !esNuevo) return setError("Elegí un cliente o cargá uno nuevo.");
    iniciar(async () => {
      const r = await crearTurnoManual({
        clienteId: elegida?.id ?? null, nuevo, barbero, servicio, fecha, hora, modalidad,
        direccion: dir.direccion, lat: dir.lat, lng: dir.lng, indicaciones, avisarPorMail: avisar,
      });
      if (!r.ok) return setError(r.error);
      router.push("/panel");
      router.refresh();
    });
  }

  return (
    <form onSubmit={enviar} className="flex flex-col gap-6">
      <section className="flex flex-col gap-3">
        <h2 className="font-medium">1. Cliente</h2>
        {elegida ? (
          <p className="rounded-lg border border-zinc-300 p-3 dark:border-zinc-700">
            Ficha #{elegida.numero} · <b>{elegida.nombre} {elegida.apellido}</b> {elegida.telefono}{" "}
            <button type="button" className="ml-2 underline" onClick={() => setElegida(null)}>Cambiar</button>
          </p>
        ) : esNuevo ? (
          <div className="flex flex-col gap-2">
            <div className="grid grid-cols-2 gap-2">
              <input required placeholder="Nombre" value={nuevo.nombre} onChange={(e) => setNuevo({ ...nuevo, nombre: e.target.value })} className={campo} />
              <input placeholder="Apellido" value={nuevo.apellido} onChange={(e) => setNuevo({ ...nuevo, apellido: e.target.value })} className={campo} />
            </div>
            <input type="tel" placeholder="Teléfono" value={nuevo.telefono} onChange={(e) => setNuevo({ ...nuevo, telefono: e.target.value })} className={campo} />
            <input type="email" placeholder="Mail (opcional; para enviarle la confirmación)" value={nuevo.email} onChange={(e) => setNuevo({ ...nuevo, email: e.target.value })} className={campo} />
            <button type="button" className="w-fit text-sm underline" onClick={() => setEsNuevo(false)}>Buscar uno existente</button>
          </div>
        ) : (
          <>
            <div className="flex gap-2">
              <input placeholder="Buscar ficha por nombre, teléfono o n°" value={q} onChange={(e) => setQ(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); buscar(); } }} className={`${campo} flex-1`} />
              <button type="button" onClick={buscar} className="rounded-lg border border-zinc-300 px-4 dark:border-zinc-700">Buscar</button>
            </div>
            {resultados.map((f) => (
              <button type="button" key={f.id} onClick={() => setElegida(f)} className="rounded-lg border border-zinc-300 p-3 text-left hover:bg-zinc-50 dark:border-zinc-700 dark:hover:bg-zinc-900">
                #{f.numero} · <b>{f.nombre} {f.apellido}</b> <span className="text-sm text-zinc-500">{f.telefono}</span>
              </button>
            ))}
            <button type="button" className="w-fit text-sm underline" onClick={() => setEsNuevo(true)}>+ Cliente nuevo</button>
          </>
        )}
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="font-medium">2. Turno</h2>
        {barberos.length > 1 && (
          <select required value={barbero} onChange={(e) => setBarbero(e.target.value)} className={campo}>
            <option value="">Barbero…</option>
            {barberos.map((b) => <option key={b.id} value={b.id}>{b.nombre}</option>)}
          </select>
        )}
        <select required value={servicio} onChange={(e) => setServicio(e.target.value)} className={campo}>
          <option value="">Servicio…</option>
          {servicios.map((s) => <option key={s.id} value={s.id}>{s.nombre} · {s.duracion_min} min · ${s.precio}</option>)}
        </select>
        <div className="grid grid-cols-2 gap-3">
          <input type="date" required value={fecha} onChange={(e) => setFecha(e.target.value)} className={campo} />
          <input type="time" required value={hora} onChange={(e) => setHora(e.target.value)} className={campo} />
        </div>
        {modo === "ambos" && (
          <div className="flex gap-2">
            {(["local", "domicilio"] as const).map((m) => (
              <button key={m} type="button" onClick={() => setModalidad(m)}
                className={`flex-1 rounded-lg border px-3 py-3 ${modalidad === m ? "border-zinc-900 bg-zinc-900 text-white dark:border-white dark:bg-white dark:text-zinc-900" : "border-zinc-300 dark:border-zinc-700"}`}>
                {m === "local" ? "En el local" : "A domicilio"}
              </button>
            ))}
          </div>
        )}
        {modalidad === "domicilio" && (
          <>
            <DireccionInput value={dir} onChange={setDir} />
            <input placeholder="Piso / depto / timbre / indicaciones" value={indicaciones} onChange={(e) => setIndicaciones(e.target.value)} className={campo} />
          </>
        )}
        <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={avisar} onChange={(e) => setAvisar(e.target.checked)} /> Enviar confirmación por mail (si el cliente tiene mail)</label>
      </section>

      {error && <p role="alert" className="text-red-700 dark:text-red-400">{error}</p>}
      <button disabled={pendiente} className="rounded-lg bg-zinc-900 px-4 py-3 font-medium text-white disabled:opacity-60 dark:bg-white dark:text-zinc-900">
        {pendiente ? "Guardando…" : "Cargar turno"}
      </button>
    </form>
  );
}
