// ─── Helpers comunes (inyectados por scripts/build-n8n.mjs en cada nodo Code) ───
// Los secretos se leen de variables de entorno del contenedor n8n ($env).
const ENV = $env;
const TZ = 'America/Argentina/San_Luis';
const http = (opts) => this.helpers.httpRequest(opts);
const SB_URL = String(ENV.SUPABASE_URL || '').replace(/\/$/, '');
const SB_HEADERS = {
  apikey: ENV.SUPABASE_SERVICE_ROLE_KEY,
  Authorization: `Bearer ${ENV.SUPABASE_SERVICE_ROLE_KEY}`,
  'Content-Type': 'application/json',
};

/** Llama a una función SQL vía PostgREST. Omite args vacíos para respetar los DEFAULT. */
async function rpc(fn, args = {}) {
  const body = Object.fromEntries(
    Object.entries(args).filter(([, v]) => v !== undefined && v !== null && v !== ''),
  );
  return http({ method: 'POST', url: `${SB_URL}/rest/v1/rpc/${fn}`, headers: SB_HEADERS, body, json: true });
}

async function tg(method, payload) {
  return http({
    method: 'POST',
    url: `https://api.telegram.org/bot${ENV.TELEGRAM_BOT_TOKEN}/${method}`,
    body: payload,
    json: true,
  });
}

function escHtml(s) {
  return String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

/** Markdown liviano de Gemini → HTML soportado por Telegram. */
function mdToTgHtml(md) {
  return escHtml(md)
    .replace(/\*\*(.+?)\*\*/g, '<b>$1</b>')
    .replace(/(^|[^*])\*(?!\s)([^*\n]+?)\*(?!\*)/g, '$1<i>$2</i>')
    .replace(/`([^`\n]+)`/g, '<code>$1</code>')
    .replace(/\[([^\]]+)\]\((https?:\/\/[^)\s]+)\)/g, '<a href="$2">$1</a>')
    .replace(/^#{1,6}\s*(.+)$/gm, '<b>$1</b>')
    .replace(/^\s*[-*]\s+/gm, '• ');
}

/** Envía mensaje HTML; si Telegram rechaza el formato, reintenta en texto plano. */
async function sendTelegram(chatId, html, extra = {}) {
  const text = html.length > 4000 ? html.slice(0, 3990) + '…' : html;
  try {
    return await tg('sendMessage', {
      chat_id: chatId, text, parse_mode: 'HTML', disable_web_page_preview: true, ...extra,
    });
  } catch (e) {
    const plain = text.replace(/<[^>]+>/g, '');
    return tg('sendMessage', { chat_id: chatId, text: plain, disable_web_page_preview: true, ...extra });
  }
}

function fmtLocal(iso) {
  if (!iso) return 'sin fecha';
  return new Date(iso).toLocaleString('es-AR', {
    timeZone: TZ, weekday: 'short', day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit',
  });
}

const PRIORITY_ICON = { alta: '🔴', media: '🟡', baja: '🟢' };

/** Teclado inline estándar de una tarea (callback_data ≤ 64 bytes). */
function taskKeyboard(id) {
  return {
    inline_keyboard: [[
      { text: '✅ Tarea lista', callback_data: `t:done:${id}` },
      { text: '⏳ +1 hora', callback_data: `t:snooze_1h:${id}` },
      { text: '📅 Mañana', callback_data: `t:tomorrow:${id}` },
    ]],
  };
}

async function gemini(body, model = ENV.GEMINI_MODEL || 'gemini-2.5-flash') {
  return http({
    method: 'POST',
    url: `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`,
    headers: { 'x-goog-api-key': ENV.GEMINI_API_KEY, 'Content-Type': 'application/json' },
    body,
    json: true,
    timeout: 120000,
  });
}

function geminiText(res) {
  return (res?.candidates?.[0]?.content?.parts || [])
    .filter((p) => typeof p.text === 'string' && !p.thought)
    .map((p) => p.text)
    .join('')
    .trim();
}
// ─── fin helpers ───
