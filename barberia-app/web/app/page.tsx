import Link from "next/link";

export default function Home() {
  return (
    <main className="mx-auto flex w-full max-w-xl flex-1 flex-col justify-center gap-5 px-4 py-10">
      <h1 className="text-3xl font-semibold">Tu barbería llena, sin atender el WhatsApp.</h1>
      <p className="text-zinc-600 dark:text-zinc-400">
        Agenda online con reservas sin registro para tus clientes, recordatorios por mail y la ficha de cada corte.
      </p>
      <Link href="/ingresar" className="w-fit rounded-lg bg-zinc-900 px-5 py-3 font-medium text-white dark:bg-white dark:text-zinc-900">
        Soy barbero
      </Link>
    </main>
  );
}
