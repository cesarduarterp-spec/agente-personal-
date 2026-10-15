// ─── Lógica compartida del agente (Gemini y Grok usan las mismas tools) ───
const TOOLS = /*__TOOLS__*/[];
const SYSTEM_TEMPLATE = /*__SYSTEM_PROMPT__*/'';
const MAX_TURNS = 6;

/** Contexto: hora local, tareas abiertas e historial corto → system prompt. */
async function buildContext(chatId) {
  const ctx = await rpc('fn_agent_context', { p_chat_id: chatId });
  const openTasks = (ctx.open_tasks || [])
    .map((t) => `- id=${t.id} | ${t.title} | ${t.category} | ${t.priority} | ${t.status} | ${t.due_local || 'sin fecha'}`)
    .join('\n') || '(no hay tareas abiertas)';
  const systemText = SYSTEM_TEMPLATE
    .replace('{{USER_NAME}}', ENV.USER_NAME || 'el usuario')
    .replace('{{NOW_LOCAL}}', ctx.now_local)
    .replace('{{WEEKDAY}}', ctx.weekday)
    .replace('{{OPEN_TASKS}}', openTasks);
  return { systemText, history: ctx.history || [] };
}

const TOOL_HANDLERS = {
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
};

/** Ejecuta una tool y registra la acción. Los errores de la tool vuelven al modelo, no cortan el bucle. */
async function runTool(name, args, actions) {
  let result;
  try {
    if (!TOOL_HANDLERS[name]) throw new Error(`Herramienta desconocida: ${name}`);
    result = await TOOL_HANDLERS[name](args || {});
  } catch (e) {
    result = { status: 'error', message: e.message };
  }
  actions.push({ name, args: args || {}, status: result?.status, task_id: result?.task?.id || null });
  return result;
}

/** Guarda el intercambio en la memoria corta (agent_messages). */
async function logExchange(chatId, userText, reply, actions) {
  const note = actions.length
    ? `\n[acciones: ${actions.map((a) => `${a.name}${a.args.task_id ? '(' + a.args.task_id + ')' : a.args.title ? '(' + a.args.title + ')' : ''}`).join(', ')}]`
    : '';
  await rpc('fn_log_message', { p_chat_id: chatId, p_role: 'user', p_content: userText }).catch(() => {});
  await rpc('fn_log_message', { p_chat_id: chatId, p_role: 'model', p_content: reply + note }).catch(() => {});
}
// ─── fin agente compartido ───
