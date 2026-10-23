"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { textoSobre, urlLogo } from "@/lib/marca";
import { guardarMarca } from "./actions";

const PRESETS = ["#111827", "#b45309", "#15803d", "#1d4ed8", "#7e22ce", "#be123c", "#0f766e", "#374151"];
const campo = "rounded-lg border border-zinc-300 px-3 py-3 dark:border-zinc-700 dark:bg-zinc-900";

// Reduce el logo a 512 px conservando la transparencia. Se vuelve a codificar como PNG:
// así no se publica nunca el archivo original (por ejemplo un SVG con scripts).
async function prepararLogo(file: File): Promise<Blob> {
  const bmp = await createImageBitmap(file);
  const escala = Math.min(1, 512 / Math.max(bmp.width, bmp.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bmp.width * escala);
  canvas.height = Math.round(bmp.height * escala);
  canvas.getContext("2d")!.drawImage(bmp, 0, 0, canvas.width, canvas.height);
  return new Promise((res, rej) => canvas.toBlob((b) => (b ? res(b) : rej(new Error("logo"))), "image/png"));
}

export default function Marca({ barberiaId, nombre, colorInicial, logoInicial }: { barberiaId: string; nombre: string; colorInicial: string; logoInicial: string | null }) {
  const router = useRouter();
  const [color, setColor] = useState(colorInicial);
  const [logoPath, setLogoPath] = useState<string | null>(logoInicial);
  const [msg, setMsg] = useState<{ ok: boolean; texto: string } | null>(null);
  const [pendiente, iniciar] = useTransition();
  const valido = /^#[0-9a-fA-F]{6}$/.test(color);
  const logo = urlLogo(logoPath);

  function subir(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    e.target.value = "";
    if (!f) return;
    if (!["image/png", "image/jpeg", "image/webp"].includes(f.type)) return setMsg({ ok: false, texto: "Usá una imagen PNG, JPG o WebP." });
    if (f.size > 8 * 1024 * 1024) return setMsg({ ok: false, texto: "La imagen pesa demasiado (máximo 8 MB)." });
    setMsg(null);
    iniciar(async () => {
      const supabase = createClient();
      const ruta = `${barberiaId}/logo-${Date.now()}.png`;
      try {
        const { error } = await supabase.storage.from("marcas").upload(ruta, await prepararLogo(f), { contentType: "image/png" });
        if (error) throw error;
      } catch {
        return setMsg({ ok: false, texto: "No pudimos subir el logo. Probá con otra imagen." });
      }
      const r = await guardarMarca(barberiaId, valido ? color : colorInicial, ruta);
      if (!r.ok) {
        await supabase.storage.from("marcas").remove([ruta]);
        return setMsg({ ok: false, texto: r.error });
      }
      setLogoPath(ruta);
      setMsg({ ok: true, texto: "Logo actualizado." });
      router.refresh();
    });
  }

  function quitar() {
    setMsg(null);
    iniciar(async () => {
      const r = await guardarMarca(barberiaId, valido ? color : colorInicial, null);
      if (r.ok) { setLogoPath(null); router.refresh(); } else setMsg({ ok: false, texto: r.error });
    });
  }

  function guardarColor() {
    setMsg(null);
    iniciar(async () => {
      const r = await guardarMarca(barberiaId, color, undefined);
      setMsg(r.ok ? { ok: true, texto: "Color guardado." } : { ok: false, texto: r.error });
      if (r.ok) router.refresh();
    });
  }

  return (
    <section className="flex flex-col gap-4">
      <h2 className="text-lg font-medium">Tu marca</h2>
      <p className="text-sm text-zinc-600 dark:text-zinc-400">El logo y el color aparecen en la página donde reservan tus clientes y en los mails que reciben.</p>

      <div className="flex items-center gap-4">
        {logo ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={logo} alt="Logo actual" className="h-20 w-20 rounded-xl border border-zinc-200 object-contain dark:border-zinc-700" />
        ) : (
          <div className="flex h-20 w-20 items-center justify-center rounded-xl border border-dashed border-zinc-300 text-xs text-zinc-500 dark:border-zinc-700">Sin logo</div>
        )}
        <div className="flex flex-col gap-2 text-sm">
          <label className="w-fit cursor-pointer rounded-lg border border-zinc-300 px-4 py-2 font-medium dark:border-zinc-700">
            {logo ? "Cambiar logo" : "Subir logo"}
            <input type="file" accept="image/png,image/jpeg,image/webp" className="hidden" onChange={subir} disabled={pendiente} />
          </label>
          {logo && <button type="button" onClick={quitar} disabled={pendiente} className="w-fit text-red-700 underline dark:text-red-400">Quitar logo</button>}
        </div>
      </div>

      <div className="flex flex-col gap-2">
        <p className="text-sm font-medium">Color de la marca</p>
        <div className="flex flex-wrap items-center gap-2">
          {PRESETS.map((c) => (
            <button key={c} type="button" aria-label={`Color ${c}`} onClick={() => setColor(c)}
              className={`h-9 w-9 rounded-full border-2 ${color.toLowerCase() === c ? "border-zinc-900 dark:border-white" : "border-transparent"}`} style={{ background: c }} />
          ))}
          <input type="color" aria-label="Elegir otro color" value={valido ? color : "#111827"} onChange={(e) => setColor(e.target.value)} className="h-9 w-12 cursor-pointer rounded-lg border border-zinc-300 bg-transparent p-0.5 dark:border-zinc-700" />
          <input value={color} onChange={(e) => setColor(e.target.value)} maxLength={7} className={`${campo} w-28 py-2 font-mono text-sm`} aria-label="Código del color" />
        </div>
      </div>

      <div className="rounded-lg border border-zinc-200 p-4 dark:border-zinc-700">
        <p className="mb-2 text-xs uppercase tracking-wide text-zinc-500">Así lo ven tus clientes</p>
        <div className="flex items-center gap-3">
          {logo && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={logo} alt="" className="h-10 w-10 rounded-lg object-contain" />
          )}
          <p className="font-semibold">{nombre}</p>
        </div>
        <div className="mt-3 flex gap-2">
          <span className="rounded-lg px-4 py-2 text-sm font-medium" style={{ background: valido ? color : "#111827", color: textoSobre(valido ? color : "#111827") }}>Reservar · $ 10.000</span>
          <span className="rounded-lg border px-3 py-2 text-sm" style={{ borderColor: valido ? color : "#111827" }}>12:30</span>
        </div>
      </div>

      {msg && <p role="status" className={msg.ok ? "text-green-700 dark:text-green-400" : "text-red-700 dark:text-red-400"}>{msg.texto}</p>}
      <button type="button" onClick={guardarColor} disabled={pendiente || !valido || color.toLowerCase() === colorInicial.toLowerCase()}
        className="rounded-lg bg-zinc-900 px-4 py-3 font-medium text-white disabled:opacity-50 dark:bg-white dark:text-zinc-900">
        {pendiente ? "Guardando…" : "Guardar color"}
      </button>
    </section>
  );
}
