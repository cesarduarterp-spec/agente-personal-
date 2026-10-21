//@include _lib
// Diagnóstico: prueba cada conexión REAL y manda el resultado (✔ / ⚠ / ✘ + motivo) por Telegram.
// Además deja conectado el webhook del bot. Se ejecuta desde n8n ("Probar ahora") o con /diagnostico.
const gcal = $input.first().json;          // salida del nodo "GCal · prueba"

// Si vino por webhook, exigir el secreto (evita que un tercero lo dispare)
try {
  const hook = $('Diagnóstico por Telegram').first().json;
  if ((hook.headers || {})['x-diag-secret'] !== ENV.TELEGRAM_WEBHOOK_SECRET) return [];
} catch (e) { /* ejecutado a mano desde n8n */ }

const rows = [];
const add = (estado, servicio, detalle) => rows.push({ estado, servicio, detalle });
const errMsg = (e) => {
  const body = e?.response?.body || e?.cause?.response?.data || e?.description;
  const code = e?.httpCode || e?.response?.status || '';
  const txt = typeof body === 'string' ? body : body ? JSON.stringify(body) : e?.message || String(e);
  return `${code ? 'HTTP ' + code + ' · ' : ''}${txt}`.slice(0, 220);
};
async function check(servicio, fn) {
  try { await fn(); } catch (e) { add('✘', servicio, errMsg(e)); }
}

// 0) Variables de entorno
const REQUERIDAS = ['TELEGRAM_BOT_TOKEN', 'TELEGRAM_WEBHOOK_SECRET', 'TELEGRAM_ALLOWED_CHAT_ID', 'GEMINI_API_KEY',
  'XAI_API_KEY', 'GROK_MODEL', 'SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY', 'NTFY_URL', 'NTFY_TOPIC', 'NTFY_TOKEN',
  'RESEND_API_KEY', 'BRIEFING_EMAIL_FROM', 'BRIEFING_EMAIL_TO', 'GCAL_SYNC_SECRET', 'WEBHOOK_URL', 'APP_URL'];
const faltan = REQUERIDAS.filter((k) => !ENV[k]);
faltan.length ? add('✘', 'Variables', `faltan en n8n: ${faltan.join(', ')}`) : add('✔', 'Variables', 'todas cargadas');

// 1) Zona horaria de n8n
const tzN8n = $now.zoneName;
tzN8n === TZ ? add('✔', 'Zona horaria n8n', `${tzN8n} · ahora ${$now.toFormat('dd/MM HH:mm')}`)
  : add('✘', 'Zona horaria n8n', `es ${tzN8n}; poné GENERIC_TIMEZONE=${TZ} y TZ=${TZ}`);

// 2) Telegram (y conexión del webhook)
await check('Telegram', async () => {
  const me = await tg('getMe', {});
  const base = String(ENV.WEBHOOK_URL || '').replace(/\/$/, '');
  if (base) {
    await tg('setWebhook', {
      url: `${base}/webhook/telegram`,
      secret_token: ENV.TELEGRAM_WEBHOOK_SECRET,
      allowed_updates: ['message', 'callback_query'],
    });
  }
  const info = (await tg('getWebhookInfo', {})).result || {};
  const detalle = `@${me.result.username} · webhook ${info.url ? 'conectado' : 'SIN conectar'}`
    + (info.last_error_message ? ` · último error: ${info.last_error_message}` : '');
  add(info.url && !info.last_error_message ? '✔' : '⚠', 'Telegram', detalle);
});

// 3) Gemini
await check('Gemini', async () => {
  const model = ENV.GEMINI_MODEL || 'gemini-2.5-flash';
  const res = await gemini({ contents: [{ role: 'user', parts: [{ text: 'Respondé solo: OK' }] }] }, model);
  add(geminiText(res) ? '✔' : '⚠', 'Gemini', `${model} respondió "${geminiText(res).slice(0, 20)}"`);
});

// 4) Grok: ¿existe el modelo configurado?
await check('Grok', async () => {
  const list = await http({ method: 'GET', url: 'https://api.x.ai/v1/models',
    headers: { Authorization: `Bearer ${ENV.XAI_API_KEY}` }, json: true });
  const ids = (list.data || list.models || []).map((m) => m.id).filter(Boolean);
  const model = ENV.GROK_MODEL || 'grok-4.3';
  if (ids.length && !ids.includes(model)) {
    const sugeridos = ids.filter((id) => /^grok-\d/.test(id) && !/image|video|imagine|voice|stt|tts/.test(id));
    add('✘', 'Grok', `el modelo "${model}" NO existe para tu clave. Disponibles: ${sugeridos.join(', ') || ids.join(', ')}. Cambiá GROK_MODEL.`);
    return;
  }
  const res = await grok({ input: 'Respondé solo: OK', store: false });
  add('✔', 'Grok', `${model} respondió "${grokText(res).slice(0, 20)}"`);
});

// 5) Transcripción de audio xAI (respaldo de notas de voz): WAV de 0,5 s casi silencioso
await check('Grok · audio', async () => {
  const pcm = '\x7f'.repeat(4096);
  const wav = 'RIFF' + '\x24\x10\x00\x00' + 'WAVEfmt ' + '\x10\x00\x00\x00' + '\x01\x00\x01\x00'
    + '\x40\x1f\x00\x00' + '\x40\x1f\x00\x00' + '\x01\x00\x08\x00' + 'data' + '\x00\x10\x00\x00' + pcm;
  const boundary = 'diag' + Date.now();
  const body = `--${boundary}\r\nContent-Disposition: form-data; name="language"\r\n\r\nes\r\n`
    + `--${boundary}\r\nContent-Disposition: form-data; name="file"; filename="prueba.wav"\r\nContent-Type: audio/wav\r\n\r\n${wav}\r\n--${boundary}--\r\n`;
  await http({ method: 'POST', url: 'https://api.x.ai/v1/stt', body, json: false,
    headers: { Authorization: `Bearer ${ENV.XAI_API_KEY}`, 'Content-Type': `multipart/form-data; boundary=${boundary}` } });
  add('✔', 'Grok · audio', 'transcripción /v1/stt disponible');
});

// 6) Supabase (base, zona horaria de la base, webhook hacia n8n)
await check('Supabase', async () => {
  const ctx = await rpc('fn_agent_context', {});
  const dbNow = ctx.now_local.slice(11, 16);
  const n8nNow = $now.toFormat('HH:mm');
  const tzOk = Math.abs(Number(dbNow.replace(':', '')) - Number(n8nNow.replace(':', ''))) <= 2;
  const cfg = await http({ method: 'GET', url: `${SB_URL}/rest/v1/app_config?select=key,value`, headers: SB_HEADERS, json: true })
    .catch(() => null);
  const hook = (cfg || []).find((r) => r.key === 'gcal_webhook_url');
  const hookOk = hook && ENV.WEBHOOK_URL && hook.value.startsWith(String(ENV.WEBHOOK_URL).replace(/\/$/, ''));
  add(tzOk && hookOk ? '✔' : '⚠', 'Supabase',
    `base OK · hora de la base ${dbNow} vs n8n ${n8nNow}${tzOk ? '' : ' (¡no coinciden! correr 001_init.sql otra vez)'}`
    + (hookOk ? ' · aviso de cambios → n8n OK' : ' · falta configurar el aviso de cambios (002_gcal_webhook.sql)'));
});

// 7) Resend (email del briefing): manda un email de prueba
await check('Resend', async () => {
  const r = await http({ method: 'POST', url: 'https://api.resend.com/emails', json: true,
    headers: { Authorization: `Bearer ${ENV.RESEND_API_KEY}` },
    body: { from: ENV.BRIEFING_EMAIL_FROM, to: [ENV.BRIEFING_EMAIL_TO],
      subject: '✅ Diagnóstico del asistente', html: '<p>Si leés esto, el email del briefing funciona.</p>' } });
  add('✔', 'Resend', `email de prueba enviado a ${ENV.BRIEFING_EMAIL_TO} (id ${r.id})`);
});

// 8) ntfy (push al celular)
await check('ntfy', async () => {
  await http({ method: 'POST', url: String(ENV.NTFY_URL).replace(/\/$/, ''), json: true,
    headers: { Authorization: `Bearer ${ENV.NTFY_TOKEN}` },
    body: { topic: ENV.NTFY_TOPIC, title: '✅ Diagnóstico', message: 'Si ves esto en el celular, las alertas funcionan.', priority: 3 } });
  add('✔', 'ntfy', `push enviada al tema "${ENV.NTFY_TOPIC}" (mirá el celular)`);
});

// 9) Google Calendar (lo prueba el nodo anterior con tu credencial OAuth)
if (gcal.error || !gcal.id) {
  add('✘', 'Google Calendar', `sin acceso: ${errMsg(gcal.error || gcal)} → cargá la credencial "Google Calendar OAuth2 API" en los nodos GCal`);
} else {
  add(gcal.timeZone === TZ ? '✔' : '⚠', 'Google Calendar',
    `${gcal.summary} · zona ${gcal.timeZone}${gcal.timeZone === TZ ? '' : ` (conviene ${TZ} en la configuración de Calendar)`}`);
}

// Informe
const ok = rows.filter((r) => r.estado === '✔').length;
const html = `🩺 <b>Diagnóstico</b> · ${ok}/${rows.length} OK\n\n`
  + rows.map((r) => `${r.estado} <b>${escHtml(r.servicio)}</b>: ${escHtml(r.detalle)}`).join('\n');
if (ENV.TELEGRAM_BOT_TOKEN && ENV.TELEGRAM_ALLOWED_CHAT_ID) {
  await sendTelegram(ENV.TELEGRAM_ALLOWED_CHAT_ID, html).catch(() => {});
}
return rows.map((r) => ({ json: r }));
