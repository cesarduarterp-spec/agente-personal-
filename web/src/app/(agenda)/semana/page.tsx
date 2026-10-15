'use client';

import { useMemo, useState } from 'react';
import { AnimatePresence, motion, type PanInfo } from 'framer-motion';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { useTasks } from '@/lib/tasks-store';
import { CATEGORY_STYLE, isOpen } from '@/lib/types';
import { addDays, dayKey, fmtDayLong, fmtWeekday, isSameDay, onDay, startOfDay, weekStart } from '@/lib/dates';
import { cn, haptic } from '@/lib/utils';
import { PageHeader } from '@/components/page-header';
import { TaskSection } from '@/components/task-list';
import { Button } from '@/components/ui/button';

export default function SemanaPage() {
  const { tasks } = useTasks();
  const today = startOfDay(new Date());
  const [selected, setSelected] = useState(today);
  const [dir, setDir] = useState(0);

  const days = useMemo(() => {
    const start = weekStart(selected);
    return Array.from({ length: 7 }, (_, i) => addDays(start, i));
  }, [selected]);

  const byDay = useMemo(() => {
    const map: Record<string, typeof tasks> = {};
    for (const d of days) map[dayKey(d)] = tasks.filter((t) => onDay(t, d) && t.status !== 'cancelada');
    return map;
  }, [tasks, days]);

  const go = (delta: number) => {
    haptic(6);
    setDir(delta);
    setSelected((s) => addDays(s, delta));
  };

  // Swipe horizontal sobre la lista → día anterior / siguiente
  const onSwipe = (_: unknown, info: PanInfo) => {
    if (info.offset.x < -70) go(1);
    else if (info.offset.x > 70) go(-1);
  };

  const list = byDay[dayKey(selected)] ?? [];

  return (
    <>
      <PageHeader
        title="Semana"
        subtitle={`${days[0].getDate()}–${days[6].toLocaleDateString('es-AR', { day: 'numeric', month: 'long' })}`}
        right={
          <div className="flex">
            <Button variant="ghost" size="icon" aria-label="Semana anterior" onClick={() => go(-7)}><ChevronLeft /></Button>
            <Button variant="ghost" size="icon" aria-label="Semana siguiente" onClick={() => go(7)}><ChevronRight /></Button>
          </div>
        }
      />

      {/* Tira de 7 días (móvil) */}
      <div className="no-scrollbar -mx-4 mt-3 flex snap-x snap-mandatory gap-2 overflow-x-auto px-4 pb-1 md:hidden">
        {days.map((d) => {
          const items = byDay[dayKey(d)];
          const open = items.filter(isOpen).length;
          const active = isSameDay(d, selected);
          return (
            <button
              key={dayKey(d)}
              onClick={() => { haptic(6); setDir(d > selected ? 1 : -1); setSelected(d); }}
              className={cn(
                'flex min-w-[3.6rem] flex-1 snap-start flex-col items-center gap-1 rounded-xl border py-2 transition-colors',
                active ? 'border-primary bg-primary text-primary-foreground' : 'bg-card',
                !active && isSameDay(d, today) && 'border-accent',
              )}
            >
              <span className="text-[11px] uppercase opacity-70">{fmtWeekday(d)}</span>
              <span className="text-lg leading-none font-semibold tabular-nums">{d.getDate()}</span>
              <span className="flex h-1.5 gap-0.5">
                {items.slice(0, 4).map((t) => (
                  <span key={t.id} className={cn('size-1.5 rounded-full', t.status === 'completada' ? 'bg-stone-400' : CATEGORY_STYLE[t.category].dot)} />
                ))}
              </span>
              <span className="sr-only">{open} pendientes</span>
            </button>
          );
        })}
      </div>

      {/* Lista del día seleccionado (móvil, deslizable) */}
      <div className="overflow-hidden pt-4 md:hidden">
        <AnimatePresence mode="popLayout" initial={false} custom={dir}>
          <motion.div
            key={dayKey(selected)}
            custom={dir}
            initial={{ x: dir >= 0 ? 60 : -60, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            exit={{ x: dir >= 0 ? -60 : 60, opacity: 0 }}
            transition={{ type: 'spring', stiffness: 400, damping: 36 }}
            drag="x"
            dragConstraints={{ left: 0, right: 0 }}
            dragElastic={0.15}
            dragDirectionLock
            onDragEnd={onSwipe}
            className="min-h-[50dvh] touch-pan-y"
          >
            <TaskSection title={fmtDayLong(selected)} tasks={list} empty="Día libre 🙌" />
          </motion.div>
        </AnimatePresence>
      </div>

      {/* Escritorio: tablero de 7 columnas */}
      <div className="mt-6 hidden gap-3 md:grid md:grid-cols-7 md:-mx-4 lg:-mx-24">
        {days.map((d) => (
          <div key={dayKey(d)} className={cn('min-h-48 rounded-lg border p-2', isSameDay(d, today) && 'border-accent')}>
            <p className="mb-2 text-xs font-semibold text-muted-foreground uppercase">
              {fmtWeekday(d)} <span className="text-foreground">{d.getDate()}</span>
            </p>
            <ul className="space-y-1.5">
              {byDay[dayKey(d)].map((t) => (
                <li key={t.id} className={cn('rounded-md border bg-card px-2 py-1.5 text-xs shadow-xs', t.status === 'completada' && 'line-through opacity-50')}>
                  <span className={cn('mr-1 inline-block size-1.5 rounded-full align-middle', CATEGORY_STYLE[t.category].dot)} />
                  {t.due_date && <span className="tabular-nums text-muted-foreground">{new Date(t.due_date).toTimeString().slice(0, 5)} </span>}
                  {t.title}
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </>
  );
}
