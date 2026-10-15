'use client';

import { useTasks } from '@/lib/tasks-store';
import { CATEGORIES, CATEGORY_STYLE } from '@/lib/types';
import { cn, haptic } from '@/lib/utils';

/** Filtros rápidos horizontales (scroll lateral en móvil). */
export function CategoryPills() {
  const { filter, setFilter } = useTasks();
  const pill = 'shrink-0 rounded-full border px-3.5 py-1.5 text-sm font-medium transition-colors select-none';

  return (
    <div className="no-scrollbar -mx-4 flex gap-2 overflow-x-auto px-4 py-1" role="tablist" aria-label="Filtrar por categoría">
      <button
        role="tab"
        aria-selected={filter === 'all'}
        data-active={filter === 'all'}
        onClick={() => { haptic(6); setFilter('all'); }}
        className={cn(pill, 'data-[active=true]:border-primary data-[active=true]:bg-primary data-[active=true]:text-primary-foreground')}
      >
        Todos
      </button>
      {CATEGORIES.map((c) => (
        <button
          key={c}
          role="tab"
          aria-selected={filter === c}
          data-active={filter === c}
          onClick={() => { haptic(6); setFilter(filter === c ? 'all' : c); }}
          className={cn(pill, CATEGORY_STYLE[c].pill)}
        >
          {c}
        </button>
      ))}
    </div>
  );
}
