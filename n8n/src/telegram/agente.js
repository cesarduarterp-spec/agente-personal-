//@include _lib
//@include _agent
// Agente PRINCIPAL: Gemini 2.5 Flash con audio nativo + Function Calling.
// Entrada: { kind: 'voice'|'text', chat_id, text?, audio_b64?, mime_type? }
// Si Gemini no responde (caído, 429, 5xx, timeout, bloqueo) se devuelve { fallback: true }
// y el workflow deriva a Grok (transcripción xAI + agente Grok).
const item = $input.first();
const input = item.json;
const chatId = input.chat_id;

// Prueba del respaldo a propósito:
//  - mensaje que empieza con "/grok ..."  → ese mensaje lo responde Grok
//  - variable FORZAR_GROK=true en n8n     → todo (incluidos audios) pasa por Grok
const porComando = input.kind === 'text' && /^\/grok\b/i.test(input.text || '');
if (porComando || String(ENV.FORZAR_GROK).toLowerCase() === 'true') {
  return [{
    json: {
      fallback: true,
      forced: true,
      error: porComando ? 'forzado con /grok' : 'forzado con FORZAR_GROK=true',
      kind: input.kind,
      chat_id: chatId,
      reply_to: input.message_id,
      text: porComando ? input.text.replace(/^\/grok\b\s*/i, '') || 'Decime qué tareas tengo hoy' : input.text,
      caption: input.caption,
      actions_done: [],
    },
    binary: item.binary,
  }];
}
const { systemText, history } = await buildContext(chatId);

const contents = history.map((m) => ({ role: m.role, parts: [{ text: m.content }] }));

// Audio nativo: el .ogg (Opus) de Telegram va como inlineData; Gemini lo escucha directo,
// sin transcripción intermedia (soporta audio/ogg; límite inline ~20 MB por request).
contents.push({
  role: 'user',
  parts: input.kind === 'voice'
    ? [
        { inlineData: { mimeType: input.mime_type || 'audio/ogg', data: input.audio_b64 } },
        { text: 'Nota de voz del usuario. Escuchala y ejecutá lo que pide.' + (input.caption ? ` Texto adjunto: ${input.caption}` : '') },
      ]
    : [{ text: input.text }],
});

let reply = '';
const actions = [];
try {
  for (let turn = 0; turn < MAX_TURNS; turn++) {
    const res = await geminiWithRetry({
      systemInstruction: { parts: [{ text: systemText }] },
      contents,
      tools: [{ functionDeclarations: TOOLS }],
      toolConfig: { functionCallingConfig: { mode: 'AUTO' } },
      generationConfig: { temperature: 0.3 },
    });

    const candidate = res?.candidates?.[0];
    if (!candidate?.content) {
      throw new Error(`Gemini sin respuesta (${res?.promptFeedback?.blockReason || candidate?.finishReason || 'vacía'})`);
    }
    const calls = (candidate.content.parts || []).filter((p) => p.functionCall);

    if (calls.length === 0) {
      reply = geminiText(res);
      break;
    }

    // Se reenvía el turno del modelo tal cual (conserva thought signatures de 2.5)
    contents.push(candidate.content);
    const responses = [];
    for (const { functionCall } of calls) {
      const result = await runTool(functionCall.name, functionCall.args, actions);
      responses.push({ functionResponse: { name: functionCall.name, response: { result } } });
    }
    contents.push({ role: 'user', parts: responses });
  }
} catch (e) {
  // → Respaldo con Grok. Se pasan las acciones ya ejecutadas para que no las repita.
  return [{
    json: {
      fallback: true,
      error: String(e.message || e).slice(0, 300),
      kind: input.kind,
      chat_id: chatId,
      reply_to: input.message_id,
      text: input.text,
      caption: input.caption,
      actions_done: actions,
    },
    binary: item.binary, // el audio viaja al nodo de transcripción de xAI
  }];
}

if (!reply) reply = actions.length ? '✅ Hecho.' : 'No pude procesar el pedido, ¿me lo repetís?';
await logExchange(chatId, input.kind === 'voice' ? '[nota de voz]' : input.text, reply, actions);

return [{ json: { fallback: false, provider: 'gemini', chat_id: chatId, reply_to: input.message_id, reply, actions } }];
