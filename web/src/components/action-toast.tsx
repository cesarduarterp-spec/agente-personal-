'use client';

import { AnimatePresence, motion } from 'framer-motion';
import { useTasks } from '@/lib/tasks-store';
import { cn } from '@/lib/utils';

/**
 * Aviso visual breve tras cada acción (completar, posponer…).
 * Es el feedback que se ve en iPhone, donde Safari no permite vibrar.
 */
export function ActionToast() {
  const { toast } = useTasks();
  return (
    <div aria-live="polite" className="pointer-events-none fixed inset-x-0 bottom-[calc(5.5rem+env(safe-area-inset-bottom))] z-50 flex justify-center md:bottom-8">
      <AnimatePresence>
        {toast && (
          <motion.div
            key={toast.id}
            initial={{ opacity: 0, y: 16, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 8, scale: 0.95 }}
            transition={{ type: 'spring', stiffness: 500, damping: 30 }}
            className={cn(
              'rounded-full px-4 py-2 text-sm font-semibold text-white shadow-lg shadow-black/20',
              toast.tone === 'done' && 'bg-emerald-600',
              toast.tone === 'later' && 'bg-amber-600',
              toast.tone === 'info' && 'bg-stone-800 dark:bg-stone-700',
            )}
          >
            {toast.text}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
