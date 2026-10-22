"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { guardarCorte } from "./actions";

const campo = "rounded-lg border border-zinc-300 px-3 py-3 dark:border-zinc-700 dark:bg-zinc-900";

// Reduce la foto a ~1280 px y JPEG: ahorra datos del celular y espacio de almacenamiento.
async function comprimir(file: File): Promise<Blob> {
  const bmp = await createImageBitmap(file);
  const escala = Math.min(1, 1280 / Math.max(bmp.width, bmp.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bmp.width * escala);
  canvas.height = Math.round(bmp.height * escala);
  canvas.getContext("2d")!.drawImage(bmp, 0, 0, canvas.width, canvas.height);
  return new Promise((res, rej) => canvas.toBlob((b) => (b ? res(b) : rej(new Error("compresión"))), "image/jpeg", 0.8));
}

export default function CorteForm({
  barberiaId, clienteId, servicios, hoy,
}: { barberiaId: string; clienteId: string; servicios: string[]; hoy: string }) {
  const router = useRouter();
  const [fecha, setFecha] = useState(hoy);
  const [servicio, setServicio] = useState("");
  const [nota, setNota] = useState("");
  const [precio, setPrecio] = useState("");
  const [archivos, setArchivos] = useState<File[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [pendiente, iniciar] = useTransition();

  function enviar(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    setError(null);
    iniciar(async () => {
      const supabase = createClient();
      const rutas: string[] = [];
      try {
        for (const f of archivos) {
          const ruta = `${barberiaId}/${clienteId}/${crypto.randomUUID()}.jpg`;
          const { error } = await supabase.storage.from("cortes").upload(ruta, await comprimir(f), { contentType: "image/jpeg" });
          if (error) throw error;
          rutas.push(ruta);
        }
      } catch {
        if (rutas.length) await supabase.storage.from("cortes").remove(rutas);
        return setError("No pudimos subir las fotos. Probá de nuevo.");
      }
      const r = await guardarCorte(clienteId, { fecha, servicio, nota, precio, fotos: rutas });
      if (!r.ok) {
        if (rutas.length) await supabase.storage.from("cortes").remove(rutas);
        return setError(r.error);
      }
      form.reset();
      setServicio(""); setNota(""); setPrecio(""); setArchivos([]);
      router.refresh();
    });
  }

  return (
    <form onSubmit={enviar} className="flex flex-col gap-3 rounded-lg border border-zinc-300 p-4 dark:border-zinc-700">
      <h3 className="font-medium">Registrar corte</h3>
      <div className="grid grid-cols-2 gap-3">
        <input type="date" required value={fecha} onChange={(e) => setFecha(e.target.value)} className={campo} />
        <input type="number" min="0" placeholder="Precio $" value={precio} onChange={(e) => setPrecio(e.target.value)} className={campo} />
      </div>
      <input list="servicios-lista" placeholder="Servicio (corte, barba…)" value={servicio} onChange={(e) => setServicio(e.target.value)} className={campo} />
      <datalist id="servicios-lista">{servicios.map((s) => <option key={s} value={s} />)}</datalist>
      <textarea rows={3} placeholder="Nota del corte (ej: degradé 1 abajo, 3 arriba, tijera arriba)" value={nota} onChange={(e) => setNota(e.target.value)} className={campo} />
      <input type="file" accept="image/*" multiple onChange={(e) => setArchivos(Array.from(e.target.files ?? []).slice(0, 6))} />
      {archivos.length > 0 && <p className="text-sm text-zinc-500">{archivos.length} foto(s) (máx. 6)</p>}
      {error && <p role="alert" className="text-red-700 dark:text-red-400">{error}</p>}
      <button disabled={pendiente} className="rounded-lg bg-zinc-900 px-4 py-3 font-medium text-white disabled:opacity-60 dark:bg-white dark:text-zinc-900">
        {pendiente ? "Guardando…" : "Guardar corte"}
      </button>
    </form>
  );
}
