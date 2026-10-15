'use client';

import type { ReactNode } from 'react';
import { useTasks } from '@/lib/tasks-store';
import { cn } from '@/lib/utils';
import { CategoryPills } from './category-pills';

/** Encabezado sticky: título + indicador de sincronización en vivo + filtros. */
export function PageHeader({ title, subtitle, right }: { title: string; subtitle?: string; right?: ReactNode }) {
  const { live } = useTasks();
  return (
    <header className="pt-safe sticky top-0 z-30 -mx-4 border-b bg-background/85 px-4 pb-2 backdrop-blur-lg md:static md:mx-0 md:border-0 md:px-0 md:backdrop-blur-none">
      <div className="flex items-end justify-between gap-3 pt-4 pb-2">
        <div className="min-w-0">
          <h1 className="text-2xl font-bold tracking-tight first-letter:uppercase">{title}</h1>
          {subtitle && <p className="text-sm text-muted-foreground first-letter:uppercase">{subtitle}</p>}
        </div>
        <div className="flex items-center gap-3">
          {right}
          <span
            title={live === 'live' ? 'Sincronizado en vivo' : live === 'connecting' ? 'Conectando…' : 'Sin conexión en vivo'}
            className={cn(
              'size-2.5 rounded-full',
              live === 'live' && 'bg-emerald-500 shadow-[0_0_0_4px] shadow-emerald-500/20',
              live === 'connecting' && 'animate-pulse bg-amber-400',
              live === 'offline' && 'bg-stone-400',
            )}
          />
        </div>
      </div>
      <CategoryPills />
    </header>
  );
}
