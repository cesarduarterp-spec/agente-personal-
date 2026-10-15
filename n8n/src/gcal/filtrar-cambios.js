//@include _lib
// Recibe el Database Webhook de Supabase (INSERT/UPDATE/DELETE en tasks) y decide
// qué hacer en Google Calendar. Corta bucles: ignora cambios hechos por 'gcal' o 'system'.
const req = $input.first().json;
if ((req.headers || {})['x-sync-secret'] !== ENV.GCAL_SYNC_SECRET) return [];

const { type, record: r, old_record: o } = req.body || {};
const task = r || o;
if (!task) return [];

if (type === 'DELETE') {
  return o?.gcal_event_id ? [{ json: { op: 'delete', event_id: o.gcal_event_id, task_id: o.id } }] : [];
}
if (['gcal', 'system'].includes(r.last_modified_by)) return [];

const relevant = ['title', 'description', 'due_date', 'status', 'priority', 'category'];
if (type === 'UPDATE' && o && relevant.every((k) => String(r[k] ?? '') === String(o[k] ?? ''))) return [];

// Sin fecha → no va al calendario (si tenía evento, se borra)
if (!r.due_date || r.status === 'cancelada') {
  return r.gcal_event_id ? [{ json: { op: 'delete', event_id: r.gcal_event_id, task_id: r.id } }] : [];
}

const start = new Date(r.due_date);
const end = new Date(start.getTime() + 30 * 60 * 1000);
const COLORS = { alta: '11', media: '5', baja: '2' }; // tomate / banana / salvia
const event = {
  summary: r.title,
  description: r.description || '',
  start: { dateTime: start.toISOString(), timeZone: TZ },
  end: { dateTime: end.toISOString(), timeZone: TZ },
  colorId: r.status === 'completada' ? '8' : (COLORS[r.priority] || '5'), // grafito = hecha
  extendedProperties: { private: { taskId: r.id, category: r.category } },
  reminders: { useDefault: false, overrides: [] }, // los recordatorios los maneja este sistema
};

return [{ json: { op: r.gcal_event_id ? 'update' : 'create', event_id: r.gcal_event_id, task_id: r.id, event } }];
