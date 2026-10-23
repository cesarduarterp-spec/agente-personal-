"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { textoSobre, urlLogo } from "@/lib/marca";
import { guardarMarca } from "./actions";

const PRESETS = ["#111827", "#b45309", "#15803d", "#1d4ed8", "#7e22ce", "#be123c", "#0f766e", "#374151"];
const campo = "rounded-lg border border-zinc-300 px-3 py-3 dark:border-zinc-700 dark:bg-zinc-900";

// Prepara el logo antes de subirlo:
//  1. recorta los bordes sobrantes (fondo liso o transparente alrededor),
//  2. lo reduce a 512 px y lo vuelve a codificar como PNG, conservando la transparencia.
// Al re-codificar nunca se publica el archivo original (por ejemplo un SVG con scripts).
async function prepararLogo(file: File): Promise<Blob> {
  const bmp = await createImageBitmap(file);
  const e1 = Math.min(1, 1024 / Math.max(bmp.width, bmp.height));
  const w = Math.max(1, Math.round(bmp.width * e1)), h = Math.max(1, Math.round(bmp.height * e1));
  const base = document.createElement("canvas");
  base.width = w; base.height = h;
  const ctx = base.getContext("2d", { willReadFrequently: true })!;
  ctx.drawImage(bmp, 0, 0, w, h);

  // color de fondo = promedio de las cuatro esquinas
  const d = ctx.getImageData(0, 0, w, h).data;
  const px = (x: number, y: number) => { const i = (y * w + x) * 4; return [d[i], d[i + 1], d[i + 2], d[i + 3]]; };
  const esquinas = [px(0, 0), px(w - 1, 0), px(0, h - 1), px(w - 1, h - 1)];
  const fondo = [0, 1, 2, 3].map((c) => esquinas.reduce((t, p) => t + p[c], 0) / 4);
  const transparente = fondo[3] < 20;
  let x0 = w, y0 = h, x1 = -1, y1 = -1;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const [r, g, b, a] = px(x, y);
      const distinto = transparente ? a > 20 : Math.abs(r - fondo[0]) + Math.abs(g - fondo[1]) + Math.abs(b - fondo[2]) > 90;
      if (distinto) { if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; }
    }
  }
  if (x1 < x0 || y1 < y0) { x0 = 0; y0 = 0; x1 = w - 1; y1 = h - 1; } // imagen lisa: no se recorta
  const pad = Math.round(0.06 * Math.max(x1 - x0 + 1, y1 - y0 + 1));
  x0 = Math.max(0, x0 - pad); y0 = Math.max(0, y0 - pad);
  x1 = Math.min(w - 1, x1 + pad); y1 = Math.min(h - 1, y1 + pad);
  const cw = x1 - x0 + 1, ch = y1 - y0 + 1;

  const e2 = Math.min(1, 512 / Math.max(cw, ch));
  const out = document.createElement("canvas");
  out.width = Math.max(1, Math.round(cw * e2)); out.height = Math.max(1, Math.round(ch * e2));
  out.getContext("2d")!.drawImage(base, x0, y0, cw, ch, 0, 0, out.width, out.height);
  return new Promise((res, rej) => out.toBlob((b) => (b ? res(b) : rej(new Error("logo"))), "image/png"));
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
      <p className="text-sm text-zinc-600 dark:text-zinc-400">El logo y el color aparecen en la página donde reservan tus clientes y en los mails que reciben. Si tu logo tiene mucho margen alrededor, se recorta solo.</p>

      <div className="flex items-center gap-4">
        {logo ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={logo} alt="Logo actual" className="h-20 max-w-[60%] rounded-xl border border-zinc-200 object-contain dark:border-zinc-700" />
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
          {logo ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={logo} alt={nombre} className="h-12 max-w-full rounded-lg object-contain" />
          ) : (
            <p className="font-semibold">{nombre}</p>
          )}
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
