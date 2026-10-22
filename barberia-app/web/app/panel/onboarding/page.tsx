import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import Formulario from "./Formulario";

export const dynamic = "force-dynamic";

export default async function Onboarding() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/ingresar");
  const { count } = await supabase.from("barberias").select("id", { count: "exact", head: true });
  if (count) redirect("/panel");
  return <Formulario />;
}
