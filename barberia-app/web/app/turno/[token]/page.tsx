import { notFound } from "next/navigation";
import { createPublicClient, diasProximos, fmtFechaHora } from "@/lib/public";
import Gestion from "./Gestion";

export const dynamic = "force-dynamic";
export const metadata = { title: "Tu turno", robots: { index: false } };

export type Turno = {
  inicio: string; estado: string; modalidad: "local" | "domicilio"; servicio: string; servicio_id: string;
  barbero: string; barbero_id: string; precio: number | null; direccion_turno: string | null;
  puede_modificar: boolean; horas_min_cancelacion: number;
  barberia: { nombre: string; slug: string; timezone: string; direccion: string | null; lat: number | null; lng: number | null; color: string; logo_path: string | null };
  lat_turno: number | null; lng_turno: number | null;
};

export default async function Pagina({ params }: PageProps<"/turno/[token]">) {
  const { token } = await params;
  const { data } = await createPublicClient().rpc("ver_turno", { p_token: token });
  const t = data as Turno | null;
  if (!t) notFound();
  return <Gestion token={token} turno={t} cuando={fmtFechaHora(t.inicio, t.barberia.timezone)} dias={diasProximos(t.barberia.timezone)} />;
}
