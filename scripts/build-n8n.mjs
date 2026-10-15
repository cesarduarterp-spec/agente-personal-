#!/usr/bin/env node
// Genera los workflows importables de n8n (n8n/workflows/*.json) a partir de:
//   n8n/src/**.js            → código de cada nodo Code (con //@include _lib)
//   n8n/tools/gemini-tools.json
//   n8n/prompts/system-prompt.md
// Uso: node scripts/build-n8n.mjs   (valida además la sintaxis de cada nodo)
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const N8N = join(ROOT, 'n8n');
const read = (p) => readFileSync(join(N8N, p), 'utf8');

const LIB = read('src/_lib.js');
const TOOLS = JSON.parse(read('tools/gemini-tools.json'));
const SYSTEM_PROMPT = read('prompts/system-prompt.md');

/** Código final de un nodo Code. */
export function nodeCode(srcPath) {
  let code = read(srcPath)
    .replace('//@include _lib', LIB)
    .replace('/*__TOOLS__*/[]', JSON.stringify(TOOLS, null, 2))
    .replace("/*__SYSTEM_PROMPT__*/''", JSON.stringify(SYSTEM_PROMPT));
  // Validación de sintaxis: n8n ejecuta el código dentro de una función async
  new vm.Script(`(async function () {\n${code}\n})`, { filename: srcPath });
  return code;
}

const uuid = (seed) => {
  const h = createHash('sha1').update(seed).digest('hex');
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-4${h.slice(13, 16)}-a${h.slice(17, 20)}-${h.slice(20, 32)}`;
};

// ───────────── Fábricas de nodos ─────────────
const node = (wf, name, type, typeVersion, position, parameters, extra = {}) => ({
  id: uuid(`${wf}:${name}`), name, type, typeVersion, position, parameters, ...extra,
});
const code = (wf, name, pos, src, notes) =>
  node(wf, name, 'n8n-nodes-base.code', 2, pos, { jsCode: nodeCode(src) }, notes ? { notes, notesInFlow: true } : {});
const webhook = (wf, name, pos, path) =>
  node(wf, name, 'n8n-nodes-base.webhook', 2, pos,
    { httpMethod: 'POST', path, responseMode: 'onReceived', options: {} },
    { webhookId: uuid(`${wf}:${name}:webhook`) });
const schedule = (wf, name, pos, rule) =>
  node(wf, name, 'n8n-nodes-base.scheduleTrigger', 1.2, pos, { rule: { interval: [rule] } });
const eq = (left, right) => ({
  id: uuid(`${left}=${right}`),
  leftValue: left,
  rightValue: right,
  operator: { type: 'string', operation: 'equals' },
});
const conditions = (conds) => ({
  options: { caseSensitive: true, leftValue: '', typeValidation: 'strict', version: 2 },
  conditions: conds,
  combinator: 'and',
});
const switchOn = (wf, name, pos, field, keys) =>
  node(wf, name, 'n8n-nodes-base.switch', 3.2, pos, {
    rules: {
      values: keys.map((k) => ({
        conditions: conditions([eq(`={{ $json.${field} }}`, k)]),
        renameOutput: true,
        outputKey: k,
      })),
    },
    options: {},
  });
const ifNode = (wf, name, pos, left, right) =>
  node(wf, name, 'n8n-nodes-base.if', 2.2, pos, { conditions: conditions([eq(left, right)]), options: {} });
const httpReq = (wf, name, pos, p, extra = {}) =>
  node(wf, name, 'n8n-nodes-base.httpRequest', 4.2, pos, { options: {}, ...p }, extra);
const jsonBody = (expr) => ({ sendBody: true, specifyBody: 'json', jsonBody: expr });
const headers = (pairs) => ({
  sendHeaders: true,
  headerParameters: { parameters: Object.entries(pairs).map(([name, value]) => ({ name, value })) },
});
const SUPABASE_HEADERS = headers({
  apikey: '={{ $env.SUPABASE_SERVICE_ROLE_KEY }}',
  Authorization: '=Bearer {{ $env.SUPABASE_SERVICE_ROLE_KEY }}',
});
const GCAL_AUTH = { authentication: 'predefinedCredentialType', nodeCredentialType: 'googleCalendarOAuth2Api' };
const GCAL_EVENTS = 'https://www.googleapis.com/calendar/v3/calendars/primary/events';

/** connections: [[from, to, fromOutputIndex=0], ...] */
function workflow(name, nodes, links, settings = {}) {
  const connections = {};
  for (const [from, to, out = 0] of links) {
    connections[from] ??= { main: [] };
    const main = connections[from].main;
    while (main.length <= out) main.push([]);
    main[out].push({ node: to, type: 'main', index: 0 });
  }
  return {
    name,
    nodes,
    connections,
    active: false,
    settings: { executionOrder: 'v1', timezone: 'America/Argentina/San_Luis', saveManualExecutions: true, ...settings },
    pinData: {},
    meta: { templateCredsSetupCompleted: false },
    tags: [],
  };
}

// ───────────── WF1 · Telegram → Agente Gemini ─────────────
const W1 = 'wf1';
const wf1 = workflow('01 · Telegram → Agente Gemini (voz y texto)', [
  webhook(W1, 'Telegram Webhook', [0, 300], 'telegram'),
  code(W1, 'Validar y normalizar', [220, 300], 'src/telegram/validar.js', 'Secret header + chat autorizado'),
  switchOn(W1, 'Tipo de entrada', [440, 300], 'kind', ['voice', 'text', 'callback']),
  code(W1, 'Descargar audio (.ogg)', [680, 140], 'src/telegram/descargar-audio.js'),
  code(W1, 'Agente Gemini (Function Calling)', [920, 240], 'src/telegram/agente.js', 'Audio nativo + tools → Supabase RPC'),
  code(W1, 'Responder en Telegram', [1160, 240], 'src/telegram/responder.js'),
  code(W1, 'Acción de botón', [680, 480], 'src/telegram/boton.js', 'done / snooze_1h / tomorrow'),
], [
  ['Telegram Webhook', 'Validar y normalizar'],
  ['Validar y normalizar', 'Tipo de entrada'],
  ['Tipo de entrada', 'Descargar audio (.ogg)', 0],
  ['Tipo de entrada', 'Agente Gemini (Function Calling)', 1],
  ['Tipo de entrada', 'Acción de botón', 2],
  ['Descargar audio (.ogg)', 'Agente Gemini (Function Calling)'],
  ['Agente Gemini (Function Calling)', 'Responder en Telegram'],
]);

// ───────────── WF2 · Recordatorios cada 5 min ─────────────
const W2 = 'wf2';
const wf2 = workflow('02 · Motor de recordatorios (cada 5 min)', [
  schedule(W2, 'Cada 5 minutos', [0, 300], { field: 'minutes', minutesInterval: 5 }),
  code(W2, 'Reclamar recordatorios (RPC)', [220, 300], 'src/recordatorios/reclamar.js', 'Marca reminder_sent=true atómicamente'),
  code(W2, 'Telegram + botones', [440, 300], 'src/recordatorios/enviar.js'),
  ifNode(W2, '¿Prioridad alta?', [660, 300], '={{ $json.priority }}', 'alta'),
  httpReq(W2, 'ntfy · push crítico', [880, 220], {
    method: 'POST',
    url: '={{ $env.NTFY_URL }}',
    ...headers({ Authorization: '=Bearer {{ $env.NTFY_TOKEN }}' }),
    ...jsonBody(`={{ JSON.stringify({
  topic: $env.NTFY_TOPIC,
  title: '🔴 ' + $json.title,
  message: $json.category + ' · vence ' + ($json.due_local || 'sin fecha'),
  priority: 5,
  tags: ['rotating_light'],
  click: $env.APP_URL,
  actions: [{ action: 'view', label: 'Abrir agenda', url: $env.APP_URL }]
}) }}`),
  }, { onError: 'continueRegularOutput' }),
], [
  ['Cada 5 minutos', 'Reclamar recordatorios (RPC)'],
  ['Reclamar recordatorios (RPC)', 'Telegram + botones'],
  ['Telegram + botones', '¿Prioridad alta?'],
  ['¿Prioridad alta?', 'ntfy · push crítico', 0],
]);

// ───────────── WF3 · Briefing matutino ─────────────
const W3 = 'wf3';
const wf3 = workflow('03 · Briefing matutino 08:00', [
  schedule(W3, 'Todos los días 08:00', [0, 300], { field: 'cronExpression', expression: '0 8 * * *' }),
  httpReq(W3, 'Supabase · fn_briefing', [220, 300], {
    method: 'POST',
    url: '={{ $env.SUPABASE_URL }}/rest/v1/rpc/fn_briefing',
    ...SUPABASE_HEADERS,
    ...jsonBody('{}'),
  }),
  httpReq(W3, 'Clima · Open-Meteo', [440, 300], {
    url: '=https://api.open-meteo.com/v1/forecast?latitude={{ $env.WEATHER_LAT }}&longitude={{ $env.WEATHER_LON }}&current=temperature_2m,weather_code&daily=temperature_2m_max,temperature_2m_min,precipitation_probability_max,weather_code&timezone=America%2FArgentina%2FSan_Luis&forecast_days=1',
  }, { onError: 'continueRegularOutput' }),
  code(W3, 'Gemini · briefing + Telegram', [660, 300], 'src/briefing/redactar.js'),
  httpReq(W3, 'Resend · email HTML', [880, 300], {
    method: 'POST',
    url: 'https://api.resend.com/emails',
    ...headers({ Authorization: '=Bearer {{ $env.RESEND_API_KEY }}' }),
    ...jsonBody(`={{ JSON.stringify({
  from: $env.BRIEFING_EMAIL_FROM,
  to: [$env.BRIEFING_EMAIL_TO],
  subject: $json.subject,
  html: $json.html
}) }}`),
  }),
], [
  ['Todos los días 08:00', 'Supabase · fn_briefing'],
  ['Supabase · fn_briefing', 'Clima · Open-Meteo'],
  ['Clima · Open-Meteo', 'Gemini · briefing + Telegram'],
  ['Gemini · briefing + Telegram', 'Resend · email HTML'],
]);

// ───────────── WF4 · Google Calendar ⇄ Tareas ─────────────
const W4 = 'wf4';
const wf4 = workflow('04 · Sincronización Google Calendar ⇄ Tareas', [
  // A) Tareas → Calendar (Database Webhook de Supabase)
  webhook(W4, 'Supabase DB Webhook', [0, 200], 'gcal-sync'),
  code(W4, 'Filtrar cambios', [220, 200], 'src/gcal/filtrar-cambios.js', 'Ignora cambios de gcal/system (anti-bucle)'),
  switchOn(W4, 'Operación', [440, 200], 'op', ['create', 'update', 'delete']),
  httpReq(W4, 'GCal · crear evento', [680, 60], {
    method: 'POST', url: GCAL_EVENTS, ...GCAL_AUTH, ...jsonBody('={{ JSON.stringify($json.event) }}'),
  }),
  code(W4, 'Guardar gcal_event_id', [900, 60], 'src/gcal/guardar-event-id.js'),
  httpReq(W4, 'GCal · actualizar evento', [680, 200], {
    method: 'PATCH', url: `=${GCAL_EVENTS}/{{ $json.event_id }}`, ...GCAL_AUTH,
    ...jsonBody('={{ JSON.stringify($json.event) }}'),
  }, { onError: 'continueRegularOutput' }),
  httpReq(W4, 'GCal · borrar evento', [680, 340], {
    method: 'DELETE', url: `=${GCAL_EVENTS}/{{ $json.event_id }}`, ...GCAL_AUTH,
  }, { onError: 'continueRegularOutput' }),
  // B) Calendar → Tareas (polling incremental)
  schedule(W4, 'Cada 5 minutos', [0, 560], { field: 'minutes', minutesInterval: 5 }),
  httpReq(W4, 'GCal · eventos modificados', [220, 560], {
    url: `=${GCAL_EVENTS}?updatedMin={{ encodeURIComponent($now.minus({ minutes: 7 }).toUTC().toISO()) }}&showDeleted=true&singleEvents=true&maxResults=250`,
    ...GCAL_AUTH,
  }),
  code(W4, 'Aplicar a tareas (RPC)', [440, 560], 'src/gcal/aplicar-a-tareas.js', 'No-op si no cambió nada'),
], [
  ['Supabase DB Webhook', 'Filtrar cambios'],
  ['Filtrar cambios', 'Operación'],
  ['Operación', 'GCal · crear evento', 0],
  ['Operación', 'GCal · actualizar evento', 1],
  ['Operación', 'GCal · borrar evento', 2],
  ['GCal · crear evento', 'Guardar gcal_event_id'],
  ['Cada 5 minutos', 'GCal · eventos modificados'],
  ['GCal · eventos modificados', 'Aplicar a tareas (RPC)'],
]);

const out = join(N8N, 'workflows');
mkdirSync(out, { recursive: true });
const files = {
  '01-telegram-agente.json': wf1,
  '02-recordatorios.json': wf2,
  '03-briefing-diario.json': wf3,
  '04-gcal-sync.json': wf4,
};
for (const [file, wf] of Object.entries(files)) {
  writeFileSync(join(out, file), JSON.stringify(wf, null, 2) + '\n');
  console.log(`✓ n8n/workflows/${file}  (${wf.nodes.length} nodos)`);
}
