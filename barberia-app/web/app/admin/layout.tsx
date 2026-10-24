import Link from "next/link";
import { cargarAdmin } from "@/lib/admin";

export const metadata = { title: "Administración", robots: { index: false } };

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  await cargarAdmin();
  const link = "rounded-lg px-3 py-2 hover:bg-zinc-100 dark:hover:bg-zinc-900";
  return (
    <div className="flex flex-1 flex-col">
      <nav className="flex items-center gap-1 overflow-x-auto border-b border-zinc-200 px-3 py-2 text-sm dark:border-zinc-800">
        <span className="px-3 font-semibold">Admin</span>
        <Link href="/admin" className={link}>Resumen</Link>
        <Link href="/admin/usuarios" className={link}>Usuarios</Link>
        <Link href="/admin/pagos" className={link}>Pagos</Link>
        <Link href="/admin/configuracion" className={link}>Cobro</Link>
        <Link href="/panel" className={`${link} ml-auto`}>Mi panel</Link>
      </nav>
      {children}
    </div>
  );
}
