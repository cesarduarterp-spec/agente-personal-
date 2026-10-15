'use client';

import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import type { RealtimePostgresChangesPayload } from '@supabase/supabase-js';
import { getSupabase } from './supabase';
import { CATEGORIES, type Category, type Task } from './types';

type Filter = Category | 'all';
type LiveState = 'connecting' | 'live' | 'offline';

interface TasksCtx {
  tasks: Task[];           // ya filtradas por categoría
  allTasks: Task[];
  loading: boolean;
  live: LiveState;
  filter: Filter;
  setFilter: (f: Filter) => void;
  complete: (id: string) => Promise<void>;
  reopen: (id: string) => Promise<void>;
  postpone: (id: string) => Promise<void>;   // pasa a mañana (misma acción que el botón de Telegram)
  snooze: (id: string) => Promise<void>;     // recordatorio +1h
}

const Ctx = createContext<TasksCtx | null>(null);
const FILTER_KEY = 'agenda.filter';

export function TasksProvider({ children }: { children: ReactNode }) {
  const supabase = getSupabase();
  const [byId, setById] = useState<Record<string, Task>>({});
  const [loading, setLoading] = useState(true);
  const [live, setLive] = useState<LiveState>('connecting');
  const [filter, setFilterState] = useState<Filter>('all');

  useEffect(() => {
    try {
      const saved = localStorage.getItem(FILTER_KEY) as Filter | null;
      if (saved && (saved === 'all' || (CATEGORIES as readonly string[]).includes(saved))) setFilterState(saved);
    } catch {}
  }, []);

  const setFilter = useCallback((f: Filter) => {
    setFilterState(f);
    try { localStorage.setItem(FILTER_KEY, f); } catch {}
  }, []);

  const upsert = useCallback((rows: Task[]) => {
    setById((prev) => {
      const next = { ...prev };
      for (const r of rows) next[r.id] = r;
      return next;
    });
  }, []);

  /** Carga: todas las abiertas + lo cerrado de los últimos 60 días (vista Mes). */
  const load = useCallback(async () => {
    const since = new Date(Date.now() - 60 * 864e5).toISOString();
    const { data, error } = await supabase
      .from('tasks')
      .select('*')
      .or(`status.in.(pendiente,en_progreso),updated_at.gte.${since}`)
      .order('due_date', { ascending: true, nullsFirst: false })
      .limit(2000);
    if (!error && data) {
      setById(Object.fromEntries((data as Task[]).map((t) => [t.id, t])));
    }
    setLoading(false);
  }, [supabase]);

  // Carga inicial + suscripción Realtime a la tabla tasks
  useEffect(() => {
    load();
    const channel = supabase
      .channel('tasks-live')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'tasks' },
        (payload: RealtimePostgresChangesPayload<Task>) => {
          if (payload.eventType === 'DELETE') {
            const id = (payload.old as Partial<Task>).id;
            if (id) setById((prev) => { const n = { ...prev }; delete n[id]; return n; });
          } else {
            upsert([payload.new as Task]);
          }
        })
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') setLive('live');
        else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT' || status === 'CLOSED') setLive('offline');
      });

    // En móvil el socket se duerme en segundo plano: al volver, resincronizar.
    const onVisible = () => { if (document.visibilityState === 'visible') load(); };
    document.addEventListener('visibilitychange', onVisible);
    window.addEventListener('online', load);
    return () => {
      document.removeEventListener('visibilitychange', onVisible);
      window.removeEventListener('online', load);
      supabase.removeChannel(channel);
    };
  }, [supabase, load, upsert]);

  /** Actualización optimista + RPC; si falla, se revierte recargando. */
  const runAction = useCallback(
    async (id: string, action: 'done' | 'snooze_1h' | 'tomorrow', optimistic: (t: Task) => Task) => {
      const current = byId[id];
      if (current) upsert([optimistic(current)]);
      const { data, error } = await supabase.rpc('fn_task_action', { p_task_id: id, p_action: action, p_by: 'pwa' });
      if (error || data?.status !== 'ok') return load();
      upsert([{ ...current, ...data.task } as Task]);
    },
    [byId, supabase, upsert, load],
  );

  const complete = useCallback(
    (id: string) => runAction(id, 'done', (t) => ({ ...t, status: 'completada', completed_at: new Date().toISOString() })),
    [runAction],
  );

  const postpone = useCallback(
    (id: string) =>
      runAction(id, 'tomorrow', (t) => ({
        ...t,
        due_date: t.due_date ? new Date(new Date(t.due_date).getTime() + 864e5).toISOString() : t.due_date,
      })),
    [runAction],
  );

  const snooze = useCallback(
    (id: string) => runAction(id, 'snooze_1h', (t) => ({ ...t, reminder_at: new Date(Date.now() + 36e5).toISOString() })),
    [runAction],
  );

  const reopen = useCallback(async (id: string) => {
    const current = byId[id];
    if (current) upsert([{ ...current, status: 'pendiente', completed_at: null }]);
    const { error } = await supabase
      .from('tasks')
      .update({ status: 'pendiente', last_modified_by: 'pwa' })
      .eq('id', id);
    if (error) load();
  }, [byId, supabase, upsert, load]);

  const allTasks = useMemo(() => Object.values(byId).filter((t) => t.status !== 'cancelada'), [byId]);
  const tasks = useMemo(
    () => (filter === 'all' ? allTasks : allTasks.filter((t) => t.category === filter)),
    [allTasks, filter],
  );

  const value = useMemo<TasksCtx>(
    () => ({ tasks, allTasks, loading, live, filter, setFilter, complete, reopen, postpone, snooze }),
    [tasks, allTasks, loading, live, filter, setFilter, complete, reopen, postpone, snooze],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useTasks() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error('useTasks debe usarse dentro de <TasksProvider>');
  return ctx;
}
