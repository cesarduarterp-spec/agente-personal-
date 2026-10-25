import { cargarAdmin } from "@/lib/admin";
import Formulario from "./Formulario";

export const dynamic = "force-dynamic";

export default async function ConfigCobro() {
  const { supabase } = await cargarAdmin();
  const { data } = await supabase.rpc("admin_config"); // sin parámetros: solo lee
  const c = data as { cobro_activo: boolean; dias_prueba: number; dias_gracia: number; precio_texto: string | null; instrucciones_pago: string | null };
  return (
    <main className="mx-auto w-full max-w-xl flex-1 px-4 py-8">
      <h1 className="text-2xl font-semibold">Pagos y plazos</h1>
      <p className="mb-6 mt-1 text-zinc-600 dark:text-zinc-400">Los pagos <b>siempre se registran a mano</b> desde la ficha de cada barbería. Acá definís si el sistema <b>exige</b> el pago: apagado, ninguna barbería se bloquea (solo las que suspendas vos).</p>
      <Formulario inicial={c} />
    </main>
  );
}
