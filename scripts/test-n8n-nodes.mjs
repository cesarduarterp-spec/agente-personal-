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
  GCAL_SYNC_SECRET: 'gs', APP_URL: 'https://app.test', USER_NAME: 'César',
};

let geminiScript = [];
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
    return { ok: true, result: { message_id: 999 } };
  }
  if (url.host === 'generativelanguage.googleapis.com') {
    const step = geminiScript.shift();
    assert.ok(step, 'Llamada a Gemini inesperada');
    return step(o.body);
  }
  throw new Error(`HTTP no mockeado: ${o.url}`);
}

async function run(code, items, refs = {}) {
  const ctx = { helpers: { httpRequest } };
  const $input = { first: () => items[0], all: () => items };
  const $ = (name) => ({ first: () => refs[name][0] });
  const fn = new Function('$env', '$input', '$', `return (async function () {\n${code}\n}).call(this);`);
  return fn.call(ctx, ENV, $input, $);
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
    assert.ok(body.tools[0].functionDeclarations.length >= 8);
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

console.log('\nTodos los nodos OK');
