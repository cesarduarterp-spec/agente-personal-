import Link from "next/link";

export default function PanelLayout({ children }: { children: React.ReactNode }) {
  const link = "rounded-lg px-3 py-2 hover:bg-zinc-100 dark:hover:bg-zinc-900";
  return (
    <div className="flex flex-1 flex-col">
      <nav className="flex items-center gap-1 overflow-x-auto border-b border-zinc-200 px-3 py-2 text-sm dark:border-zinc-800">
        <Link href="/panel" className={link}>Agenda</Link>
        <Link href="/panel/clientes" className={link}>Clientes</Link>
        <Link href="/panel/horarios" className={link}>Horarios</Link>
        <Link href="/panel/configuracion" className={link}>Configuración</Link>
        <form action="/auth/salir" method="post" className="ml-auto">
          <button className={link}>Salir</button>
        </form>
      </nav>
      {children}
    </div>
  );
}
