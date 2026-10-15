'use client';

import { useState } from 'react';
import { AnimatePresence, motion, useMotionValue, useTransform, type PanInfo } from 'framer-motion';
import { Bell, CalendarArrowUp, Check, ChevronDown } from 'lucide-react';
import { useTasks } from '@/lib/tasks-store';
import { CATEGORY_STYLE, PRIORITY_STYLE, type Task } from '@/lib/types';
import { fmtTime, isOverdue } from '@/lib/dates';
import { cn, haptic } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';

const SWIPE_THRESHOLD = 96;

/** Checkbox grande (44px de área táctil) con animación de tilde. */
function BigCheck({ checked, onToggle }: { checked: boolean; onToggle: () => void }) {
  return (
    <motion.button
      type="button"
      role="checkbox"
      aria-checked={checked}
      aria-label={checked ? 'Marcar como pendiente' : 'Marcar como completada'}
      onClick={(e) => { e.stopPropagation(); haptic(); onToggle(); }}
      whileTap={{ scale: 0.82 }}
      className="grid size-11 shrink-0 place-items-center"
    >
      <motion.span
        animate={checked ? { scale: [1, 1.18, 1] } : { scale: 1 }}
        transition={{ duration: 0.28 }}
        className={cn(
          'grid size-7 place-items-center rounded-full border-2 transition-colors',
          checked ? 'border-emerald-500 bg-emerald-500' : 'border-stone-300 dark:border-stone-600',
        )}
      >
        <svg viewBox="0 0 24 24" className="size-4 text-white" fill="none" stroke="currentColor" strokeWidth={3.5}>
          <motion.path
            d="M5 12.5l4.5 4.5L19 7.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            initial={false}
            animate={{ pathLength: checked ? 1 : 0, opacity: checked ? 1 : 0 }}
            transition={{ duration: 0.25, ease: 'easeOut' }}
          />
        </svg>
      </motion.span>
    </motion.button>
  );
}

export function TaskItem({ task, showDate = false }: { task: Task; showDate?: boolean }) {
  const { complete, reopen, postpone, snooze } = useTasks();
  const [open, setOpen] = useState(false);
  const x = useMotionValue(0);
  const done = task.status === 'completada';
  const overdue = !done && isOverdue(task);

  // Fondos revelados al deslizar
  const rightBg = useTransform(x, [0, SWIPE_THRESHOLD], [0, 1]);
  const leftBg = useTransform(x, [-SWIPE_THRESHOLD, 0], [1, 0]);

  const onDragEnd = (_: unknown, info: PanInfo) => {
    if (info.offset.x > SWIPE_THRESHOLD && !done) { haptic(20); complete(task.id); }
    else if (info.offset.x < -SWIPE_THRESHOLD && !done) { haptic(20); postpone(task.id); }
  };

  const cat = CATEGORY_STYLE[task.category];

  return (
    <motion.li
      layout
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, height: 0, marginBottom: 0 }}
      transition={{ type: 'spring', stiffness: 500, damping: 40 }}
      className="relative overflow-hidden rounded-lg"
    >
      {/* Acción swipe → derecha: completar */}
      <motion.div style={{ opacity: rightBg }} className="absolute inset-0 flex items-center bg-emerald-500 pl-5 text-white">
        <Check className="size-5" /><span className="ml-2 text-sm font-semibold">Completar</span>
      </motion.div>
      {/* Acción swipe ← izquierda: posponer a mañana */}
      <motion.div style={{ opacity: leftBg }} className="absolute inset-0 flex items-center justify-end bg-amber-500 pr-5 text-white">
        <span className="mr-2 text-sm font-semibold">Mañana</span><CalendarArrowUp className="size-5" />
      </motion.div>

      <motion.div
        drag={done ? false : 'x'}
        dragConstraints={{ left: 0, right: 0 }}
        dragElastic={0.6}
        dragDirectionLock
        style={{ x }}
        onDragEnd={onDragEnd}
        className="relative flex touch-pan-y items-start gap-1 border bg-card py-2 pr-3 pl-1 shadow-xs rounded-lg"
      >
        <span className={cn('absolute top-2 bottom-2 left-0 w-1 rounded-r-full', cat.bar)} aria-hidden />
        <BigCheck checked={done} onToggle={() => (done ? reopen(task.id) : complete(task.id))} />

        <button type="button" onClick={() => setOpen((o) => !o)} className="min-w-0 flex-1 py-1.5 text-left">
          <p className={cn('text-[15px] leading-snug font-medium', done && 'text-muted-foreground line-through')}>
            {task.title}
          </p>
          <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground">
            {task.due_date && (
              <span className={cn('tabular-nums', overdue && 'font-semibold text-red-600 dark:text-red-400')}>
                {showDate || overdue
                  ? new Date(task.due_date).toLocaleDateString('es-AR', { weekday: 'short', day: 'numeric', month: 'numeric' }) + ' · '
                  : ''}
                {fmtTime(task.due_date)}
              </span>
            )}
            <Badge>
              <span className={cn('size-1.5 rounded-full', cat.dot)} />
              {cat.label}
            </Badge>
            {task.priority !== 'media' && (
              <span className={cn('font-semibold uppercase tracking-wide text-[10px]', PRIORITY_STYLE[task.priority])}>
                {task.priority}
              </span>
            )}
            {task.status === 'en_progreso' && <span className="text-sky-600 dark:text-sky-400">en progreso</span>}
          </div>
        </button>

        {task.description && (
          <ChevronDown className={cn('mt-3 size-4 shrink-0 text-muted-foreground transition-transform', open && 'rotate-180')} />
        )}
      </motion.div>

      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden"
          >
            <div className="space-y-3 px-4 pt-2 pb-3">
              {task.description && (
                <p className="text-sm whitespace-pre-line text-muted-foreground">{task.description}</p>
              )}
              {!done && (
                <div className="flex gap-2">
                  <button onClick={() => snooze(task.id)} className="inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs">
                    <Bell className="size-3.5" /> Recordar en 1 h
                  </button>
                  <button onClick={() => postpone(task.id)} className="inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs">
                    <CalendarArrowUp className="size-3.5" /> Pasar a mañana
                  </button>
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.li>
  );
}
