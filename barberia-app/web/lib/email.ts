import "server-only";
import { fmtFechaHora } from "@/lib/public";

const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
const utc = (iso: string) => new Date(iso).toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");

export async function enviarMail(to: string, subject: string, html: string, ics?: string) {
  const key = process.env.RESEND_API_KEY;
  if (!key) {
    console.warn(`[mail] RESEND_API_KEY no configurada; no se envió "${subject}" a ${to}`);
    return false;
  }
  const r = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      from: process.env.MAIL_FROM ?? "Reservas <reservas@example.com>",
      to,
      subject,
      html,
      attachments: ics ? [{ filename: "turno.ics", content: Buffer.from(ics).toString("base64") }] : undefined,
    }),
  });
  if (!r.ok) console.error("[mail] Resend respondió", r.status);
  return r.ok;
}

type Reserva = {
  turno_id: string; gestion_token: string; inicio: string; fin: string; modalidad: string;
  direccion_turno: string | null; indicaciones: string | null; precio: number | null;
  cliente: { nombre: string; apellido: string | null; telefono: string; email: string };
  servicio: string; barbero: string; email_barbero: string | null;
  barberia: { nombre: string; direccion: string | null; lat: number | null; lng: number | null; timezone: string };
};

const mapa = (dir: string, lat: number | null, lng: number | null) =>
  `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(lat != null ? `${lat},${lng}` : dir)}`;

export async function enviarConfirmaciones(r: Reserva) {
  const base = process.env.NEXT_PUBLIC_SITE_URL ?? "";
  const cuando = fmtFechaHora(r.inicio, r.barberia.timezone);
  const link = `${base}/turno/${r.gestion_token}`;
  const lugar = r.modalidad === "local" ? r.barberia.direccion : r.direccion_turno;
  const mapaUrl = lugar ? mapa(lugar, r.modalidad === "local" ? r.barberia.lat : null, r.modalidad === "local" ? r.barberia.lng : null) : null;
  const ics = [
    "BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//Agenda barberias//ES", "BEGIN:VEVENT",
    `UID:${r.turno_id}@agenda`, `DTSTAMP:${utc(new Date().toISOString())}`,
    `DTSTART:${utc(r.inicio)}`, `DTEND:${utc(r.fin)}`,
    `SUMMARY:${r.servicio} - ${r.barberia.nombre}`, lugar ? `LOCATION:${lugar.replace(/[,;]/g, " ")}` : "",
    "END:VEVENT", "END:VCALENDAR",
  ].filter(Boolean).join("\r\n");

  const nombreCliente = [r.cliente.nombre, r.cliente.apellido].filter(Boolean).join(" ");
  const htmlCliente = `<div style="font-family:sans-serif;max-width:480px">
    <h2>Turno confirmado ✅</h2>
    <p>Hola ${esc(r.cliente.nombre)}, tu turno en <b>${esc(r.barberia.nombre)}</b>:</p>
    <p><b>${esc(cuando)}</b><br>${esc(r.servicio)} con ${esc(r.barbero)}${r.precio != null ? ` · $${r.precio}` : ""}</p>
    ${lugar ? `<p>${r.modalidad === "local" ? "📍 Local" : "🏠 Te visitamos en"}: ${esc(lugar)}${mapaUrl ? `<br><a href="${mapaUrl}">Ver en Google Maps</a>` : ""}</p>` : ""}
    <p><a href="${link}" style="background:#111;color:#fff;padding:12px 18px;border-radius:8px;text-decoration:none">Reprogramar o cancelar</a></p>
    <p style="color:#666;font-size:13px">Es gratis y no necesitás cuenta. Se agregó un archivo para tu calendario.</p></div>`;
  const htmlBarbero = `<div style="font-family:sans-serif;max-width:480px">
    <h2>Nueva reserva</h2>
    <p><b>${esc(cuando)}</b><br>${esc(r.servicio)} · ${esc(r.barbero)}</p>
    <p>Cliente: <b>${esc(nombreCliente)}</b><br>Tel: ${esc(r.cliente.telefono)}<br>Mail: ${esc(r.cliente.email)}</p>
    <p>${r.modalidad === "local" ? "En el local" : "A domicilio"}${lugar ? `: ${esc(lugar)}` : ""}${mapaUrl ? `<br><a href="${mapaUrl}">Cómo llegar</a>` : ""}</p>
    ${r.indicaciones ? `<p>Indicaciones: ${esc(r.indicaciones)}</p>` : ""}</div>`;

  await Promise.allSettled([
    enviarMail(r.cliente.email, `Turno confirmado: ${cuando}`, htmlCliente, ics),
    r.email_barbero ? enviarMail(r.email_barbero, `Nueva reserva: ${nombreCliente} · ${cuando}`, htmlBarbero) : Promise.resolve(),
  ]);
}
