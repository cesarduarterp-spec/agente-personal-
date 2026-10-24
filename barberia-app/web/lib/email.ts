import { peso } from "@/lib/format";
import { mapaUrl as mapa, rutaUrl, textoSobre, urlLogo } from "@/lib/marca";
import "server-only";
import { fmtFechaHora } from "@/lib/public";

const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
const utc = (iso: string) => new Date(iso).toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");

export async function enviarMail(to: string, subject: string, html: string, ics?: string, replyTo?: string | null) {
  const key = process.env.RESEND_API_KEY;
  if (!key) {
    console.warn(`[mail] RESEND_API_KEY no configurada; no se envió "${subject}" a ${to}`);
    return false;
  }
  const enviar = (conReplyTo: boolean) =>
    fetch(process.env.RESEND_API_URL ?? "https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        from: process.env.MAIL_FROM ?? "Reservas <reservas@example.com>",
        to,
        subject,
        html,
        ...(conReplyTo && replyTo ? { reply_to: replyTo } : {}),
        attachments: ics ? [{ filename: "turno.ics", content: Buffer.from(ics).toString("base64") }] : undefined,
      }),
    });
  let r = await enviar(true);
  // si Resend rechaza el Reply-To, el mail sale igual (sin él): nunca se pierde una confirmación por eso
  if (!r.ok && replyTo && (r.status === 400 || r.status === 422)) r = await enviar(false);
  if (!r.ok) console.error("[mail] Resend respondió", r.status);
  return r.ok;
}

export type Reserva = {
  turno_id: string; gestion_token: string; inicio: string; fin: string; modalidad: string;
  direccion_turno: string | null; indicaciones: string | null; precio: number | null;
  cliente: { nombre: string; apellido: string | null; telefono: string; email: string };
  servicio: string; barbero: string; email_barbero: string | null;
  lat_turno: number | null; lng_turno: number | null;
  barberia: { nombre: string; direccion: string | null; lat: number | null; lng: number | null; timezone: string; color?: string; logo_path?: string | null };
};

const cabecera = (nombre: string, logoPath: string | null | undefined) => {
  const logo = urlLogo(logoPath);
  return `<div style="display:flex;align-items:center;gap:12px;margin-bottom:12px">${logo ? `<img src="${logo}" alt="" width="48" height="48" style="border-radius:10px;object-fit:contain">` : ""}<b style="font-size:18px">${esc(nombre)}</b></div>`;
};
const boton = (href: string, texto: string, color: string) =>
  `<a href="${href}" style="background:${color};color:${textoSobre(color)};padding:12px 18px;border-radius:8px;text-decoration:none;display:inline-block">${texto}</a>`;

export async function enviarConfirmaciones(r: Reserva) {
  const base = process.env.NEXT_PUBLIC_SITE_URL ?? "";
  const cuando = fmtFechaHora(r.inicio, r.barberia.timezone);
  const link = `${base}/turno/${r.gestion_token}`;
  const lugar = r.modalidad === "local" ? r.barberia.direccion : r.direccion_turno;
  // local: coordenadas del local; domicilio: coordenadas exactas que marcó el cliente en Google Maps
  const mapaUrl = lugar ? mapa(lugar, r.modalidad === "local" ? r.barberia.lat : r.lat_turno, r.modalidad === "local" ? r.barberia.lng : r.lng_turno) : null;
  const rutaBarbero = lugar ? rutaUrl(lugar, r.modalidad === "local" ? r.barberia.lat : r.lat_turno, r.modalidad === "local" ? r.barberia.lng : r.lng_turno) : null;
  const color = r.barberia.color ?? "#111111";
  const ics = [
    "BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//Agenda barberias//ES", "BEGIN:VEVENT",
    `UID:${r.turno_id}@agenda`, `DTSTAMP:${utc(new Date().toISOString())}`,
    `DTSTART:${utc(r.inicio)}`, `DTEND:${utc(r.fin)}`,
    `SUMMARY:${r.servicio} - ${r.barberia.nombre}`, lugar ? `LOCATION:${lugar.replace(/[,;]/g, " ")}` : "",
    "END:VEVENT", "END:VCALENDAR",
  ].filter(Boolean).join("\r\n");

  const nombreCliente = [r.cliente.nombre, r.cliente.apellido].filter(Boolean).join(" ");
  const htmlCliente = `<div style="font-family:sans-serif;max-width:480px">
    ${cabecera(r.barberia.nombre, r.barberia.logo_path)}
    <h2>Turno confirmado ✅</h2>
    <p>Hola ${esc(r.cliente.nombre)}, tu turno en <b>${esc(r.barberia.nombre)}</b>:</p>
    <p><b>${esc(cuando)}</b><br>${esc(r.servicio)} con ${esc(r.barbero)}${r.precio != null ? ` · ${peso(r.precio)}` : ""}</p>
    ${lugar ? `<p>${r.modalidad === "local" ? "📍 Local" : "🏠 Te visitamos en"}: ${esc(lugar)}${mapaUrl ? `<br><a href="${mapaUrl}">Ver en Google Maps</a>` : ""}</p>` : ""}
    <p>${boton(link, "Reprogramar o cancelar", color)}</p>
    <p style="color:#666;font-size:13px">Es gratis y no necesitás cuenta. Se agregó un archivo para tu calendario.</p></div>`;
  const htmlBarbero = `<div style="font-family:sans-serif;max-width:480px">
    <h2>Nueva reserva</h2>
    <p><b>${esc(cuando)}</b><br>${esc(r.servicio)} · ${esc(r.barbero)}</p>
    <p>Cliente: <b>${esc(nombreCliente)}</b><br>Tel: ${esc(r.cliente.telefono)}<br>Mail: ${esc(r.cliente.email)}</p>
    <p>${r.modalidad === "local" ? "En el local" : "A domicilio"}${lugar ? `: ${esc(lugar)}` : ""}${rutaBarbero ? `<br><a href="${rutaBarbero}">📍 Cómo llegar (Google Maps)</a>` : ""}</p>
    ${r.indicaciones ? `<p>Indicaciones: ${esc(r.indicaciones)}</p>` : ""}</div>`;

  const [alCliente] = await Promise.allSettled([
    enviarMail(r.cliente.email, `Turno confirmado: ${cuando}`, htmlCliente, ics, r.email_barbero),
    r.email_barbero ? enviarMail(r.email_barbero, `Nueva reserva: ${nombreCliente} · ${cuando}`, htmlBarbero, undefined, r.cliente.email) : Promise.resolve(),
  ]);
  return alCliente.status === "fulfilled" && alCliente.value === true;
}

// Item que devuelve la función reclamar_recordatorios de la base
export type Recordatorio = {
  turno_id: string; tipo: "24h" | "2h"; inicio: string; modalidad: "local" | "domicilio";
  gestion_token: string; direccion_turno: string | null;
  cliente_nombre: string; cliente_email: string | null; servicio: string; barbero: string;
  barberia: string; timezone: string; direccion_local: string | null; lat: number | null; lng: number | null;
  lat_turno: number | null; lng_turno: number | null; color?: string; logo_path?: string | null; email_barbero?: string | null;
};

export async function enviarRecordatorio(r: Recordatorio) {
  if (!r.cliente_email) return true; // nada que enviar: no tiene sentido reintentar
  const cuando = fmtFechaHora(r.inicio, r.timezone);
  const link = `${process.env.NEXT_PUBLIC_SITE_URL ?? ""}/turno/${r.gestion_token}`;
  const lugar = r.modalidad === "local" ? r.direccion_local : r.direccion_turno;
  const mapaUrl = lugar ? mapa(lugar, r.modalidad === "local" ? r.lat : r.lat_turno, r.modalidad === "local" ? r.lng : r.lng_turno) : null;
  const color = r.color ?? "#111111";
  const titulo = r.tipo === "24h" ? "Mañana tenés turno" : "Tu turno es en 2 horas";
  const html = `<div style="font-family:sans-serif;max-width:480px">
    ${cabecera(r.barberia, r.logo_path)}
    <h2>${titulo} ✂️</h2>
    <p>Hola ${esc(r.cliente_nombre)}, te recordamos tu turno en <b>${esc(r.barberia)}</b>:</p>
    <p><b>${esc(cuando)}</b><br>${esc(r.servicio)} con ${esc(r.barbero)}</p>
    ${lugar ? `<p>${r.modalidad === "local" ? "📍" : "🏠"} ${esc(lugar)}${mapaUrl ? `<br><a href="${mapaUrl}">Ver en Google Maps</a>` : ""}</p>` : ""}
    <p>${boton(link, "Reprogramar o cancelar", color)}</p>
    <p style="color:#666;font-size:13px">¿No podés venir? Avisanos con tiempo así otra persona puede aprovechar el horario.</p></div>`;
  return enviarMail(r.cliente_email, `${titulo}: ${cuando}`, html, undefined, r.email_barbero);
}
