import { create } from 'zustand';
import type { Estado, Medicion, PasoN, Pasos, State, Tactica } from '../lib/schema';
import { envelopeSchema, stateSchema, STORAGE_VERSION, tacticaCompleta } from '../lib/schema';
import { derive, nuevaTactica, uid } from '../lib/calc';
import { sampleData } from '../lib/sample';

export const HISTORY_LIMIT = 30;
export const APP_SLUG = 'tactica-aterrizada';
export const STORAGE_KEY = `vn-${APP_SLUG}`;

interface HistoryEntry {
  snapshot: Tactica[];
  key?: string;
  at: number;
}

export type Result = { ok: true } | { ok: false; error: string };

export interface TacticaStore extends State {
  past: HistoryEntry[];
  future: Tactica[][];
  readOnly: boolean; // snapshot compartido
  hydrated: boolean;

  // CRUD
  addTactica: (nombre?: string) => string | null;
  updateTactica: (id: string, patch: Partial<Pick<Tactica, 'nombre' | 'canal' | 'fechaInicio'>>, key?: string) => void;
  updatePaso: <N extends PasoN>(id: string, n: N, data: Pasos[N], key?: string) => void;
  removeTactica: (id: string) => void;
  duplicateTactica: (id: string) => string | null;
  setEstado: (id: string, estado: Estado) => Result;
  addMedicion: (id: string, m: Omit<Medicion, 'id'>) => void;
  removeMedicion: (id: string, medicionId: string) => void;

  // Datos
  loadSample: () => void;
  reset: () => void;
  importJSON: (text: string) => Result;
  exportJSON: () => string;
  hydrate: (tacticas: Tactica[], opts?: { readOnly?: boolean }) => void;
  forkSnapshot: (local: Tactica[]) => void;

  // Historial
  undo: () => void;
  redo: () => void;
}

const COALESCE_MS = 1500;
const now = () => new Date().toISOString();

export const useTacticaStore = create<TacticaStore>()((set, get) => {
  /** Aplica una transformación pura sobre `tacticas`, registrando historial. */
  const commit = (fn: (ts: Tactica[]) => Tactica[], key?: string): boolean => {
    const s = get();
    if (s.readOnly) return false;
    const next = fn(s.tacticas);
    if (next === s.tacticas) return false;
    const last = s.past.at(-1);
    const t = Date.now();
    const coalesce = key !== undefined && last?.key === key && t - last.at < COALESCE_MS;
    const past = coalesce
      ? [...s.past.slice(0, -1), { ...last!, at: t }]
      : [...s.past, { snapshot: s.tacticas, key, at: t }].slice(-HISTORY_LIMIT);
    set({ tacticas: next, past, future: [] });
    return true;
  };

  const mapOne = (id: string, fn: (t: Tactica) => Tactica) => (ts: Tactica[]) => {
    const i = ts.findIndex((t) => t.id === id);
    if (i < 0) return ts;
    const updated = derive({ ...fn(ts[i]!), updatedAt: now() });
    const copy = ts.slice();
    copy[i] = updated;
    return copy;
  };

  return {
    tacticas: [],
    past: [],
    future: [],
    readOnly: false,
    hydrated: false,

    addTactica: (nombre) => {
      const t = nuevaTactica(nombre?.trim() || 'Nueva táctica');
      return commit((ts) => [t, ...ts]) ? t.id : null;
    },

    updateTactica: (id, patch, key) => commit(mapOne(id, (t) => ({ ...t, ...patch })), key),

    updatePaso: (id, n, data, key) =>
      commit(mapOne(id, (t) => ({ ...t, pasos: { ...t.pasos, [n]: data } })), key),

    removeTactica: (id) => commit((ts) => (ts.some((t) => t.id === id) ? ts.filter((t) => t.id !== id) : ts)),

    duplicateTactica: (id) => {
      const src = get().tacticas.find((t) => t.id === id);
      if (!src) return null;
      const copy: Tactica = {
        ...structuredClone(src),
        id: uid(),
        nombre: `${src.nombre} (copia)`,
        estado: 'draft',
        mediciones: [],
        createdAt: now(),
        updatedAt: now(),
      };
      return commit((ts) => {
        const i = ts.findIndex((t) => t.id === id);
        return [...ts.slice(0, i + 1), copy, ...ts.slice(i + 1)];
      })
        ? copy.id
        : null;
    },

    setEstado: (id, estado) => {
      const t = get().tacticas.find((x) => x.id === id);
      if (!t) return { ok: false, error: 'Táctica no encontrada' };
      if (get().readOnly) return { ok: false, error: 'Snapshot de solo lectura' };
      if (estado !== 'draft' && !tacticaCompleta(t))
        return { ok: false, error: 'Completa y valida los 8 pasos antes de salir de Borrador' };
      commit(mapOne(id, (x) => ({ ...x, estado })));
      return { ok: true };
    },

    addMedicion: (id, m) =>
      commit(mapOne(id, (t) => ({ ...t, mediciones: [...t.mediciones, { ...m, id: uid() }] }))),

    removeMedicion: (id, medicionId) =>
      commit(mapOne(id, (t) => ({ ...t, mediciones: t.mediciones.filter((m) => m.id !== medicionId) }))),

    loadSample: () => commit((ts) => [...sampleData(), ...ts]),

    reset: () => commit((ts) => (ts.length ? [] : ts)),

    importJSON: (text) => {
      if (get().readOnly) return { ok: false, error: 'Snapshot de solo lectura: duplícalo para editar' };
      let raw: unknown;
      try {
        raw = JSON.parse(text);
      } catch {
        return { ok: false, error: 'El archivo no es JSON válido' };
      }
      const env = envelopeSchema.safeParse(raw);
      const plain = env.success ? null : stateSchema.safeParse(raw);
      const data = env.success ? env.data.data : plain?.success ? plain.data : null;
      if (!data) {
        const issue = (env.success ? null : env.error.issues[0]) ?? null;
        return {
          ok: false,
          error: `Estructura inválida${issue ? ` en «${issue.path.join('.')}»: ${issue.message}` : ''}`,
        };
      }
      const ids = new Set<string>();
      const clean = data.tacticas.map((t) => {
        const id = ids.has(t.id) ? uid() : t.id;
        ids.add(id);
        return derive({ ...t, id });
      });
      commit(() => clean);
      return { ok: true };
    },

    exportJSON: () =>
      JSON.stringify({ v: STORAGE_VERSION, updatedAt: now(), data: { tacticas: get().tacticas } }, null, 2),

    hydrate: (tacticas, opts) =>
      set({ tacticas: tacticas.map(derive), past: [], future: [], readOnly: !!opts?.readOnly, hydrated: true }),

    forkSnapshot: (local) => {
      const shared = get().tacticas.map((t) => ({ ...t, id: uid(), updatedAt: now() }));
      set({ tacticas: [...shared, ...local], readOnly: false, past: [], future: [] });
    },

    undo: () => {
      const s = get();
      const prev = s.past.at(-1);
      if (!prev || s.readOnly) return;
      set({ tacticas: prev.snapshot, past: s.past.slice(0, -1), future: [s.tacticas, ...s.future].slice(0, HISTORY_LIMIT) });
    },

    redo: () => {
      const s = get();
      const [next, ...rest] = s.future;
      if (!next || s.readOnly) return;
      set({ tacticas: next, future: rest, past: [...s.past, { snapshot: s.tacticas, at: 0 }].slice(-HISTORY_LIMIT) });
    },
  };
});

/* --------------------------- Selectores ---------------------------- */

/** Memoiza por referencia del primer argumento (las tácticas son inmutables). */
export function memoByRef<A extends object, R>(fn: (a: A) => R): (a: A) => R {
  let lastA: A | undefined;
  let lastR: R;
  return (a: A) => {
    if (a !== lastA) {
      lastA = a;
      lastR = fn(a);
    }
    return lastR;
  };
}

export const selectTacticas = (s: TacticaStore) => s.tacticas;
export const selectCanUndo = (s: TacticaStore) => s.past.length > 0 && !s.readOnly;
export const selectCanRedo = (s: TacticaStore) => s.future.length > 0 && !s.readOnly;
export const selectCanales = memoByRef((ts: Tactica[]) =>
  Array.from(new Set(ts.map((t) => t.canal.trim()).filter(Boolean))).sort((a, b) => a.localeCompare(b)),
);
