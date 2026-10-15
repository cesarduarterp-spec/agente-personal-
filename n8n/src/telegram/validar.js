//@include _lib
// Valida el webhook de Telegram (secret header + chat autorizado) y normaliza el update.
const req = $input.first().json;
const headers = req.headers || {};
const update = req.body || {};

if (headers['x-telegram-bot-api-secret-token'] !== ENV.TELEGRAM_WEBHOOK_SECRET) {
  return []; // petición no firmada por Telegram → se descarta en silencio
}

const allowed = String(ENV.TELEGRAM_ALLOWED_CHAT_ID);

if (update.callback_query) {
  const cq = update.callback_query;
  const chatId = cq.message?.chat?.id;
  if (String(chatId) !== allowed) return [];
  const [, action, taskId] = String(cq.data || '').split(':');
  return [{ json: {
    kind: 'callback',
    chat_id: chatId,
    message_id: cq.message?.message_id,
    original_text: cq.message?.text || '',
    callback_id: cq.id,
    action,
    task_id: taskId,
  } }];
}

const msg = update.message || update.edited_message;
if (!msg || String(msg.chat?.id) !== allowed) return [];

const audio = msg.voice || msg.audio;
const base = { chat_id: msg.chat.id, message_id: msg.message_id };

// Feedback inmediato ("grabando/escribiendo…") mientras el agente piensa
await tg('sendChatAction', { chat_id: msg.chat.id, action: 'typing' }).catch(() => {});

if (audio) {
  return [{ json: { ...base, kind: 'voice', file_id: audio.file_id,
    mime_type: audio.mime_type || 'audio/ogg', caption: msg.caption || '' } }];
}
if (msg.text) {
  if (msg.text === '/start') {
    await sendTelegram(msg.chat.id, '👋 Listo. Mandame una nota de voz o un texto con lo que necesites agendar.');
    return [];
  }
  return [{ json: { ...base, kind: 'text', text: msg.text } }];
}
return [];
