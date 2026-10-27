import Link from "next/link";
import type { Metadata } from "next";

// se lee PLAN_PRECIO, CONTACTO_EMAIL, etc. en cada pedido (no al construir la imagen)
export const dynamic = "force-dynamic";

const sitio = process.env.NEXT_PUBLIC_SITE_URL ?? "";

export const metadata: Metadata = {
  title: "Agenda online para barberías | Tu barbería llena, sin atender el WhatsApp",
  description:
    "Turnos online para barberos: tus clientes reservan solos, sin descargar nada ni crear cuenta. Recordatorios por mail, ficha de cada cliente con fotos de sus cortes y atención a domicilio con Google Maps.",
  alternates: { canonical: sitio || undefined },
  openGraph: {
    title: "Tu barbería llena, sin atender el WhatsApp",
    description: "Reservas online, recordatorios por mail y ficha de clientes para barberos.",
    type: "website",
    locale: "es_AR",
    url: sitio || undefined,
  },
};

const FUNCIONES = [
  { t: "Reservan solos, en un minuto", d: "Tu cliente entra a tu link, elige servicio, día y hora, y listo. Sin descargar una app ni crear una cuenta." },
  { t: "Menos plantones", d: "Cada turno recibe un recordatorio por mail 24 horas y 2 horas antes, con botones para reprogramar o cancelar." },
  { t: "La ficha de cada cliente", d: "Nombre, teléfono, observaciones, historial de cortes y fotos. Sabés cómo le gusta el corte antes de que se siente." },
  { t: "Atención a domicilio con Google Maps", d: "El cliente marca su dirección en el mapa y vos recibís el punto exacto con el botón “Cómo llegar”." },
  { t: "Tu marca, tu página", d: "Subí tu logo y elegí tu color. Tus clientes ven tu barbería, no la nuestra." },
  { t: "Tus horarios, como los querés", d: "Dos franjas por día (ej. 9 a 14 y 17 a 20), días libres, vacaciones y fechas especiales abiertas." },
];

const PASOS = [
  { n: "1", t: "Creás tu barbería", d: "Nombre, servicios con precio y duración, y tus horarios. Son unos minutos." },
  { n: "2", t: "Compartís tu link", d: "Ponelo en tu Instagram, en WhatsApp y en la puerta del local con un QR." },
  { n: "3", t: "Los turnos llegan solos", d: "Te llega un mail por cada reserva y los ves en tu agenda. Vos solo cortás." },
];

const PREGUNTAS = [
  { p: "¿Mis clientes tienen que descargar algo o registrarse?", r: "No. Reservan desde el navegador del celular con su nombre, teléfono y mail. Nada más." },
  { p: "¿Cuánto cuesta?", r: "Arrancás con una prueba gratis, sin cargar ninguna tarjeta. Después hay un precio mensual simple en pesos, y te avisamos antes de que termine la prueba." },
  { p: "¿Cómo se paga?", r: "Por transferencia o link de Mercado Pago. Te mostramos los datos dentro de tu panel." },
  { p: "¿Puedo cancelar o cambiar un turno?", r: "Sí. Vos desde tu agenda, y tus clientes desde el link del mail, gratis hasta las horas antes que definas." },
  { p: "¿Qué pasa con los datos de mis clientes?", r: "Son tuyos. Se guardan de forma privada y solo vos los ves. Podés leer cómo los cuidamos en la Política de privacidad." },
  { p: "¿Sirve si trabajo a domicilio?", r: "Sí. Podés atender en tu local, a domicilio o las dos cosas, con zona de cobertura y adicional por traslado." },
];

export default function Inicio() {
  const precio = process.env.PLAN_PRECIO;
  const dias = process.env.PRUEBA_DIAS ?? "30";
  const contacto = process.env.CONTACTO_EMAIL;
  const boton = "inline-block rounded-lg bg-zinc-900 px-6 py-3 text-base font-semibold text-white hover:opacity-90 dark:bg-white dark:text-zinc-900";

  return (
    <main className="flex-1">
      <header className="mx-auto flex w-full max-w-5xl items-center justify-between px-4 py-4">
        <span className="text-lg font-bold">✂️ Agenda para barberías</span>
        <Link href="/ingresar" className="text-sm font-medium underline">Ingresar</Link>
      </header>

      <section className="mx-auto w-full max-w-5xl px-4 pb-14 pt-8 text-center sm:pt-16">
        <h1 className="mx-auto max-w-3xl text-4xl font-bold leading-tight sm:text-6xl">Tu barbería llena, sin atender el WhatsApp.</h1>
        <p className="mx-auto mt-5 max-w-2xl text-lg text-zinc-600 dark:text-zinc-400">
          Tus clientes reservan solos las 24 horas. Vos recibís los turnos ordenados, con recordatorios automáticos por mail y la ficha de cada corte.
        </p>
        <div className="mt-8 flex flex-col items-center gap-3">
          <Link href="/ingresar" className={boton}>Probalo gratis {dias} días</Link>
          <p className="text-sm text-zinc-500">Sin tarjeta. Armás tu barbería en unos minutos.</p>
        </div>
      </section>

      <section aria-labelledby="como" className="bg-zinc-50 py-14 dark:bg-zinc-900/40">
        <div className="mx-auto w-full max-w-5xl px-4">
          <h2 id="como" className="text-center text-3xl font-bold">Cómo funciona</h2>
          <ol className="mt-8 grid gap-4 sm:grid-cols-3">
            {PASOS.map((p) => (
              <li key={p.n} className="rounded-xl border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-950">
                <span className="flex h-9 w-9 items-center justify-center rounded-full bg-zinc-900 font-bold text-white dark:bg-white dark:text-zinc-900">{p.n}</span>
                <h3 className="mt-4 text-lg font-semibold">{p.t}</h3>
                <p className="mt-1 text-zinc-600 dark:text-zinc-400">{p.d}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      <section aria-labelledby="funciones" className="mx-auto w-full max-w-5xl px-4 py-14">
        <h2 id="funciones" className="text-center text-3xl font-bold">Todo lo que necesita un barbero</h2>
        <ul className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {FUNCIONES.map((f) => (
            <li key={f.t} className="rounded-xl border border-zinc-200 p-6 dark:border-zinc-800">
              <h3 className="text-lg font-semibold">{f.t}</h3>
              <p className="mt-2 text-zinc-600 dark:text-zinc-400">{f.d}</p>
            </li>
          ))}
        </ul>
      </section>

      <section aria-labelledby="precio" className="bg-zinc-900 py-14 text-white dark:bg-zinc-100 dark:text-zinc-900">
        <div className="mx-auto w-full max-w-3xl px-4 text-center">
          <h2 id="precio" className="text-3xl font-bold">Un solo plan, simple</h2>
          <p className="mt-4 text-lg opacity-90">
            {precio ? <><b>{precio}</b>. </> : null}Empezás con <b>{dias} días gratis</b>, sin cargar ninguna tarjeta. Si te sirve, seguís; si no, no pasa nada.
          </p>
          <p className="mt-2 opacity-80">Todo incluido: reservas, recordatorios, fichas de clientes, tu marca y atención a domicilio.</p>
          <Link href="/ingresar" className="mt-6 inline-block rounded-lg bg-white px-6 py-3 text-base font-semibold text-zinc-900 hover:opacity-90 dark:bg-zinc-900 dark:text-white">Crear mi barbería</Link>
        </div>
      </section>

      <section aria-labelledby="faq" className="mx-auto w-full max-w-3xl px-4 py-14">
        <h2 id="faq" className="text-center text-3xl font-bold">Preguntas frecuentes</h2>
        <div className="mt-8 flex flex-col gap-3">
          {PREGUNTAS.map((q) => (
            <details key={q.p} className="rounded-xl border border-zinc-200 p-4 dark:border-zinc-800">
              <summary className="cursor-pointer font-semibold">{q.p}</summary>
              <p className="mt-2 text-zinc-600 dark:text-zinc-400">{q.r}</p>
            </details>
          ))}
        </div>
      </section>

      <footer className="border-t border-zinc-200 py-8 text-center text-sm text-zinc-600 dark:border-zinc-800 dark:text-zinc-400">
        <nav className="flex flex-wrap items-center justify-center gap-x-5 gap-y-2">
          <Link href="/privacidad" className="underline">Política de privacidad</Link>
          <Link href="/terminos" className="underline">Términos y condiciones</Link>
          <Link href="/ingresar" className="underline">Ingresar</Link>
          {contacto && <a href={`mailto:${contacto}`} className="underline">{contacto}</a>}
        </nav>
        <p className="mt-3">© {new Date().getFullYear()} Agenda para barberías</p>
      </footer>
    </main>
  );
}
