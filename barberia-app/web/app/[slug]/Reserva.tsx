"use client";

import { peso } from "@/lib/format";
import { mapaUrl, textoSobre, urlLogo } from "@/lib/marca";
import CabeceraMarca from "@/components/CabeceraMarca";
import { useEffect, useRef, useState, useTransition } from "react";
import Script from "next/script";
import Link from "next/link";
import DireccionInput, { type Direccion } from "@/components/DireccionInput";
import type { Dia } from "@/lib/public";
import { obtenerHorarios, reservar } from "./actions";

export type Perfil = {
  slug: string; nombre: string; modo: "local" | "domicilio" | "ambos";
  direccion: string | null; lat: number | null; lng: number | null;
  radio_cobertura_km: number | null; recargo_traslado: number | null;
  horas_min_cancelacion: number; banner: string | null; timezone: string; color: string; logo_path: string | null;
  barberos: { id: string; nombre: string }[];
  servicios: { id: string; nombre: string; precio: number; duracion_min: number }[];
};

declare global {
  interface Window {
    turnstile?: { render: (el: HTMLElement, o: { sitekey: string; callback: (t: string) => void; "expired-callback": () => void }) => void };
  }
}

const SITEKEY = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY;
const campo = "rounded-lg border border-zinc-300 px-3 py-3 dark:border-zinc-700 dark:bg-zinc-900";
const LS = "datos-cliente";

export default function Reserva({ perfil, dias }: { perfil: Perfil; dias: Dia[] }) {
  const { servicios, barberos } = perfil;
  const [servicio, setServicio] = useState(servicios.length === 1 ? servicios[0].id : "");
  const [barbero, setBarbero] = useState(barberos.length === 1 ? barberos[0].id : "");
  const [modalidad, setModalidad] = useState<"local" | "domicilio">(perfil.modo === "domicilio" ? "domicilio" : "local");
  const [fecha, setFecha] = useState(dias[0].fecha);
  const [version, setVersion] = useState(0); // sube cuando hay que volver a pedir horarios
  const [resultado, setResultado] = useState<{ clave: string; horas: string[] } | null>(null);
  const [elegido, setInicio] = useState("");

  const [nombre, setNombre] = useState("");
  const [apellido, setApellido] = useState("");
  const [telefono, setTelefono] = useState("");
  const [email, setEmail] = useState("");
  const [dir, setDir] = useState<Direccion>({ direccion: "", lat: null, lng: null, place_id: null });
  const [indicaciones, setIndicaciones] = useState("");
  const [consentimiento, setConsentimiento] = useState(false);
  const [turnstile, setTurnstile] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pendiente, iniciar] = useTransition();
  const [hecho, setHecho] = useState<string | null>(null);
  const tsEl = useRef<HTMLDivElement>(null);

  // el navegador recuerda los datos del cliente para que la próxima reserva sea de un toque
  useEffect(() => {
    queueMicrotask(() => {
      try {
        const g = JSON.parse(localStorage.getItem(LS) ?? "null");
        if (g) { setNombre(g.nombre ?? ""); setApellido(g.apellido ?? ""); setTelefono(g.telefono ?? ""); setEmail(g.email ?? ""); }
      } catch {}
    });
  }, []);

  const clave = `${servicio}|${barbero}|${fecha}|${modalidad}|${version}`;
  useEffect(() => {
    if (!servicio || !barbero) return;
    let vigente = true;
    obtenerHorarios(perfil.slug, barbero, servicio, fecha, modalidad).then((horas) => vigente && setResultado({ clave, horas }));
    return () => { vigente = false; };
  }, [perfil.slug, servicio, barbero, fecha, modalidad, clave]);
  const horarios = resultado?.clave === clave ? resultado.horas : null;
  const inicio = horarios?.includes(elegido) ? elegido : "";

  function montarTurnstile() {
    if (SITEKEY && tsEl.current && window.turnstile && !tsEl.current.hasChildNodes())
      window.turnstile.render(tsEl.current, { sitekey: SITEKEY, callback: setTurnstile, "expired-callback": () => setTurnstile("") });
  }

  const hora = (iso: string) => new Intl.DateTimeFormat("es-AR", { timeZone: perfil.timezone, timeStyle: "short" }).format(new Date(iso));
  const svc = servicios.find((s) => s.id === servicio);

  function enviar(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!inicio) return setError("Elegí un horario.");
    if (modalidad === "domicilio" && dir.lat == null) return setError("Elegí tu dirección de la lista para ubicarla en el mapa.");
    iniciar(async () => {
      const r = await reservar({
        slug: perfil.slug, barbero, servicio, inicio, modalidad, nombre, apellido, telefono, email,
        direccion: dir.direccion, lat: dir.lat, lng: dir.lng, indicaciones, consentimiento, turnstile,
      });
      if (r.ok) {
        try { localStorage.setItem(LS, JSON.stringify({ nombre, apellido, telefono, email })); } catch {}
        setHecho(r.token);
      } else {
        setError(r.error);
        if (r.error.startsWith("Ese horario")) setVersion((v) => v + 1);
      }
    });
  }

  if (hecho)
    return (
      <main className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center gap-4 px-4 py-10">
        <h1 className="text-2xl font-semibold">¡Listo, turno confirmado! ✅</h1>
        <p>Te enviamos el detalle a <b>{email}</b>. Revisá también el spam.</p>
        <Link className="underline" href={`/turno/${hecho}`}>Reprogramar o cancelar</Link>
      </main>
    );

  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col gap-6 px-4 py-8"
      style={{ "--marca": perfil.color, "--marca-texto": textoSobre(perfil.color) } as React.CSSProperties}>
      {SITEKEY && <Script src="https://challenges.cloudflare.com/turnstile/v0/api.js" strategy="afterInteractive" onLoad={montarTurnstile} />}
      <CabeceraMarca nombre={perfil.nombre} logo={urlLogo(perfil.logo_path)} alto={72}>
        {perfil.direccion && (
          <a className="text-sm text-zinc-600 underline dark:text-zinc-400" target="_blank" rel="noreferrer" href={mapaUrl(perfil.direccion, perfil.lat, perfil.lng)}>
            📍 {perfil.direccion}
          </a>
        )}
      </CabeceraMarca>
      {perfil.banner && <p className="rounded-lg bg-amber-100 p-3 text-amber-900">{perfil.banner}</p>}

      <form onSubmit={enviar} className="flex flex-col gap-6">
        <section className="flex flex-col gap-2">
          <h2 className="font-medium">1. Servicio</h2>
          {servicios.map((s) => (
            <label key={s.id} className={`flex cursor-pointer items-center justify-between rounded-lg border p-3 ${servicio === s.id ? "border-[var(--marca)] ring-1 ring-[var(--marca)]" : "border-zinc-300 dark:border-zinc-700"}`}>
              <span><input type="radio" className="mr-2" name="servicio" checked={servicio === s.id} onChange={() => setServicio(s.id)} />{s.nombre} <span className="text-sm text-zinc-500">· {s.duracion_min} min</span></span>
              <span className="font-medium">{peso(s.precio)}</span>
            </label>
          ))}
        </section>

        {barberos.length > 1 && (
          <section className="flex flex-col gap-2">
            <h2 className="font-medium">Barbero</h2>
            <select required value={barbero} onChange={(e) => setBarbero(e.target.value)} className={campo}>
              <option value="">Elegí…</option>
              {barberos.map((b) => <option key={b.id} value={b.id}>{b.nombre}</option>)}
            </select>
          </section>
        )}

        {perfil.modo === "ambos" && (
          <section className="flex gap-2">
            {(["local", "domicilio"] as const).map((m) => (
              <button key={m} type="button" onClick={() => setModalidad(m)}
                className={`flex-1 rounded-lg border px-3 py-3 ${modalidad === m ? "border-[var(--marca)] bg-[var(--marca)] text-[var(--marca-texto)]" : "border-zinc-300 dark:border-zinc-700"}`}>
                {m === "local" ? "En el local" : "A domicilio"}
              </button>
            ))}
          </section>
        )}

        <section className="flex flex-col gap-2">
          <h2 className="font-medium">2. Día y hora</h2>
          <div className="flex gap-2 overflow-x-auto pb-1">
            {dias.map((d) => (
              <button key={d.fecha} type="button" onClick={() => setFecha(d.fecha)}
                className={`shrink-0 rounded-lg border px-3 py-2 text-sm ${fecha === d.fecha ? "border-[var(--marca)] bg-[var(--marca)] text-[var(--marca-texto)]" : "border-zinc-300 dark:border-zinc-700"}`}>
                {d.etiqueta}
              </button>
            ))}
          </div>
          {!servicio || !barbero ? <p className="text-sm text-zinc-500">Elegí servicio{barberos.length > 1 ? " y barbero" : ""} para ver horarios.</p>
            : horarios === null ? <p className="text-sm text-zinc-500">Buscando horarios…</p>
            : horarios.length === 0 ? <p className="text-sm text-zinc-500">No hay horarios libres ese día. Probá con otro.</p>
            : (
              <div className="grid grid-cols-4 gap-2">
                {horarios.map((h) => (
                  <button key={h} type="button" onClick={() => setInicio(h)}
                    className={`rounded-lg border py-2 text-sm ${inicio === h ? "border-[var(--marca)] bg-[var(--marca)] text-[var(--marca-texto)]" : "border-zinc-300 dark:border-zinc-700"}`}>
                    {hora(h)}
                  </button>
                ))}
              </div>
            )}
        </section>

        {modalidad === "domicilio" && (
          <section className="flex flex-col gap-2">
            <h2 className="font-medium">¿Dónde te corta?</h2>
            <DireccionInput value={dir} onChange={setDir} permitirUbicacion />
            <input placeholder="Piso / depto / timbre / indicaciones" value={indicaciones} onChange={(e) => setIndicaciones(e.target.value)} className={campo} />
            {!!perfil.recargo_traslado && <p className="text-sm text-zinc-500">Incluye {peso(perfil.recargo_traslado)} de traslado.</p>}
          </section>
        )}

        <section className="flex flex-col gap-2">
          <h2 className="font-medium">3. Tus datos</h2>
          <div className="grid grid-cols-2 gap-2">
            <input required autoComplete="given-name" placeholder="Nombre" value={nombre} onChange={(e) => setNombre(e.target.value)} className={campo} />
            <input autoComplete="family-name" placeholder="Apellido" value={apellido} onChange={(e) => setApellido(e.target.value)} className={campo} />
          </div>
          <input required type="tel" autoComplete="tel" placeholder="Teléfono" value={telefono} onChange={(e) => setTelefono(e.target.value)} className={campo} />
          <input required type="email" autoComplete="email" placeholder="Mail (te llega la confirmación)" value={email} onChange={(e) => setEmail(e.target.value)} className={campo} />
          <label className="flex items-start gap-2 text-sm">
            <input required type="checkbox" className="mt-1" checked={consentimiento} onChange={(e) => setConsentimiento(e.target.checked)} />
            Acepto que el barbero guarde mis datos (y fotos de mis cortes) para su historial.
          </label>
        </section>

        {SITEKEY && <div ref={tsEl} />}
        {error && <p role="alert" className="text-red-700 dark:text-red-400">{error}</p>}
        <button disabled={pendiente || !inicio || (!!SITEKEY && !turnstile)}
          className="rounded-lg bg-[var(--marca)] px-4 py-3 font-medium text-[var(--marca-texto)] disabled:opacity-50">
          {pendiente ? "Reservando…" : svc ? `Reservar · ${peso(svc.precio + (modalidad === "domicilio" ? perfil.recargo_traslado ?? 0 : 0))}` : "Reservar"}
        </button>
        <p className="text-center text-xs text-zinc-500">Reprogramar o cancelar es gratis hasta {perfil.horas_min_cancelacion} h antes.</p>
      </form>
    </main>
  );
}
