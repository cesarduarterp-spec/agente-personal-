//@include _lib
// Envía cada recordatorio a Telegram con botones de acción.
// Si el envío falla, se "rearma" el recordatorio para el próximo ciclo.
const out = [];
for (const { json: t } of $input.all()) {
  const html =
    `🔔 <b>Recordatorio</b> ${PRIORITY_ICON[t.priority] || ''}\n\n` +
    `<b>${escHtml(t.title)}</b>\n` +
    `${escHtml(t.category)} · vence ${escHtml(fmtLocal(t.due_date))}` +
    (t.description ? `\n\n<i>${escHtml(t.description.slice(0, 600))}</i>` : '');
  try {
    await sendTelegram(ENV.TELEGRAM_ALLOWED_CHAT_ID, html, { reply_markup: taskKeyboard(t.id) });
    out.push({ json: { ...t, telegram_sent: true } });
  } catch (e) {
    await http({
      method: 'PATCH',
      url: `${SB_URL}/rest/v1/tasks?id=eq.${t.id}`,
      headers: SB_HEADERS,
      body: { reminder_sent: false },
      json: true,
    }).catch(() => {});
    out.push({ json: { ...t, telegram_sent: false, error: e.message } });
  }
}
return out;
