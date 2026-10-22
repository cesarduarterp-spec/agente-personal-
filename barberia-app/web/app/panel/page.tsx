import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export default async function Panel() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/ingresar");

  const { data: barberias } = await supabase.from("barberias").select("id, nombre, slug, modo");

  return (
    <main className="mx-auto w-full max-w-2xl flex-1 px-4 py-10">
      <h1 className="text-2xl font-semibold">Panel</h1>
      <p className="mt-1 text-zinc-600 dark:text-zinc-400">{user.email}</p>

      {barberias?.length ? (
        <ul className="mt-6 flex flex-col gap-2">
          {barberias.map((b) => (
            <li key={b.id} className="rounded-lg border border-zinc-300 p-4 dark:border-zinc-700">
              <p className="font-medium">{b.nombre}</p>
              <p className="text-sm text-zinc-600 dark:text-zinc-400">/{b.slug} · {b.modo}</p>
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-6">Todavía no creaste tu barbería. El onboarding (modo local o domicilio, servicios y horarios) es el próximo paso.</p>
      )}

      <form action="/auth/salir" method="post" className="mt-8">
        <button className="underline">Salir</button>
      </form>
    </main>
  );
}
