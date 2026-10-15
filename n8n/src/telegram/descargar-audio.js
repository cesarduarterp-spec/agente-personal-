//@include _lib
// Descarga la nota de voz (.ogg/Opus) desde Telegram y la deja en base64
// para enviarla como entrada multimodal nativa a Gemini (sin transcripción intermedia).
const item = $input.first().json;

const file = await tg('getFile', { file_id: item.file_id });
const filePath = file?.result?.file_path;
if (!filePath) throw new Error('Telegram no devolvió file_path para la nota de voz');

const buffer = await http({
  method: 'GET',
  url: `https://api.telegram.org/file/bot${ENV.TELEGRAM_BOT_TOKEN}/${filePath}`,
  encoding: 'arraybuffer',
  json: false,
});

// Gemini acepta audio inline hasta ~20 MB por request (una nota de voz pesa KB).
// (Los task runners de n8n serializan el Buffer al cruzar el proceso: se normaliza.)
const toBuffer = (b) => {
  if (Buffer.isBuffer(b) || b instanceof ArrayBuffer || ArrayBuffer.isView(b)) return Buffer.from(b);
  if (b && b.type === 'Buffer' && Array.isArray(b.data)) return Buffer.from(b.data);
  if (b && typeof b === 'object') return Buffer.from(Object.values(b));
  return Buffer.from(String(b), 'binary');
};
const audioB64 = toBuffer(buffer).toString('base64');
const mime = item.mime_type === 'audio/oga' ? 'audio/ogg' : item.mime_type;

return [{ json: { ...item, audio_b64: audioB64, mime_type: mime } }];
