"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import DireccionInput, { type Direccion } from "@/components/DireccionInput";
import HorarioSemanal, { type Franja } from "@/components/HorarioSemanal";
import { crearBarberia } from "./actions";

const campo = "min-w-0 rounded-lg border border-zinc-300 px-3 py-3 dark:border-zinc-700 dark:bg-zinc-900";
const sinDireccion: Direccion = { direccion: "", lat: null, lng: null, place_id: null };

type Modo = "local" | "domicilio" | "ambos";
type Servicio = { nombre: string; precio: string; duracion_min: string };

function slugify(s: string) {
  return s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 40);
}

export default function Formulario() {
  const router = useRouter();
  const [pendiente, iniciar] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const [nombre, setNombre] = useState("");
  const [slug, setSlug] = useState("");
  const [slugEditado, setSlugEditado] = useState(false);
  const [modo, setModo] = useState<Modo>("local");
  const [dir, setDir] = useState<Direccion>(sinDireccion);
  const [radio, setRadio] = useState("5");
  const [recargo, setRecargo] = useState("0");
  const [buffer, setBuffer] = useState("20");
  const [servicios, setServicios] = useState<Servicio[]>([{ nombre: "Corte", precio: "", duracion_min: "30" }]);
  // por defecto lunes a sábado, con corte al mediodía (ej: 9 a 14 y 17 a 20)
  const [rangos, setRangos] = useState<Franja[]>(
    [1, 2, 3, 4, 5, 6].flatMap((d) => [{ dia_semana: d, desde: "09:00", hasta: "14:00" }, { dia_semana: d, desde: "17:00", hasta: "20:00" }]),
  );

  const conLocal = modo !== "domicilio";
  const conDomicilio = modo !== "local";

  function actualizarServicio(i: number, parche: Partial<Servicio>) {
    setServicios((l) => l.map((s, j) => (j === i ? { ...s, ...parche } : s)));
  }

  function enviar(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    iniciar(async () => {
      const r = await crearBarberia({
        nombre,
        slug,
        modo,
        direccion: dir.direccion,
        lat: dir.lat,
        lng: dir.lng,
        place_id: dir.place_id,
        radio_cobertura_km: radio ? Number(radio) : null,
        recargo_traslado: Number(recargo) || 0,
        buffer_traslado_min: Number(buffer) || 0,
        servicios: servicios.map((s) => ({ nombre: s.nombre, precio: Number(s.precio) || 0, duracion_min: Number(s.duracion_min) })),
        horarios: rangos,
      });
      if (r.ok) {
        router.push("/panel");
        router.refresh();
      } else setError(r.error);
    });
  }

  return (
    <form onSubmit={enviar} className="mx-auto flex w-full max-w-xl flex-1 flex-col gap-8 px-4 py-10">
      <div>
        <h1 className="text-2xl font-semibold">Armá tu barbería</h1>
        <p className="text-zinc-600 dark:text-zinc-400">Menos de 5 minutos. Después lo podés editar.</p>
      </div>

      <section className="flex flex-col gap-3">
        <h2 className="font-medium">1. Tu barbería</h2>
        <input required placeholder="Nombre (ej: Barbería Juan)" value={nombre} className={campo}
          onChange={(e) => { setNombre(e.target.value); if (!slugEditado) setSlug(slugify(e.target.value)); }} />
        <label className="flex flex-col gap-1 text-sm">
          Tu link de reservas
          <span className="flex items-center gap-1">
            <span className="text-zinc-500">tudominio.com/</span>
            <input required value={slug} className={`${campo} flex-1`}
              onChange={(e) => { setSlug(slugify(e.target.value)); setSlugEditado(true); }} />
          </span>
        </label>
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="font-medium">2. ¿Cómo trabajás?</h2>
        {([["local", "Tengo un local"], ["domicilio", "Voy a domicilio"], ["ambos", "Las dos"]] as const).map(([v, t]) => (
          <label key={v} className="flex items-center gap-2 rounded-lg border border-zinc-300 p-3 dark:border-zinc-700">
            <input type="radio" name="modo" checked={modo === v} onChange={() => setModo(v)} /> {t}
          </label>
        ))}

        <div className="flex flex-col gap-2">
          <p className="text-sm">
            {conLocal
              ? "Dirección de tu local (le llega al cliente en el mail, con el mapa)"
              : "Punto base de tu zona de trabajo (opcional; no se muestra a los clientes)"}
          </p>
          <DireccionInput value={dir} onChange={setDir} />
        </div>
        {conDomicilio && (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <label className="flex flex-col gap-1 text-sm">Radio de cobertura (km)
              <input type="number" min="0" step="0.5" value={radio} onChange={(e) => setRadio(e.target.value)} className={campo} />
            </label>
            <label className="flex flex-col gap-1 text-sm">Adicional de traslado ($)
              <input type="number" min="0" value={recargo} onChange={(e) => setRecargo(e.target.value)} className={campo} />
            </label>
            <label className="flex flex-col gap-1 text-sm">Tiempo de traslado (min)
              <input type="number" min="0" value={buffer} onChange={(e) => setBuffer(e.target.value)} className={campo} />
            </label>
            <p className="text-sm text-zinc-600 sm:col-span-3 dark:text-zinc-400">
              El radio se mide desde la dirección de arriba. Sin un punto elegido en el mapa, no se limita la zona.
            </p>
          </div>
        )}
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="font-medium">3. Servicios</h2>
        {servicios.map((s, i) => (
          <div key={i} className="grid grid-cols-[1fr_6rem_5rem_auto] items-center gap-2">
            <input required placeholder="Servicio" value={s.nombre} onChange={(e) => actualizarServicio(i, { nombre: e.target.value })} className={campo} />
            <input required type="number" min="0" placeholder="$" value={s.precio} onChange={(e) => actualizarServicio(i, { precio: e.target.value })} className={campo} />
            <input required type="number" min="5" max="480" placeholder="min" value={s.duracion_min} onChange={(e) => actualizarServicio(i, { duracion_min: e.target.value })} className={campo} />
            <button type="button" aria-label="Quitar servicio" disabled={servicios.length === 1}
              onClick={() => setServicios((l) => l.filter((_, j) => j !== i))} className="px-2 disabled:opacity-30">✕</button>
          </div>
        ))}
        <button type="button" className="w-fit text-sm underline"
          onClick={() => setServicios((l) => [...l, { nombre: "", precio: "", duracion_min: "30" }])}>+ Agregar servicio</button>
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="font-medium">4. Horarios de atención</h2>
        <p className="text-sm text-zinc-600 dark:text-zinc-400">Podés poner más de una franja por día (por ejemplo 9 a 14 y 17 a 20). Después lo podés cambiar en la pestaña Horarios.</p>
        <HorarioSemanal rangos={rangos} onChange={setRangos} />
      </section>

      {error && <p role="alert" className="text-red-700 dark:text-red-400">{error}</p>}
      <button disabled={pendiente} className="rounded-lg bg-zinc-900 px-4 py-3 font-medium text-white disabled:opacity-60 dark:bg-white dark:text-zinc-900">
        {pendiente ? "Creando…" : "Crear mi barbería"}
      </button>
    </form>
  );
}
