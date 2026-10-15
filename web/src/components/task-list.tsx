'use client';

import { AnimatePresence } from 'framer-motion';
import type { Task } from '@/lib/types';
import { sortTasks } from '@/lib/dates';
import { TaskItem } from './task-item';

export function TaskSection({
  title,
  tasks,
  showDate,
  tone,
  empty,
}: {
  title?: string;
  tasks: Task[];
  showDate?: boolean;
  tone?: 'danger';
  empty?: string;
}) {
  if (!tasks.length && !empty) return null;
  return (
    <section className="space-y-2">
      {title && (
        <h2 className={`px-1 text-xs font-semibold uppercase tracking-wider ${tone === 'danger' ? 'text-red-600 dark:text-red-400' : 'text-muted-foreground'}`}>
          {title} <span className="font-normal opacity-70">{tasks.length}</span>
        </h2>
      )}
      {tasks.length ? (
        <ul className="space-y-2">
          <AnimatePresence initial={false}>
            {[...tasks].sort(sortTasks).map((t) => <TaskItem key={t.id} task={t} showDate={showDate} />)}
          </AnimatePresence>
        </ul>
      ) : (
        <p className="rounded-lg border border-dashed px-4 py-6 text-center text-sm text-muted-foreground">{empty}</p>
      )}
    </section>
  );
}
