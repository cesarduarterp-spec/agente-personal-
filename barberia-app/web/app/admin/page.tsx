import Link from "next/link";
import { cargarAdmin } from "@/lib/admin";
import { dinero } from "@/lib/format";

export const dynamic = "force-dynamic";

type Resumen = {
  usuarios: number; con_barberia: number; sin_barberia: number; en_prueba: number; activas: number; vencidas: number;
  suspendidas: number; turnos_30d: number; ingresos_30d: Record<string, number>; ingresos_total: Record<string, number>; cobro_activo: boolean;
};

function Tarjeta({ titulo, valor, nota, href }: { titulo: string; valor: React.ReactNode; nota?: string; href?: string }) {
  const c = (
    <div className="rounded-lg border border-zinc-300 p-4 dark:border-zinc-700">
      <p className="text-sm text-zinc-600 dark:text-zinc-400">{titulo}</p>
      <p className="mt-1 text-2xl font-semibold">{valor}</p>
      {nota && <p className="mt-1 text-xs text-zinc-500">{nota}</p>}
    </div>
  );
  return href ? <Link href={href}>{c}</Link> : c;
}

export default async function Resumen() {
  const { supabase } = await cargarAdmin();
  const { data } = await supabase.rpc("admin_resumen");
  const r = data as Resumen | null;
  if (!r) return <main className="p-6">No se pudo cargar el resumen.</main>;
  return (
    <main className="mx-auto w-full max-w-4xl flex-1 px-4 py-8">
      <h1 className="text-2xl font-semibold">Resumen</h1>
      <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
        Cobro automático: <b>{r.cobro_activo ? "ACTIVADO" : "apagado"}</b> (si está apagado, ninguna barbería se bloquea por falta de pago).{" "}
        <Link className="underline" href="/admin/configuracion">Cambiar</Link>
      </p>
      <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Tarjeta titulo="Usuarios registrados" valor={r.usuarios} href="/admin/usuarios" />
        <Tarjeta titulo="Con barbería" valor={r.con_barberia} />
        <Tarjeta titulo="Se registraron y no armaron su barbería" valor={r.sin_barberia} nota="Son contactos para escribirles" href="/admin/usuarios?f=sin_barberia" />
        <Tarjeta titulo="Turnos creados (30 días)" valor={r.turnos_30d} />
        <Tarjeta titulo="En prueba" valor={r.en_prueba} href="/admin/usuarios?f=prueba" />
        <Tarjeta titulo="Pagando" valor={r.activas} href="/admin/usuarios?f=activa" />
        <Tarjeta titulo="Vencidas / canceladas" valor={r.vencidas} href="/admin/usuarios?f=vencida" />
        <Tarjeta titulo="Suspendidas" valor={r.suspendidas} href="/admin/usuarios?f=suspendida" />
      </div>
      <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
        <Tarjeta titulo="Cobrado en los últimos 30 días" valor={dinero(r.ingresos_30d)} href="/admin/pagos" />
        <Tarjeta titulo="Cobrado en total" valor={dinero(r.ingresos_total)} href="/admin/pagos" />
      </div>
    </main>
  );
}
