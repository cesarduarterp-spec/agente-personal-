//@include _lib
// Envía la respuesta del agente. Si se creó exactamente una tarea, agrega los botones de acción.
const { chat_id, reply_to, reply, actions = [] } = $input.first().json;

const created = actions.filter((a) => a.name === 'create_task' && a.status === 'created');
const extra = { reply_parameters: { message_id: reply_to, allow_sending_without_reply: true } };

if (created.length === 1 && created[0].task_id) {
  extra.reply_markup = taskKeyboard(created[0].task_id);
}

await sendTelegram(chat_id, mdToTgHtml(reply), extra);
return [{ json: { sent: true } }];
