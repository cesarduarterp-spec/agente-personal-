import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { ventana } from "@/lib/panel";

type Plan = { estado: string; prueba_hasta: string | null; periodo_hasta: string | null; habilitada: boolean; cobro_activo: boolean };

// Franja de aviso sobre el estado del plan, arriba del panel del barbero.
export default async function BannerPlan() {
  const supabase = await createClient();
  const { data } = await supabase.rpc("mi_plan");
  const p = data as Plan | null;
  if (!p) return null;

  const ahora = Date.parse(ventana(0).desde);
  const dias = (iso: string | null) => (iso ? Math.ceil((new Date(iso).getTime() - ahora) / 864e5) : 0);
  const base = "px-4 py-2 text-center text-sm";
  const enlace = <Link href="/panel/plan" className="ml-2 font-medium underline">Ver mi plan</Link>;

  if (p.estado === "suspendida") return <p className={`${base} bg-red-100 text-red-900`}>Tu cuenta está suspendida y tus clientes no pueden reservar. Contactanos para resolverlo.{enlace}</p>;
  if (!p.habilitada) return <p className={`${base} bg-red-100 text-red-900`}>Tu plan venció y tus clientes no pueden reservar.{enlace}</p>;
  if (p.estado === "prueba") {
    const d = dias(p.prueba_hasta);
    return <p className={`${base} ${d <= 7 && p.cobro_activo ? "bg-amber-100 text-amber-900" : "bg-zinc-100 text-zinc-700 dark:bg-zinc-900 dark:text-zinc-300"}`}>
      Prueba gratis: te {d === 1 ? "queda 1 día" : `quedan ${Math.max(d, 0)} días`}.{enlace}</p>;
  }
  if (p.estado === "activa" && p.periodo_hasta && dias(p.periodo_hasta) <= 5 && dias(p.periodo_hasta) >= 0)
    return <p className={`${base} bg-amber-100 text-amber-900`}>Tu plan vence en {dias(p.periodo_hasta)} día(s).{enlace}</p>;
  return null;
}
