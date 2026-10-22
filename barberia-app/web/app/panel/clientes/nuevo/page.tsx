import Link from "next/link";
import { cargarPanel } from "@/lib/panel";
import FichaForm from "../FichaForm";

export const dynamic = "force-dynamic";

export default async function Nueva() {
  await cargarPanel();
  return (
    <main className="mx-auto w-full max-w-xl flex-1 px-4 py-8">
      <Link href="/panel/clientes" className="text-sm underline">← Clientes</Link>
      <h1 className="mb-4 mt-2 text-2xl font-semibold">Nueva ficha</h1>
      <FichaForm id={null} inicial={{ nombre: "", apellido: "", telefono: "", email: "", edad: "", direccion: "", observaciones: "" }} />
    </main>
  );
}
