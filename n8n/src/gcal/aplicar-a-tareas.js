//@include _lib
// Aplica los eventos de Google Calendar modificados en los últimos minutos a la tabla tasks.
// fn_upsert_task_from_gcal es no-op si nada cambió → no hay bucle con el sentido inverso.
const events = $input.first().json.items || [];
const out = [];

for (const ev of events) {
  // Eventos de día completo: se agendan 09:00 local
  const startIso = ev.start?.dateTime || (ev.start?.date ? `${ev.start.date}T09:00:00-03:00` : null);
  if (!startIso && ev.status !== 'cancelled') continue;

  const res = await rpc('fn_upsert_task_from_gcal', {
    p_event_id: ev.id,
    p_title: ev.summary || '(sin título)',
    p_description: ev.description,
    p_start: startIso,
    p_cancelled: ev.status === 'cancelled' ? true : undefined,
    p_task_id: ev.extendedProperties?.private?.taskId,
  });
  if (res.status !== 'unchanged' && res.status !== 'ignored') {
    out.push({ json: { event_id: ev.id, status: res.status, title: ev.summary } });
  }
}
return out;
