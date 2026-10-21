import { addDays, format, isSameDay, startOfDay, startOfWeek, isBefore } from 'date-fns';
import { es } from 'date-fns/locale';
import type { Task } from './types';

// El dispositivo está en America/Argentina/Buenos_Aires: se usa la hora local del navegador.
export { addDays, isSameDay, startOfDay };

export const dayKey = (d: Date) => format(d, 'yyyy-MM-dd');
export const fmtTime = (iso: string) => format(new Date(iso), 'HH:mm');
export const fmtDayLong = (d: Date) => format(d, "EEEE d 'de' MMMM", { locale: es });
export const fmtMonth = (d: Date) => format(d, 'MMMM yyyy', { locale: es });
export const fmtWeekday = (d: Date) => format(d, 'EEE', { locale: es }).replace('.', '');
export const weekStart = (d: Date) => startOfWeek(d, { weekStartsOn: 1 });

export function isOverdue(t: Task, now = new Date()) {
  return !!t.due_date && isBefore(new Date(t.due_date), startOfDay(now));
}

export function onDay(t: Task, day: Date) {
  return !!t.due_date && isSameDay(new Date(t.due_date), day);
}

/** Orden: abiertas primero, luego por hora, luego prioridad. */
const PRI = { alta: 0, media: 1, baja: 2 } as const;
export function sortTasks(a: Task, b: Task) {
  const doneA = a.status === 'completada' ? 1 : 0;
  const doneB = b.status === 'completada' ? 1 : 0;
  if (doneA !== doneB) return doneA - doneB;
  const ta = a.due_date ? new Date(a.due_date).getTime() : Infinity;
  const tb = b.due_date ? new Date(b.due_date).getTime() : Infinity;
  if (ta !== tb) return ta - tb;
  return PRI[a.priority] - PRI[b.priority];
}
