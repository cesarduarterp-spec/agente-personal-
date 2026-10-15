//@include _lib
// Guarda el id del evento creado en Google Calendar (sin disparar otra sincronización).
const created = $input.first().json;
const { task_id } = $('Filtrar cambios').first().json;
const res = await rpc('fn_mark_gcal_synced', { p_task_id: task_id, p_event_id: created.id });
return [{ json: res }];
