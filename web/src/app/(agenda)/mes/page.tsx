'use client';

import { useMemo, useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { addMonths, endOfMonth, startOfMonth } from 'date-fns';
import { useTasks } from '@/lib/tasks-store';
import { CATEGORY_STYLE, isOpen } from '@/lib/types';
import { addDays, dayKey, fmtDayLong, fmtMonth, isSameDay, onDay, startOfDay, weekStart } from '@/lib/dates';
import { cn, haptic } from '@/lib/utils';
import { PageHeader } from '@/components/page-header';
import { TaskSection } from '@/components/task-list';
import { Button } from '@/components/ui/button';

const WEEKDAYS = ['L', 'M', 'M', 'J', 'V', 'S', 'D'];

export default function MesPage() {
  const { tasks } = useTasks();
  const today = startOfDay(new Date());
  const [month, setMonth] = useState(startOfMonth(today));
  const [selected, setSelected] = useState(today);

  const grid = useMemo(() => {
    const start = weekStart(month);
    const end = endOfMonth(month);
    const cells: Date[] = [];
    for (let d = start; d <= end || cells.length % 7 !== 0; d = addDays(d, 1)) cells.push(d);
    return cells;
  }, [month]);

  const byDay = useMemo(() => {
    const map: Record<string, typeof tasks> = {};
    for (const t of tasks) {
      if (!t.due_date || t.status === 'cancelada') continue;
      const k = dayKey(new Date(t.due_date));
      (map[k] ??= []).push(t);
    }
    return map;
  }, [tasks]);

  const changeMonth = (delta: number) => { haptic(6); setMonth((m) => addMonths(m, delta)); };

  return (
    <>
      <PageHeader
        title={fmtMonth(month)}
        right={
          <div className="flex">
            <Button variant="ghost" size="icon" aria-label="Mes anterior" onClick={() => changeMonth(-1)}><ChevronLeft /></Button>
            <Button variant="ghost" size="icon" aria-label="Mes siguiente" onClick={() => changeMonth(1)}><ChevronRight /></Button>
          </div>
        }
      />

      <div className="md:grid md:grid-cols-[minmax(0,22rem)_1fr] md:gap-8">
        {/* Calendario compacto */}
        <div className="mt-4 rounded-xl border bg-card p-2 md:self-start">
          <div className="grid grid-cols-7 pb-1 text-center text-[11px] font-medium text-muted-foreground">
            {WEEKDAYS.map((w, i) => <span key={i}>{w}</span>)}
          </div>
          <div className="grid grid-cols-7 gap-y-1">
            {grid.map((d) => {
              const items = byDay[dayKey(d)] ?? [];
              const inMonth = d.getMonth() === month.getMonth();
              const active = isSameDay(d, selected);
              const pending = items.filter(isOpen);
              return (
                <button
                  key={dayKey(d)}
                  onClick={() => { haptic(6); setSelected(d); }}
                  className={cn(
                    'mx-auto flex aspect-square w-full max-w-11 flex-col items-center justify-center rounded-lg text-sm tabular-nums transition-colors',
                    !inMonth && 'text-muted-foreground/40',
                    active ? 'bg-primary text-primary-foreground' : 'hover:bg-muted',
                    !active && isSameDay(d, today) && 'font-bold text-accent-foreground ring-2 ring-accent ring-inset',
                  )}
                >
                  {d.getDate()}
                  <span className="mt-0.5 flex h-1.5 gap-0.5">
                    {pending.slice(0, 3).map((t) => (
                      <span key={t.id} className={cn('size-1.5 rounded-full', CATEGORY_STYLE[t.category].dot)} />
                    ))}
                    {!pending.length && items.length > 0 && <span className="size-1.5 rounded-full bg-stone-400/60" />}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Lista del día */}
        <div className="pt-5">
          <TaskSection
            title={fmtDayLong(selected)}
            tasks={tasks.filter((t) => onDay(t, selected) && t.status !== 'cancelada')}
            empty="Sin tareas este día"
          />
        </div>
      </div>
    </>
  );
}
