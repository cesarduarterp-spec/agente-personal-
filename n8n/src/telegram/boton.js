//@include _lib
// Maneja los botones inline: actualiza la tarea por id y edita el mensaje original.
const { chat_id, message_id, callback_id, action, task_id, original_text } = $input.first().json;

const LABELS = {
  done: '✅ Completada',
  snooze_1h: '⏳ Pospuesta 1 hora',
  tomorrow: '📅 Pasada a mañana',
};

if (!LABELS[action] || !/^[0-9a-f-]{36}$/i.test(task_id || '')) {
  await tg('answerCallbackQuery', { callback_query_id: callback_id, text: 'Acción no válida' });
  return [];
}

const res = await rpc('fn_task_action', { p_task_id: task_id, p_action: action, p_by: 'telegram' });

if (res.status !== 'ok') {
  await tg('answerCallbackQuery', { callback_query_id: callback_id, text: '⚠️ No encontré la tarea', show_alert: true });
  return [];
}

const t = res.task;
const detail = action === 'done'
  ? ''
  : `\n🔔 Nuevo recordatorio: ${fmtLocal(t.reminder_at)}` + (action === 'tomorrow' ? `\n📅 Vence: ${fmtLocal(t.due_date)}` : '');

await tg('answerCallbackQuery', { callback_query_id: callback_id, text: LABELS[action] });
await tg('editMessageText', {
  chat_id,
  message_id,
  parse_mode: 'HTML',
  text: `${escHtml(original_text)}\n\n<b>${LABELS[action]}</b>${escHtml(detail)}`,
  // Sin reply_markup → se quitan los botones
}).catch(() => {});

return [{ json: { task_id, action, status: res.status } }];
