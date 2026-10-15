//@include _lib
// Agente Gemini con Function Calling.
// Entrada: { kind: 'voice'|'text', chat_id, text?, audio_b64?, mime_type? }
// Bucle: Gemini decide herramientas → se ejecutan contra Supabase (RPC) → se le devuelven
// los resultados → repite hasta obtener una respuesta final en texto (máx. MAX_TURNS).
const TOOLS = /*__TOOLS__*/[];
const SYSTEM_TEMPLATE = /*__SYSTEM_PROMPT__*/'';
const MAX_TURNS = 6;

const input = $input.first().json;
const chatId = input.chat_id;

// 1) Contexto: hora local, tareas abiertas e historial corto
const ctx = await rpc('fn_agent_context', { p_chat_id: chatId });
const openTasks = (ctx.open_tasks || [])
  .map((t) => `- id=${t.id} | ${t.title} | ${t.category} | ${t.priority} | ${t.status} | ${t.due_local || 'sin fecha'}`)
  .join('\n') || '(no hay tareas abiertas)';

const systemText = SYSTEM_TEMPLATE
  .replace('{{USER_NAME}}', ENV.USER_NAME || 'el usuario')
  .replace('{{NOW_LOCAL}}', ctx.now_local)
  .replace('{{WEEKDAY}}', ctx.weekday)
  .replace('{{OPEN_TASKS}}', openTasks);

const contents = (ctx.history || []).map((m) => ({ role: m.role, parts: [{ text: m.content }] }));

// 2) Mensaje actual: audio nativo (multimodal) o texto
const userParts = input.kind === 'voice'
  ? [
      { inlineData: { mimeType: input.mime_type || 'audio/ogg', data: input.audio_b64 } },
      { text: 'Nota de voz del usuario. Escuchala y ejecutá lo que pide.' + (input.caption ? ` Texto adjunto: ${input.caption}` : '') },
    ]
  : [{ text: input.text }];
contents.push({ role: 'user', parts: userParts });

// 3) Implementación de cada herramienta
async function webSearch({ query, attach_to_task_id }) {
  const res = await gemini({
    contents: [{ role: 'user', parts: [{ text:
      `Investigá y respondé en español, en 5-8 viñetas concretas y verificables: ${query}` }] }],
    tools: [{ google_search: {} }],
  });
  const summary = geminiText(res);
  const sources = (res?.candidates?.[0]?.groundingMetadata?.groundingChunks || [])
    .map((c) => c.web).filter(Boolean).slice(0, 5)
    .map((w) => ({ title: w.title, url: w.uri }));

  if (attach_to_task_id) {
    const [task] = await http({
      method: 'GET',
      url: `${SB_URL}/rest/v1/tasks?id=eq.${attach_to_task_id}&select=description`,
      headers: SB_HEADERS, json: true,
    });
    const block = `🔎 ${query}\n${summary}\n` + sources.map((s) => `- ${s.title}: ${s.url}`).join('\n');
    await rpc('fn_update_task', {
      p_task_id: attach_to_task_id,
      p_patch: { description: [task?.description, block].filter(Boolean).join('\n\n') },
    });
  }
  return { summary, sources, attached_to: attach_to_task_id || null };
}

const handlers = {
  create_task: (a) => rpc('fn_create_task', {
    p_title: a.title, p_description: a.description, p_category: a.category,
    p_priority: a.priority, p_due_date: a.due_date, p_reminder_at: a.reminder_at, p_source: 'telegram',
  }),
  list_tasks: (a) => rpc('fn_list_tasks', {
    p_range: a.range, p_from: a.from, p_to: a.to, p_category: a.category,
    p_statuses: a.include_completed ? ['pendiente', 'en_progreso', 'completada'] : undefined,
  }),
  find_tasks: (a) => rpc('fn_find_tasks', { p_query: a.query, p_limit: a.limit }),
  complete_task: (a) => rpc('fn_complete_task', { p_task_id: a.task_id, p_query: a.query, p_by: 'telegram' }),
  update_task: ({ task_id, ...patch }) => rpc('fn_update_task', { p_task_id: task_id, p_patch: patch, p_by: 'telegram' }),
  reschedule_task: (a) => rpc('fn_reschedule_task', {
    p_task_id: a.task_id, p_new_due: a.new_due_date, p_shift_minutes: a.shift_minutes,
    p_cascade: a.cascade === true ? true : undefined, p_by: 'telegram',
  }),
  cancel_task: (a) => rpc('fn_task_action', { p_task_id: a.task_id, p_action: 'cancel', p_by: 'telegram' }),
  web_search: webSearch,
};

// 4) Bucle agente
let reply = '';
const actions = [];
for (let turn = 0; turn < MAX_TURNS; turn++) {
  const res = await gemini({
    systemInstruction: { parts: [{ text: systemText }] },
    contents,
    tools: [{ functionDeclarations: TOOLS }],
    toolConfig: { functionCallingConfig: { mode: 'AUTO' } },
    generationConfig: { temperature: 0.3 },
  });

  const candidate = res?.candidates?.[0];
  const parts = candidate?.content?.parts || [];
  const calls = parts.filter((p) => p.functionCall);

  if (calls.length === 0) {
    reply = geminiText(res);
    break;
  }

  // Se reenvía el turno del modelo tal cual (conserva thought signatures de 2.5)
  contents.push(candidate.content);

  const responses = [];
  for (const { functionCall } of calls) {
    const { name, args = {} } = functionCall;
    let result;
    try {
      if (!handlers[name]) throw new Error(`Herramienta desconocida: ${name}`);
      result = await handlers[name](args);
    } catch (e) {
      result = { status: 'error', message: e.message };
    }
    actions.push({ name, args, status: result?.status, task_id: result?.task?.id || null });
    responses.push({ functionResponse: { name, response: { result } } });
  }
  contents.push({ role: 'user', parts: responses });
}

if (!reply) reply = actions.length ? '✅ Hecho.' : 'No pude procesar el pedido, ¿me lo repetís?';

// 5) Memoria corta: guardamos el intercambio (el audio se registra como marcador + acciones)
const actionNote = actions.length
  ? `\n[acciones: ${actions.map((a) => `${a.name}${a.args.task_id ? '(' + a.args.task_id + ')' : a.args.title ? '(' + a.args.title + ')' : ''}`).join(', ')}]`
  : '';
await rpc('fn_log_message', {
  p_chat_id: chatId, p_role: 'user',
  p_content: input.kind === 'voice' ? '[nota de voz]' : input.text,
}).catch(() => {});
await rpc('fn_log_message', { p_chat_id: chatId, p_role: 'model', p_content: reply + actionNote }).catch(() => {});

return [{ json: { chat_id: chatId, reply_to: input.message_id, reply, actions } }];
