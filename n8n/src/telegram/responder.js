//@include _lib
// Envía la respuesta del agente. Si se creó exactamente una tarea, agrega los botones de acción.
const { chat_id, reply_to, reply, actions = [], provider, forced } = $input.first().json;

const created = actions.filter((a) => a.name === 'create_task' && a.status === 'created');
const extra = { reply_parameters: { message_id: reply_to, allow_sending_without_reply: true } };

if (created.length === 1 && created[0].task_id) {
  extra.reply_markup = taskKeyboard(created[0].task_id);
}

const footer = provider !== 'grok' ? ''
  : forced ? `\n\n<i>🧪 Prueba de respaldo: respondió Grok (${escHtml(ENV.GROK_MODEL || 'grok-4.3')})</i>`
  : '\n\n<i>⚡ Respondió Grok (Gemini no disponible)</i>';
await sendTelegram(chat_id, mdToTgHtml(reply) + footer, extra);
return [{ json: { sent: true } }];
