import { cargarPanel } from "@/lib/panel";
import { dinero, fecha, fechaHora } from "@/lib/format";

export const dynamic = "force-dynamic";

type Plan = { barberia_id: string; estado: string; prueba_hasta: string | null; periodo_hasta: string | null; proveedor: string; habilitada: boolean; cobro_activo: boolean };
const ESTADOS: Record<string, string> = { prueba: "Prueba gratis", activa: "Plan activo", vencida: "Vencido", cancelada: "Cancelado", suspendida: "Suspendido" };

export default async function MiPlan() {
  const { supabase, user, barberia } = await cargarPanel();
  const [{ data: p }, { data: pagos }] = await Promise.all([
    supabase.rpc("mi_plan"),
    supabase.from("pagos").select("id, fecha, monto, moneda, estado, metodo").order("fecha", { ascending: false }).limit(24),
  ]);
  const plan = p as Plan | null;
  const checkout = process.env.LEMONSQUEEZY_CHECKOUT_URL;
  const precio = process.env.NEXT_PUBLIC_PLAN_PRECIO;
  const contacto = process.env.NEXT_PUBLIC_CONTACTO_EMAIL;
  // la barbería viaja en el link para asociar el pago; el proveedor la devuelve en el aviso
  const link = checkout ? `${checkout}${checkout.includes("?") ? "&" : "?"}checkout[custom][barberia_id]=${encodeURIComponent(barberia.id)}&checkout[email]=${encodeURIComponent(user.email ?? "")}` : null;

  return (
    <main className="mx-auto w-full max-w-xl flex-1 px-4 py-8">
      <h1 className="text-2xl font-semibold">Mi plan</h1>
      {plan && (
        <section className="mt-4 rounded-lg border border-zinc-300 p-4 dark:border-zinc-700">
          <p className="text-xl font-semibold">{ESTADOS[plan.estado] ?? plan.estado}</p>
          <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
            {plan.estado === "prueba" && <>Tu prueba gratis dura hasta el {fecha(plan.prueba_hasta)}.</>}
            {plan.estado === "activa" && <>Pagado hasta el {fecha(plan.periodo_hasta)}.</>}
            {plan.estado === "cancelada" && plan.periodo_hasta && <>Seguís teniendo acceso hasta el {fecha(plan.periodo_hasta)}.</>}
            {(plan.estado === "vencida" || plan.estado === "suspendida") && <>Tus clientes no pueden reservar hasta que se regularice.</>}
          </p>
        </section>
      )}

      <section className="mt-6">
        <h2 className="text-lg font-medium">Suscribirme{precio ? ` · ${precio}` : ""}</h2>
        {link ? (
          <>
            <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">El pago se hace en una página segura del procesador de pagos. Cuando se acredita, tu plan se activa solo.</p>
            <a href={link} className="mt-3 inline-block rounded-lg bg-zinc-900 px-5 py-3 font-medium text-white dark:bg-white dark:text-zinc-900">Suscribirme</a>
          </>
        ) : (
          <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
            {contacto ? <>Para activar tu plan escribinos a <a className="underline" href={`mailto:${contacto}`}>{contacto}</a>.</> : "Pronto vas a poder suscribirte desde acá."}
          </p>
        )}
      </section>

      <section className="mt-8">
        <h2 className="text-lg font-medium">Mis pagos</h2>
        {(pagos ?? []).length === 0 && <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">Todavía no hay pagos.</p>}
        <ul className="mt-2 flex flex-col gap-2">
          {(pagos ?? []).map((x) => (
            <li key={x.id} className="rounded-lg border border-zinc-300 p-3 text-sm dark:border-zinc-700">
              <b>{x.moneda === "ARS" ? dinero({ ARS: Number(x.monto) }) : `${x.moneda} ${x.monto}`}</b> · {x.estado} · {fechaHora(x.fecha)}{x.metodo ? ` · ${x.metodo}` : ""}
            </li>
          ))}
        </ul>
      </section>
    </main>
  );
}
