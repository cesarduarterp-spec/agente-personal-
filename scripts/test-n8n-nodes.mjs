#!/usr/bin/env node
// Prueba de integración de los nodos Code de n8n SIN n8n:
//   - Supabase RPC  → se ejecuta contra un PostgreSQL real (psql) con database/001_init.sql aplicado
//   - Telegram / Gemini / HTTP externos → mocks con respuestas guionadas
// Uso: PGURL="postgresql://postgres@/postgres?host=/var/tmp/pgtest&port=5499" node scripts/test-n8n-nodes.mjs
import { readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import assert from 'node:assert/strict';

const PGURL = process.env.PGURL;
if (!PGURL) { console.error('Definí PGURL'); process.exit(1); }

const psql = (sql) => execFileSync('psql', [PGURL, '-qAt', '-v', 'ON_ERROR_STOP=1', '-c', sql], { encoding: 'utf8' }).trim();
const lit = (v) => {
  if (Array.isArray(v)) return `'{${v.join(',')}}'`;
  if (typeof v === 'object') return `$j$${JSON.stringify(v)}$j$`;
  if (typeof v === 'number' || typeof v === 'boolean') return String(v);
  return `$q$${v}$q$`;
};

const wf = (f) => JSON.parse(readFileSync(new URL(`../n8n/workflows/${f}`, import.meta.url)));
const nodeCode = (f, name) => wf(f).nodes.find((n) => n.name === name).parameters.jsCode;

const ENV = {
  SUPABASE_URL: 'https://sb.test', SUPABASE_SERVICE_ROLE_KEY: 'srv', TELEGRAM_BOT_TOKEN: 'TOKEN',
  TELEGRAM_WEBHOOK_SECRET: 's3cret', TELEGRAM_ALLOWED_CHAT_ID: '42', GEMINI_API_KEY: 'g',
  GCAL_SYNC_SECRET: 'gs', XAI_API_KEY: 'xk', APP_URL: 'https://app.test', USER_NAME: 'César',
  GROK_MODEL: 'grok-4.3', NTFY_URL: 'https://ntfy.test', NTFY_TOPIC: 'alertas', NTFY_TOKEN: 'tk_x',
  RESEND_API_KEY: 're_x', BRIEFING_EMAIL_FROM: 'A <a@x.com>', BRIEFING_EMAIL_TO: 'yo@x.com',
  WEBHOOK_URL: 'https://n8n.test/',
};
let xaiModels = ['grok-4.3', 'grok-4.5', 'grok-imagine-image'];

let TZ_ENV = 'America/Argentina/Buenos_Aires';
let geminiScript = [];
let grokScript = [];
const calls = [];
async function httpRequest(o) {
  calls.push(o);
  const url = new URL(o.url);
  if (url.host === 'sb.test' && url.pathname.startsWith('/rest/v1/rpc/')) {
    const fn = url.pathname.split('/').pop();
    const args = Object.entries(o.body || {}).map(([k, v]) => `${k} => ${lit(v)}`).join(', ');
    const out = psql(`select to_jsonb(${fn}(${args}))`);
    return out ? JSON.parse(out) : null;
  }
  if (url.host === 'sb.test' && url.pathname === '/rest/v1/tasks') {
    const id = url.searchParams.get('id').replace('eq.', '');
    if (o.method === 'PATCH') return psql(`update tasks set reminder_sent = false where id = '${id}'`);
    return JSON.parse(psql(`select coalesce(jsonb_agg(jsonb_build_object('description', description)), '[]') from tasks where id = '${id}'`));
  }
  if (url.host === 'api.telegram.org') {
    if (url.pathname.endsWith('/getFile')) return { ok: true, result: { file_path: 'voice/file_1.oga' } };
    if (url.pathname.includes('/file/')) return { type: 'Buffer', data: [79, 103, 103, 83] }; // "OggS"
    if (url.pathname.endsWith('/getMe')) return { ok: true, result: { username: 'MiBot' } };
    if (url.pathname.endsWith('/getWebhookInfo')) return { ok: true, result: { url: 'https://n8n.test/webhook/telegram' } };
    return { ok: true, result: { message_id: 999 } };
  }
  if (url.host === 'generativelanguage.googleapis.com') {
    const step = geminiScript.shift();
    assert.ok(step, 'Llamada a Gemini inesperada');
    return step(o.body);
  }
  if (url.host === 'api.x.ai' && url.pathname === '/v1/models') return { data: xaiModels.map((id) => ({ id })) };
  if (url.host === 'api.x.ai' && url.pathname === '/v1/stt') {
    assert.match(o.headers['Content-Type'], /^multipart\/form-data; boundary=/);
    assert.ok(o.body.includes('RIFF') && o.body.includes('name="file"'));
    return { text: '', language: 'es' };
  }
  if (url.host === 'api.resend.com') return { id: 'em_1' };
  if (url.host === 'ntfy.test') return { id: 'n1' };
  if (url.host === 'sb.test' && url.pathname === '/rest/v1/app_config') {
    return JSON.parse(psql("select coalesce(jsonb_agg(to_jsonb(c)), '[]') from app_config c"));
  }
  if (url.host === 'api.x.ai' && url.pathname === '/v1/responses') {
    const step = grokScript.shift();
    assert.ok(step, 'Llamada a Grok inesperada');
    return step(o.body);
  }
  throw new Error(`HTTP no mockeado: ${o.url}`);
}

async function run(code, items, refs = {}) {
  const ctx = { helpers: { httpRequest } };
  const $input = { first: () => items[0], all: () => items };
  const $ = (name) => ({ first: () => { if (!refs[name]) throw new Error(`nodo ${name} no ejecutado`); return refs[name][0]; } });
  const now = new Date(Date.now() - 3 * 3600e3); // hora argentina (UTC-3)
  const $now = {
    zoneName: TZ_ENV,
    toFormat: (f) => f === 'HH:mm' ? now.toISOString().slice(11, 16) : now.toISOString().slice(8, 10) + '/' + now.toISOString().slice(5, 7) + ' ' + now.toISOString().slice(11, 16),
  };
  const fn = new Function('$env', '$input', '$', '$now', `return (async function () {\n${code}\n}).call(this);`);
  return fn.call(ctx, ENV, $input, $, $now);
}

const fc = (name, args) => ({ candidates: [{ content: { role: 'model', parts: [{ functionCall: { name, args } }] } }] });
const txt = (text) => ({ candidates: [{ content: { role: 'model', parts: [{ text }] } }] });
const tgSent = (method) => calls.filter((c) => c.url.endsWith(`/${method}`));

psql('truncate tasks, agent_messages');

// 1) Texto → crear tarea
let out = await run(nodeCode('01-telegram-agente.json', 'Validar y normalizar'), [{ json: {
  headers: { 'x-telegram-bot-api-secret-token': 's3cret' },
  body: { message: { message_id: 7, chat: { id: 42 }, text: 'Mañana 10hs llamar al proveedor de hormigón, urgente' } },
} }]);
assert.equal(out[0].json.kind, 'text');

geminiScript = [
  (body) => {
    assert.match(body.systemInstruction.parts[0].text, /César/);
    const names = body.tools[0].functionDeclarations.map((t) => t.name);
    assert.equal(names.length, 7);
    assert.ok(!names.includes('web_search'));
    return fc('create_task', { title: 'Llamar al proveedor de hormigón', category: '#Constructora', priority: 'alta', due_date: '2026-10-16T10:00:00-03:00' });
  },
  (body) => {
    assert.equal(body.contents.at(-1).parts[0].functionResponse.response.result.status, 'created');
    return txt('✅ Creada **Llamar al proveedor de hormigón** para jue 16/10 10:00');
  },
];
out = await run(nodeCode('01-telegram-agente.json', 'Agente Gemini (Function Calling)'), out);
assert.equal(out[0].json.actions[0].status, 'created');
await run(nodeCode('01-telegram-agente.json', 'Responder en Telegram'), out);
const sent = tgSent('sendMessage').at(-1).body;
assert.match(sent.text, /<b>Llamar al proveedor de hormigón<\/b>/);
assert.match(sent.reply_markup.inline_keyboard[0][0].callback_data, /^t:done:[0-9a-f-]{36}$/);
console.log('✓ texto → create_task → respuesta con botones');

// 2) Nota de voz → completar por coincidencia semántica
out = await run(nodeCode('01-telegram-agente.json', 'Validar y normalizar'), [{ json: {
  headers: { 'x-telegram-bot-api-secret-token': 's3cret' },
  body: { message: { message_id: 8, chat: { id: 42 }, voice: { file_id: 'F1', mime_type: 'audio/ogg' } } },
} }]);
out = await run(nodeCode('01-telegram-agente.json', 'Descargar audio (.ogg)'), out);
assert.equal(out[0].json.audio_b64, Buffer.from('OggS').toString('base64'));
geminiScript = [
  (body) => {
    assert.equal(body.contents.at(-1).parts[0].inlineData.mimeType, 'audio/ogg');
    assert.match(body.systemInstruction.parts[0].text, /Llamar al proveedor de hormigón/);
    return fc('complete_task', { query: 'proveedor hormigon' });
  },
  () => txt('✅ Listo, tachada.'),
];
out = await run(nodeCode('01-telegram-agente.json', 'Agente Gemini (Function Calling)'), out);
assert.equal(out[0].json.actions[0].status, 'completed');
assert.equal(psql("select status from tasks limit 1"), 'completada');
console.log('✓ voz (.ogg inline) → complete_task semántico');

// 3) Botón inline
psql("update tasks set status = 'pendiente'");
const id = psql('select id from tasks limit 1');
out = await run(nodeCode('01-telegram-agente.json', 'Validar y normalizar'), [{ json: {
  headers: { 'x-telegram-bot-api-secret-token': 's3cret' },
  body: { callback_query: { id: 'cb1', data: `t:snooze_1h:${id}`, message: { message_id: 9, chat: { id: 42 }, text: 'Recordatorio' } } },
} }]);
await run(nodeCode('01-telegram-agente.json', 'Acción de botón'), out);
assert.match(tgSent('editMessageText').at(-1).body.text, /Pospuesta 1 hora/);
assert.equal(psql(`select reminder_at > now() + interval '59 min' from tasks where id = '${id}'`), 't');
console.log('✓ callback_query → fn_task_action + editMessageText');

// 4) Seguridad: secreto inválido / chat ajeno
out = await run(nodeCode('01-telegram-agente.json', 'Validar y normalizar'), [{ json: { headers: {}, body: { message: { chat: { id: 42 }, text: 'x' } } } }]);
assert.equal(out.length, 0);
out = await run(nodeCode('01-telegram-agente.json', 'Validar y normalizar'), [{ json: { headers: { 'x-telegram-bot-api-secret-token': 's3cret' }, body: { message: { chat: { id: 1 }, text: 'x' } } } }]);
assert.equal(out.length, 0);
console.log('✓ rechaza webhooks sin secreto y chats no autorizados');

// 5) Recordatorios
psql(`update tasks set reminder_at = now() - interval '1 min', reminder_sent = false where id = '${id}'`);
out = await run(nodeCode('02-recordatorios.json', 'Reclamar recordatorios (RPC)'), [{ json: {} }]);
assert.equal(out.length, 1);
out = await run(nodeCode('02-recordatorios.json', 'Telegram + botones'), out);
assert.equal(out[0].json.telegram_sent, true);
assert.equal(psql(`select reminder_sent from tasks where id = '${id}'`), 't');
out = await run(nodeCode('02-recordatorios.json', 'Reclamar recordatorios (RPC)'), [{ json: {} }]);
assert.equal(out.length, 0);
console.log('✓ recordatorios: claim atómico, sin duplicados');

// 6) Briefing
geminiScript = [() => txt('Arrancá por lo urgente.\n- **Llamar al proveedor de hormigón**')];
const briefing = JSON.parse(psql('select fn_briefing()'));
out = await run(nodeCode('03-briefing-diario.json', 'Gemini · briefing + Telegram'), [{ json: {} }], {
  'Supabase · fn_briefing': [{ json: briefing }],
  'Clima · Open-Meteo': [{ json: { current: { temperature_2m: 14 }, daily: { temperature_2m_max: [22], temperature_2m_min: [8], precipitation_probability_max: [10], weather_code: [1] } } }],
});
assert.match(out[0].json.html, /Briefing del día/);
assert.match(tgSent('sendMessage').at(-1).body.text, /Briefing/);
console.log('✓ briefing: Telegram + HTML de email');

// 7) Google Calendar: filtro anti-bucle
const rec = JSON.parse(psql(`select to_jsonb(t) from tasks t where id = '${id}'`));
const filt = nodeCode('04-gcal-sync.json', 'Filtrar cambios');
out = await run(filt, [{ json: { headers: { 'x-sync-secret': 'gs' }, body: { type: 'UPDATE', record: { ...rec, last_modified_by: 'pwa', title: 'Nuevo' }, old_record: rec } } }]);
assert.equal(out[0].json.op, 'create');
out = await run(filt, [{ json: { headers: { 'x-sync-secret': 'gs' }, body: { type: 'UPDATE', record: { ...rec, last_modified_by: 'gcal', title: 'Nuevo' }, old_record: rec } } }]);
assert.equal(out.length, 0);
console.log('✓ gcal: crea eventos y corta bucles');

// 8) Respaldo Grok: Gemini caído (503 dos veces) con nota de voz → transcripción xAI → Grok
const down = () => { const e = new Error('503 Service Unavailable'); e.httpCode = '503'; throw e; };
psql("truncate tasks");
let voice = await run(nodeCode('01-telegram-agente.json', 'Validar y normalizar'), [{ json: {
  headers: { 'x-telegram-bot-api-secret-token': 's3cret' },
  body: { message: { message_id: 20, chat: { id: 42 }, voice: { file_id: 'F2', mime_type: 'audio/ogg' } } },
} }]);
voice = await run(nodeCode('01-telegram-agente.json', 'Descargar audio (.ogg)'), voice);
assert.equal(voice[0].binary.audio.mimeType, 'audio/ogg');
geminiScript = [down, down];
const gem = await run(nodeCode('01-telegram-agente.json', 'Agente Gemini (Function Calling)'), voice);
assert.equal(gem[0].json.fallback, true);
assert.ok(gem[0].binary.audio, 'el audio debe llegar al nodo de transcripción');
grokScript = [
  (body) => {
    assert.equal(body.model, 'grok-4.3');
    assert.equal(body.tools.length, 7);
    assert.equal(body.input.at(-1).content, 'mañana a las 9 llamar al contador');
    return { output: [{ type: 'function_call', call_id: 'c1', name: 'create_task',
      arguments: JSON.stringify({ title: 'Llamar al contador', category: '#Personal', priority: 'media', due_date: '2026-10-16T09:00:00-03:00' }) }] };
  },
  (body) => {
    assert.equal(body.input.at(-1).type, 'function_call_output');
    assert.equal(JSON.parse(body.input.at(-1).output).status, 'created');
    return { output: [{ type: 'message', content: [{ type: 'output_text', text: '✅ Agendado **Llamar al contador**' }] }] };
  },
];
out = await run(nodeCode('01-telegram-agente.json', 'Agente Grok (respaldo)'),
  [{ json: { text: 'mañana a las 9 llamar al contador', language: 'es' } }],
  { 'Agente Gemini (Function Calling)': gem });
assert.equal(out[0].json.provider, 'grok');
assert.equal(psql("select count(*) from tasks where title = 'Llamar al contador'"), '1');
await run(nodeCode('01-telegram-agente.json', 'Responder en Telegram'), out);
const fb = tgSent('sendMessage').at(-1).body;
assert.match(fb.text, /«mañana a las 9 llamar al contador»/);
assert.match(fb.text, /Respondió Grok/);
assert.ok(fb.reply_markup, 'botones de la tarea creada por Grok');
console.log('✓ respaldo: Gemini caído → STT xAI → Grok crea la tarea');

// 9) Gemini falla a mitad del bucle: Grok recibe las acciones hechas y no las repite
let txtIn = await run(nodeCode('01-telegram-agente.json', 'Validar y normalizar'), [{ json: {
  headers: { 'x-telegram-bot-api-secret-token': 's3cret' },
  body: { message: { message_id: 21, chat: { id: 42 }, text: 'Agendá revisar planos el viernes 10hs' } },
} }]);
geminiScript = [
  () => fc('create_task', { title: 'Revisar planos', category: '#Constructora', priority: 'media', due_date: '2026-10-16T10:00:00-03:00' }),
  down, down,
];
const gem2 = await run(nodeCode('01-telegram-agente.json', 'Agente Gemini (Function Calling)'), txtIn);
assert.equal(gem2[0].json.fallback, true);
assert.equal(gem2[0].json.actions_done.length, 1);
grokScript = [(body) => {
  assert.match(body.input[0].content, /YA ejecutó estas acciones/);
  return { output_text: '✅ Listo, **Revisar planos** quedó para el viernes 10:00.' };
}];
out = await run(nodeCode('01-telegram-agente.json', 'Agente Grok (respaldo)'), gem2, { 'Agente Gemini (Function Calling)': gem2 });
assert.equal(psql("select count(*) from tasks where title = 'Revisar planos'"), '1');
assert.equal(out[0].json.actions.length, 1);
console.log('✓ respaldo: falla a mitad de camino sin duplicar tareas');

// 10) Gemini y la transcripción fallan → mensaje claro, sin inventar
out = await run(nodeCode('01-telegram-agente.json', 'Agente Grok (respaldo)'),
  [{ json: { error: { message: 'xAI 500' } } }], { 'Agente Gemini (Function Calling)': gem });
assert.match(out[0].json.reply, /mandás por texto/);
console.log('✓ respaldo: si todo falla, pide reenviar por texto');

// 11) Briefing con Gemini caído → Grok redacta
geminiScript = [down, down];
grokScript = [() => ({ output_text: 'Día cargado: arrancá por **Revisar planos**.' })];
out = await run(nodeCode('03-briefing-diario.json', 'Gemini · briefing + Telegram'), [{ json: {} }], {
  'Supabase · fn_briefing': [{ json: JSON.parse(psql('select fn_briefing()')) }],
  'Clima · Open-Meteo': [{ json: {} }],
});
assert.match(out[0].json.html, /Revisar planos/);
console.log('✓ briefing: respaldo con Grok y clima caído');

// 12) /grok fuerza el respaldo sin llamar a Gemini
let g = await run(nodeCode('01-telegram-agente.json', 'Validar y normalizar'), [{ json: {
  headers: { 'x-telegram-bot-api-secret-token': 's3cret' },
  body: { message: { message_id: 30, chat: { id: 42 }, text: '/grok qué tengo hoy' } },
} }]);
geminiScript = [];
const forced = await run(nodeCode('01-telegram-agente.json', 'Agente Gemini (Function Calling)'), g);
assert.equal(forced[0].json.fallback, true);
assert.equal(forced[0].json.forced, true);
assert.equal(forced[0].json.text, 'qué tengo hoy');
grokScript = [(body) => { assert.equal(body.input.at(-1).content, 'qué tengo hoy'); return { output_text: 'Hoy tenés 2 tareas.' }; }];
out = await run(nodeCode('01-telegram-agente.json', 'Agente Grok (respaldo)'), forced, { 'Agente Gemini (Function Calling)': forced });
await run(nodeCode('01-telegram-agente.json', 'Responder en Telegram'), out);
assert.match(tgSent('sendMessage').at(-1).body.text, /Prueba de respaldo: respondió Grok \(grok-4\.3\)/);
ENV.FORZAR_GROK = 'true';
const forced2 = await run(nodeCode('01-telegram-agente.json', 'Agente Gemini (Function Calling)'), voice);
assert.equal(forced2[0].json.forced, true);
assert.ok(forced2[0].binary.audio);
delete ENV.FORZAR_GROK;
console.log('✓ /grok y FORZAR_GROK prueban el respaldo a propósito');

// 13) Zona horaria: "mañana a las 10" → aviso 09:45 hora argentina
assert.equal(psql('select app_tz()'), 'America/Argentina/Buenos_Aires');
geminiScript = [
  () => fc('create_task', { title: 'Llamar al arquitecto', category: '#Constructora', priority: 'alta', due_date: '2030-05-14T10:00:00-03:00' }),
  () => txt('✅ Agendado'),
];
await run(nodeCode('01-telegram-agente.json', 'Agente Gemini (Function Calling)'), txtIn);
const local = psql(`select to_char(due_date at time zone 'America/Argentina/Buenos_Aires', 'YYYY-MM-DD HH24:MI') || ' | ' ||
  to_char(reminder_at at time zone 'America/Argentina/Buenos_Aires', 'HH24:MI') || ' | ' || pg_typeof(due_date) || ' | ' || pg_typeof(reminder_at)
  from tasks where title = 'Llamar al arquitecto'`);
assert.equal(local, '2030-05-14 10:00 | 09:45 | timestamp with time zone | timestamp with time zone');
console.log('✓ zona horaria: 10:00 → recordatorio 09:45 (Buenos Aires), guardado con zona');

// 14) Categorías idénticas en base, tools, instrucciones y app
const CATS = ['#Constructora', '#AgenciaViajes', '#ConsultoraIA', '#Estudio', '#Personal'];
const src = (p) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');
const sqlCats = src('database/001_init.sql').match(/category in \(([^)]+)\)/)[1].match(/'([^']+)'/g).map((x) => x.slice(1, -1));
assert.deepEqual(sqlCats, CATS, 'base de datos');
for (const t of JSON.parse(src('n8n/tools/agent-tools.json'))) {
  const enumCats = t.parameters.properties.category?.enum;
  if (enumCats) assert.deepEqual(enumCats, CATS, `tool ${t.name}`);
}
for (const c of CATS) {
  assert.ok(src('n8n/prompts/system-prompt.md').includes(c), `prompt: ${c}`);
  assert.ok(src('web/src/lib/types.ts').includes(`'${c}'`), `app: ${c}`);
  assert.ok(nodeCode('01-telegram-agente.json', 'Agente Grok (respaldo)').includes(c), `Grok: ${c}`);
  assert.ok(nodeCode('01-telegram-agente.json', 'Agente Gemini (Function Calling)').includes(c), `Gemini: ${c}`);
}
console.log('✓ categorías idénticas (con #) en base, tools, Gemini, Grok y app');

// 15) Diagnóstico
psql(`insert into app_config values ('gcal_webhook_url','https://n8n.test/webhook/gcal-sync') on conflict (key) do update set value = excluded.value`);
const diag = nodeCode('05-diagnostico.json', 'Probar conexiones');
geminiScript = [() => txt('OK')];
grokScript = [() => ({ output_text: 'OK' })];
let rep = await run(diag, [{ json: { id: 'yo@x.com', summary: 'César', timeZone: 'America/Argentina/Buenos_Aires' } }]);
const fails = rep.filter((r) => r.json.estado !== '✔').map((r) => `${r.json.servicio}: ${r.json.detalle}`);
assert.deepEqual(fails, [], fails.join('\n'));
assert.equal(rep.length, 10);
assert.ok(tgSent('setWebhook').length >= 1);
// modelo inexistente + Google sin credencial + webhook sin secreto
xaiModels = ['grok-4.5', 'grok-4.7'];
geminiScript = [() => txt('OK')];
ENV.GROK_MODEL = 'grok-9';
rep = await run(diag, [{ json: { error: { message: 'Credentials not found' } } }]);
const byName = Object.fromEntries(rep.map((r) => [r.json.servicio, r.json]));
assert.equal(byName.Grok.estado, '✘');
assert.match(byName.Grok.detalle, /NO existe.*grok-4\.5, grok-4\.7/);
assert.equal(byName['Google Calendar'].estado, '✘');
ENV.GROK_MODEL = 'grok-4.3';
rep = await run(diag, [{ json: {} }], { 'Diagnóstico por Telegram': [{ json: { headers: {} } }] });
assert.equal(rep.length, 0);
console.log('✓ diagnóstico: informa ✔/✘ por servicio, detecta modelo de Grok inexistente');

console.log('\nTodos los nodos OK');
