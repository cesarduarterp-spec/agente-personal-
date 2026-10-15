'use client';

import { useMemo } from 'react';
import { motion } from 'framer-motion';
import { useTasks } from '@/lib/tasks-store';
import { isOpen } from '@/lib/types';
import { fmtDayLong, isOverdue, isSameDay, onDay } from '@/lib/dates';
import { PageHeader } from '@/components/page-header';
import { TaskSection } from '@/components/task-list';

function ProgressRing({ done, total }: { done: number; total: number }) {
  const pct = total ? done / total : 0;
  const r = 16;
  const c = 2 * Math.PI * r;
  return (
    <div className="relative grid size-11 place-items-center" title={`${done}/${total} completadas`}>
      <svg viewBox="0 0 40 40" className="absolute inset-0 -rotate-90">
        <circle cx="20" cy="20" r={r} className="fill-none stroke-muted" strokeWidth="4" />
        <motion.circle
          cx="20" cy="20" r={r} strokeWidth="4" strokeLinecap="round"
          className="fill-none stroke-emerald-500"
          strokeDasharray={c}
          animate={{ strokeDashoffset: c * (1 - pct) }}
          transition={{ type: 'spring', stiffness: 120, damping: 20 }}
        />
      </svg>
      <span className="text-[11px] font-semibold tabular-nums">{done}/{total}</span>
    </div>
  );
}

export default function HoyPage() {
  const { tasks, loading } = useTasks();
  const today = new Date();

  const { overdue, todays, noDate, doneToday } = useMemo(() => {
    const now = new Date();
    return {
      overdue: tasks.filter((t) => isOpen(t) && isOverdue(t, now)),
      todays: tasks.filter((t) => isOpen(t) && onDay(t, now)),
      noDate: tasks.filter((t) => isOpen(t) && !t.due_date),
      doneToday: tasks.filter((t) => t.status === 'completada' && t.completed_at && isSameDay(new Date(t.completed_at), now)),
    };
  }, [tasks]);

  const total = todays.length + doneToday.length;

  return (
    <>
      <PageHeader title="Hoy" subtitle={fmtDayLong(today)} right={<ProgressRing done={doneToday.length} total={total} />} />
      <div className="space-y-6 pt-4">
        {loading ? (
          <div className="space-y-2">{[0, 1, 2].map((i) => <div key={i} className="h-16 animate-pulse rounded-lg bg-muted" />)}</div>
        ) : (
          <>
            <TaskSection title="Atrasadas" tone="danger" tasks={overdue} showDate />
            <TaskSection title="Hoy" tasks={todays} empty="Nada agendado para hoy. Mandale un audio al asistente 🎙️" />
            <TaskSection title="Sin fecha" tasks={noDate} />
            <TaskSection title="Completadas hoy" tasks={doneToday} />
            <p className="pt-2 text-center text-xs text-muted-foreground">
              Deslizá → para completar · ← para pasar a mañana
            </p>
          </>
        )}
      </div>
    </>
  );
}
