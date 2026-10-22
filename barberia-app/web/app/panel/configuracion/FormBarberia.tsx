"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import DireccionInput, { type Direccion } from "@/components/DireccionInput";
import { guardarBarberia, type DatosBarberia } from "./actions";

const campo = "rounded-lg border border-zinc-300 px-3 py-3 dark:border-zinc-700 dark:bg-zinc-900";

type B = {
  id: string; slug: string; nombre: string; modo: DatosBarberia["modo"]; direccion: string | null;
  lat: number | null; lng: number | null; place_id: string | null;
  radio_cobertura_km: number | null; recargo_traslado: number; buffer_traslado_min: number;
  horas_min_cancelacion: number; anticipacion_min: number; banner_activo: boolean; banner_texto: string | null;
};

export default function FormBarberia({ b }: { b: B }) {
  const router = useRouter();
  const [nombre, setNombre] = useState(b.nombre);
  const [modo, setModo] = useState(b.modo);
  const [dir, setDir] = useState<Direccion>({ direccion: b.direccion ?? "", lat: b.lat, lng: b.lng, place_id: b.place_id });
  const [radio, setRadio] = useState(b.radio_cobertura_km?.toString() ?? "");
  const [recargo, setRecargo] = useState(String(b.recargo_traslado));
  const [buffer, setBuffer] = useState(String(b.buffer_traslado_min));
  const [horas, setHoras] = useState(String(b.horas_min_cancelacion));
  const [antic, setAntic] = useState(String(b.anticipacion_min));
  const [bannerOn, setBannerOn] = useState(b.banner_activo);
  const [banner, setBanner] = useState(b.banner_texto ?? "");
  const [msg, setMsg] = useState<{ ok: boolean; texto: string } | null>(null);
  const [pendiente, iniciar] = useTransition();

  function enviar(e: React.FormEvent) {
    e.preventDefault();
    setMsg(null);
    iniciar(async () => {
      const r = await guardarBarberia(b.id, {
        nombre, modo, direccion: dir.direccion, lat: dir.lat, lng: dir.lng, place_id: dir.place_id,
        radio_cobertura_km: radio, recargo_traslado: recargo, buffer_traslado_min: buffer,
        horas_min_cancelacion: horas, anticipacion_min: antic, banner_activo: bannerOn, banner_texto: banner,
      });
      setMsg(r.ok ? { ok: true, texto: "Cambios guardados." } : { ok: false, texto: r.error });
      if (r.ok) router.refresh();
    });
  }

  return (
    <form onSubmit={enviar} className="flex flex-col gap-4">
      <h2 className="text-lg font-medium">Tu barbería</h2>
      <input required value={nombre} onChange={(e) => setNombre(e.target.value)} className={campo} aria-label="Nombre" />
      <p className="text-sm text-zinc-500">Tu link de reservas: /{b.slug} (no cambia, para no romper los links ya compartidos).</p>

      <div className="flex flex-col gap-2">
        {([["local", "Tengo un local"], ["domicilio", "Voy a domicilio"], ["ambos", "Las dos"]] as const).map(([v, t]) => (
          <label key={v} className="flex items-center gap-2 rounded-lg border border-zinc-300 p-3 dark:border-zinc-700">
            <input type="radio" name="modo" checked={modo === v} onChange={() => setModo(v)} /> {t}
          </label>
        ))}
      </div>

      <div className="flex flex-col gap-2">
        <p className="text-sm">{modo === "domicilio" ? "Punto base de tu zona (opcional, no se muestra a clientes)" : "Dirección del local"}</p>
        <DireccionInput value={dir} onChange={setDir} />
      </div>

      {modo !== "local" && (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <label className="flex flex-col gap-1 text-sm">Radio de cobertura (km)<input type="number" min="0" step="0.5" value={radio} onChange={(e) => setRadio(e.target.value)} className={campo} /></label>
          <label className="flex flex-col gap-1 text-sm">Adicional de traslado ($)<input type="number" min="0" value={recargo} onChange={(e) => setRecargo(e.target.value)} className={campo} /></label>
          <label className="flex flex-col gap-1 text-sm">Tiempo de traslado (min)<input type="number" min="0" value={buffer} onChange={(e) => setBuffer(e.target.value)} className={campo} /></label>
        </div>
      )}

      <div className="grid grid-cols-2 gap-3">
        <label className="flex flex-col gap-1 text-sm">Cancelar gratis hasta (horas antes)<input type="number" min="0" value={horas} onChange={(e) => setHoras(e.target.value)} className={campo} /></label>
        <label className="flex flex-col gap-1 text-sm">Reserva con anticipación mínima (min)<input type="number" min="0" value={antic} onChange={(e) => setAntic(e.target.value)} className={campo} /></label>
      </div>

      <div className="flex flex-col gap-2 rounded-lg border border-zinc-300 p-3 dark:border-zinc-700">
        <label className="flex items-center gap-2 font-medium"><input type="checkbox" checked={bannerOn} onChange={(e) => setBannerOn(e.target.checked)} /> Mostrar banner de promo en la reserva</label>
        <input placeholder="Ej: Martes y miércoles 20% off en corte + barba" value={banner} onChange={(e) => setBanner(e.target.value)} className={campo} />
      </div>

      {msg && <p role="status" className={msg.ok ? "text-green-700 dark:text-green-400" : "text-red-700 dark:text-red-400"}>{msg.texto}</p>}
      <button disabled={pendiente} className="rounded-lg bg-zinc-900 px-4 py-3 font-medium text-white disabled:opacity-60 dark:bg-white dark:text-zinc-900">
        {pendiente ? "Guardando…" : "Guardar cambios"}
      </button>
    </form>
  );
}
