//@include _lib
//@include _agent
// Agente de RESPALDO: Grok (xAI Responses API) con las mismas tools.
// Grok no escucha audio en el chat: si fue una nota de voz, llega acá ya transcripta
// por el nodo "xAI · transcribir audio" (POST /v1/stt).
const state = $('Agente Gemini (Function Calling)').first().json;
const stt = state.kind === 'voice' ? $input.first().json : null;
const chatId = state.chat_id;

let userText = state.text;
if (state.kind === 'voice') {
  userText = (stt?.text || '').trim();
  if (!userText) {
    const reply = '⚠️ No pude procesar el audio ahora (Gemini y la transcripción de respaldo fallaron). ¿Me lo mandás por texto?';
    return [{ json: { provider: 'none', chat_id: chatId, reply_to: state.reply_to, reply, actions: [] } }];
  }
  if (state.caption) userText += `\n(Texto adjunto: ${state.caption})`;
}

const { systemText, history } = await buildContext(chatId);
const done = state.actions_done || [];
const doneNote = done.length
  ? `\n\n# Atención\nAntes de fallar, el asistente principal YA ejecutó estas acciones (no las repitas):\n${JSON.stringify(done)}`
  : '';

const input = [
  { role: 'system', content: systemText + doneNote },
  ...history.map((m) => ({ role: m.role === 'model' ? 'assistant' : 'user', content: m.content })),
  { role: 'user', content: userText },
];
const tools = TOOLS.map((t) => ({ type: 'function', name: t.name, description: t.description, parameters: t.parameters }));

let reply = '';
const actions = [...done];
try {
  for (let turn = 0; turn < MAX_TURNS; turn++) {
    const res = await grok({ input, tools, tool_choice: 'auto', temperature: 0.3, store: false });
    const output = res?.output || [];
    const calls = output.filter((o) => o.type === 'function_call');

    if (calls.length === 0) {
      reply = grokText(res);
      break;
    }
    for (const call of calls) {
      let args = {};
      try { args = JSON.parse(call.arguments || '{}'); } catch {}
      const result = await runTool(call.name, args, actions);
      input.push({ type: 'function_call', call_id: call.call_id, name: call.name, arguments: call.arguments || '{}' });
      input.push({ type: 'function_call_output', call_id: call.call_id, output: JSON.stringify(result) });
    }
  }
} catch (e) {
  reply = done.length
    ? '✅ Hice parte del pedido, pero los modelos de IA no están respondiendo. Revisá la agenda.'
    : '⚠️ Los modelos de IA no están respondiendo ahora. Probá de nuevo en unos minutos.';
}

if (!reply) reply = actions.length ? '✅ Hecho.' : 'No pude procesar el pedido, ¿me lo repetís?';
if (state.kind === 'voice') reply = `🎙️ *«${userText.slice(0, 300).replace(/\*/g, '')}»*\n\n${reply}`;

await logExchange(chatId, userText, reply, actions.slice(done.length));

return [{ json: { provider: 'grok', forced: !!state.forced, chat_id: chatId, reply_to: state.reply_to, reply, actions } }];
