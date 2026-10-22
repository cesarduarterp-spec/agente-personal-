import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { createPublicClient, diasProximos } from "@/lib/public";
import Reserva, { type Perfil } from "./Reserva";

export const dynamic = "force-dynamic";

async function perfil(slug: string) {
  const { data } = await createPublicClient().rpc("perfil_publico", { p_slug: slug });
  return (data as Perfil | null) ?? null;
}

export async function generateMetadata({ params }: PageProps<"/[slug]">): Promise<Metadata> {
  const p = await perfil((await params).slug);
  return { title: p ? `Reservá en ${p.nombre}` : "Barbería no encontrada" };
}

export default async function Pagina({ params }: PageProps<"/[slug]">) {
  const { slug } = await params;
  const p = await perfil(slug);
  if (!p || p.servicios.length === 0 || p.barberos.length === 0) notFound();
  return <Reserva perfil={p} dias={diasProximos(p.timezone)} />;
}
