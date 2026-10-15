//@include _lib
// Arma el briefing matutino: datos (RPC) + clima (Open-Meteo) + resumen ejecutivo (Gemini).
const data = $('Supabase · fn_briefing').first().json;
const wx = $('Clima · Open-Meteo').first().json;

const WMO = { 0: 'despejado', 1: 'mayormente despejado', 2: 'parcialmente nublado', 3: 'nublado',
  45: 'niebla', 48: 'niebla', 51: 'llovizna', 53: 'llovizna', 55: 'llovizna intensa',
  61: 'lluvia débil', 63: 'lluvia', 65: 'lluvia fuerte', 71: 'nieve', 80: 'chaparrones',
  81: 'chaparrones', 82: 'chaparrones fuertes', 95: 'tormenta', 96: 'tormenta con granizo', 99: 'tormenta con granizo' };
const weather = wx?.daily ? {
  city: ENV.WEATHER_CITY || 'San Luis',
  now: wx.current?.temperature_2m,
  max: wx.daily.temperature_2m_max?.[0],
  min: wx.daily.temperature_2m_min?.[0],
  rain: wx.daily.precipitation_probability_max?.[0],
  desc: WMO[wx.daily.weather_code?.[0]] || '—',
} : null;

const today = data.today || [];
const overdue = data.overdue || [];
const hhmm = (iso) => iso ? new Date(iso).toLocaleTimeString('es-AR', { timeZone: TZ, hour: '2-digit', minute: '2-digit' }) : '—';

const prompt = `Sos el asistente ejecutivo de ${ENV.USER_NAME || 'el usuario'}. Escribí el briefing matutino.
Fecha: ${data.date_local}
Clima: ${weather ? `${weather.desc}, ${weather.min}°–${weather.max}°C, lluvia ${weather.rain}%` : 'sin datos'}
Tareas de hoy (${today.length}): ${JSON.stringify(today.map((t) => ({ t: t.title, c: t.category, p: t.priority, h: hhmm(t.due_date) })))}
Atrasadas (${overdue.length}): ${JSON.stringify(overdue.map((t) => ({ t: t.title, c: t.category, p: t.priority, venc: t.due_local })))}
Completadas ayer: ${data.completed_yesterday}

Formato (español rioplatense, máx. 120 palabras, sin saludos genéricos):
1) Una línea de apertura motivadora y concreta (no cursi).
2) "Foco del día": las 3 tareas más importantes y por qué, en viñetas.
3) Una recomendación estratégica (ej. bloque de trabajo profundo, qué delegar o reprogramar de lo atrasado).
Usá **negrita** solo para títulos de tareas.`;

let summary = '';
try { summary = await llmText(prompt, 0.6); } catch (e) { /* sin IA: igual se manda la agenda */ }
if (!summary) summary = 'Buen día. Acá está tu agenda.';

// ---- Telegram ----
const line = (t) => `${PRIORITY_ICON[t.priority] || '•'} ${hhmm(t.due_date)} <b>${escHtml(t.title)}</b> <i>${escHtml(t.category)}</i>`;
const tgHtml =
  `☀️ <b>Briefing · ${escHtml(data.date_local)}</b>\n` +
  (weather ? `🌡️ ${escHtml(weather.city)}: ${weather.desc}, ${weather.min}°/${weather.max}° · 🌧️ ${weather.rain}%\n` : '') +
  `\n${mdToTgHtml(summary)}\n` +
  `\n📋 <b>Hoy (${today.length})</b>\n` + (today.map(line).join('\n') || '— nada agendado —') +
  (overdue.length ? `\n\n⚠️ <b>Atrasadas (${overdue.length})</b>\n` + overdue.map(line).join('\n') : '') +
  (ENV.APP_URL ? `\n\n<a href="${ENV.APP_URL}">Abrir agenda →</a>` : '');

// ---- Email HTML (inline styles: compatibles con Gmail/Outlook) ----
const row = (t) => `<tr>
  <td style="padding:8px 6px;border-bottom:1px solid #eee;width:56px;color:#666;font-size:13px">${hhmm(t.due_date)}</td>
  <td style="padding:8px 6px;border-bottom:1px solid #eee;font-size:14px">${PRIORITY_ICON[t.priority] || ''} <strong>${escHtml(t.title)}</strong><br><span style="color:#888;font-size:12px">${escHtml(t.category)}</span></td></tr>`;
const section = (title, list) => list.length
  ? `<h3 style="font-size:15px;margin:24px 0 8px">${title}</h3><table width="100%" cellspacing="0" cellpadding="0">${list.map(row).join('')}</table>`
  : '';
const summaryHtml = escHtml(summary)
  .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
  .replace(/^\s*[-*]\s+(.+)$/gm, '<li>$1</li>')
  .replace(/(<li>.*<\/li>\n?)+/g, (m) => `<ul style="padding-left:18px;margin:8px 0">${m}</ul>`)
  .replace(/\n{2,}/g, '<br><br>').replace(/\n/g, ' ');

const emailHtml = `<!doctype html><html><body style="margin:0;background:#f5f5f4;font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;color:#1c1917">
<table width="100%" cellspacing="0" cellpadding="0"><tr><td align="center" style="padding:24px 12px">
<table width="100%" style="max-width:560px;background:#fff;border-radius:12px;padding:28px" cellspacing="0" cellpadding="0"><tr><td>
<p style="margin:0;color:#78716c;font-size:13px">${escHtml(data.date_local)}${weather ? ` · ${escHtml(weather.city)} ${weather.min}°/${weather.max}° ${weather.desc}, lluvia ${weather.rain}%` : ''}</p>
<h1 style="font-size:22px;margin:6px 0 16px">Briefing del día</h1>
<div style="font-size:15px;line-height:1.55">${summaryHtml}</div>
${section(`Hoy (${today.length})`, today)}
${section(`⚠️ Atrasadas (${overdue.length})`, overdue)}
${ENV.APP_URL ? `<p style="margin-top:28px"><a href="${ENV.APP_URL}" style="background:#1c1917;color:#fff;text-decoration:none;padding:10px 16px;border-radius:8px;font-size:14px">Abrir agenda</a></p>` : ''}
</td></tr></table></td></tr></table></body></html>`;

await sendTelegram(ENV.TELEGRAM_ALLOWED_CHAT_ID, tgHtml);

return [{ json: {
  subject: `☀️ Briefing ${data.date_local} · ${today.length} tareas${overdue.length ? `, ${overdue.length} atrasadas` : ''}`,
  html: emailHtml,
} }];
