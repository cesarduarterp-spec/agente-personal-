import Link from "next/link";

// Marco común de las páginas legales. Los textos son una base redactada para este servicio:
// conviene que un abogado los revise antes del lanzamiento comercial.
export default function PaginaLegal({ titulo, actualizado, children }: { titulo: string; actualizado: string; children: React.ReactNode }) {
  return (
    <main className="mx-auto w-full max-w-2xl flex-1 px-4 py-10">
      <Link href="/" className="text-sm underline">← Inicio</Link>
      <h1 className="mt-4 text-3xl font-bold">{titulo}</h1>
      <p className="mt-1 text-sm text-zinc-500">Última actualización: {actualizado}</p>
      <div className="mt-6 flex flex-col gap-4 leading-relaxed [&_h2]:mt-4 [&_h2]:text-xl [&_h2]:font-semibold [&_li]:ml-5 [&_li]:list-disc [&_ul]:flex [&_ul]:flex-col [&_ul]:gap-1">
        {children}
      </div>
    </main>
  );
}
