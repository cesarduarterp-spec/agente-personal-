import { create } from 'zustand';
import type { Avatar, Celda, Filtros, Moneda, Producto, State, View } from '../types';
import { uid } from '../lib/id';
import { sampleState } from '../lib/sample';
import { parseState, type ParseResult } from '../lib/schema';

export const HISTORY_LIMIT = 30;

export const emptyState = (): State => ({ avatares: [], productos: [], celdas: [] });

export interface Toast {
  id: string;
  message: string;
  tone: 'info' | 'success' | 'error';
}

export type ModalState =
  | { type: 'avatar'; id?: string }
  | { type: 'producto'; id?: string }
  | { type: 'confirm'; title: string; message: string; confirmLabel: string; onConfirm: () => void }
  | { type: 'reset' }
  | { type: 'settings' }
  | { type: 'import' }
  | null;

export interface CellTarget {
  avatarId: string;
  productoId: string;
}

interface DataSlice {
  data: State;
  past: State[];
  future: State[];
  /** true cuando se abre un snapshot compartido (?s=) */
  readOnly: boolean;
  hydrated: boolean;
}

interface UiSlice {
  view: View;
  heatmap: boolean;
  panelOpen: boolean;
  filtros: Filtros;
  modal: ModalState;
  selectedCell: CellTarget | null;
  paletteOpen: boolean;
  toasts: Toast[];
  moneda: Moneda;
  lastSavedAt: number | null;
  /** Monta la copia fuera de pantalla para exportar PNG/PDF. */
  capturing: boolean;
}

interface Actions {
  // datos (todas pasan por el historial)
  addAvatar: (input: Omit<Avatar, 'id'>) => string | null;
  updateAvatar: (id: string, patch: Partial<Omit<Avatar, 'id'>>) => void;
  removeAvatar: (id: string) => void;
  addProducto: (input: Omit<Producto, 'id'>) => string | null;
  updateProducto: (id: string, patch: Partial<Omit<Producto, 'id'>>) => void;
  removeProducto: (id: string) => void;
  upsertCelda: (celda: Celda) => void;
  clearCelda: (avatarId: string, productoId: string) => void;
  toggleCompra: (avatarId: string, productoId: string) => void;
  moveAvatar: (from: number, to: number) => void;
  moveProducto: (from: number, to: number) => void;
  importData: (input: unknown) => ParseResult;
  loadSample: () => void;
  reset: () => void;
  undo: () => void;
  redo: () => void;
  // ciclo de vida
  hydrate: (data: State, opts?: { readOnly?: boolean }) => void;
  setReadOnly: (v: boolean) => void;
  markSaved: (t: number) => void;
  // ui
  setView: (v: View) => void;
  setHeatmap: (v: boolean) => void;
  setPanelOpen: (v: boolean) => void;
  setFiltros: (patch: Partial<Filtros>) => void;
  resetFiltros: () => void;
  openModal: (m: ModalState) => void;
  closeModal: () => void;
  confirm: (opts: { title: string; message: string; confirmLabel?: string; onConfirm: () => void }) => void;
  selectCell: (c: CellTarget | null) => void;
  setPaletteOpen: (v: boolean) => void;
  toast: (message: string, tone?: Toast['tone']) => void;
  dismissToast: (id: string) => void;
  setMoneda: (m: Moneda) => void;
  setCapturing: (v: boolean) => void;
}

export type AppStore = DataSlice & UiSlice & Actions;

export const defaultFiltros = (): Filtros => ({ query: '', soloMono: false, soloHuerfanos: false, npsMin: null });

function move<T>(arr: T[], from: number, to: number): T[] {
  if (from === to || from < 0 || to < 0 || from >= arr.length || to >= arr.length) return arr;
  const next = arr.slice();
  const [item] = next.splice(from, 1);
  next.splice(to, 0, item as T);
  return next;
}

const sameCell = (c: Celda, a: string, p: string) => c.avatarId === a && c.productoId === p;

export const useAppStore = create<AppStore>()((set, get) => {
  /** Aplica una transformación pura sobre data registrando historial. */
  const commit = (fn: (d: State) => State): boolean => {
    const { data, past, readOnly } = get();
    if (readOnly) {
      get().toast('Snapshot de solo lectura: duplícalo para editar.', 'error');
      return false;
    }
    const next = fn(data);
    if (next === data) return false;
    set({ data: next, past: [...past, data].slice(-HISTORY_LIMIT), future: [] });
    return true;
  };

  return {
    data: emptyState(),
    past: [],
    future: [],
    readOnly: false,
    hydrated: false,

    view: 'matriz',
    heatmap: true,
    panelOpen: true,
    filtros: defaultFiltros(),
    modal: null,
    selectedCell: null,
    paletteOpen: false,
    toasts: [],
    moneda: 'EUR',
    lastSavedAt: null,
    capturing: false,

    addAvatar: (input) => {
      const id = uid('a-');
      const ok = commit((d) => ({ ...d, avatares: [...d.avatares, { ...input, nombre: input.nombre.trim(), id }] }));
      return ok ? id : null;
    },
    updateAvatar: (id, patch) =>
      void commit((d) => {
        if (!d.avatares.some((a) => a.id === id)) return d;
        return { ...d, avatares: d.avatares.map((a) => (a.id === id ? { ...a, ...patch } : a)) };
      }),
    removeAvatar: (id) =>
      void commit((d) => {
        if (!d.avatares.some((a) => a.id === id)) return d;
        return { ...d, avatares: d.avatares.filter((a) => a.id !== id), celdas: d.celdas.filter((c) => c.avatarId !== id) };
      }),
    addProducto: (input) => {
      const id = uid('p-');
      const ok = commit((d) => ({ ...d, productos: [...d.productos, { ...input, nombre: input.nombre.trim(), id }] }));
      return ok ? id : null;
    },
    updateProducto: (id, patch) =>
      void commit((d) => {
        if (!d.productos.some((p) => p.id === id)) return d;
        return { ...d, productos: d.productos.map((p) => (p.id === id ? { ...p, ...patch } : p)) };
      }),
    removeProducto: (id) =>
      void commit((d) => {
        if (!d.productos.some((p) => p.id === id)) return d;
        return { ...d, productos: d.productos.filter((p) => p.id !== id), celdas: d.celdas.filter((c) => c.productoId !== id) };
      }),
    upsertCelda: (celda) =>
      void commit((d) => {
        if (!d.avatares.some((a) => a.id === celda.avatarId) || !d.productos.some((p) => p.id === celda.productoId)) return d;
        const clean: Celda = {
          avatarId: celda.avatarId,
          productoId: celda.productoId,
          compra: celda.compra,
          unidades: celda.unidades,
          ...(celda.npsDelMatch !== undefined ? { npsDelMatch: celda.npsDelMatch } : {}),
          ...(celda.notas ? { notas: celda.notas } : {}),
        };
        const exists = d.celdas.some((c) => sameCell(c, celda.avatarId, celda.productoId));
        return {
          ...d,
          celdas: exists ? d.celdas.map((c) => (sameCell(c, celda.avatarId, celda.productoId) ? clean : c)) : [...d.celdas, clean],
        };
      }),
    clearCelda: (avatarId, productoId) =>
      void commit((d) => {
        if (!d.celdas.some((c) => sameCell(c, avatarId, productoId))) return d;
        return { ...d, celdas: d.celdas.filter((c) => !sameCell(c, avatarId, productoId)) };
      }),
    toggleCompra: (avatarId, productoId) => {
      const cur = get().data.celdas.find((c) => sameCell(c, avatarId, productoId));
      get().upsertCelda(
        cur ? { ...cur, compra: !cur.compra, unidades: !cur.compra && cur.unidades === 0 ? 1 : cur.unidades } : { avatarId, productoId, compra: true, unidades: 1 },
      );
    },
    moveAvatar: (from, to) =>
      void commit((d) => {
        const avatares = move(d.avatares, from, to);
        return avatares === d.avatares ? d : { ...d, avatares };
      }),
    moveProducto: (from, to) =>
      void commit((d) => {
        const productos = move(d.productos, from, to);
        return productos === d.productos ? d : { ...d, productos };
      }),
    importData: (input) => {
      const res = parseState(input);
      if (res.ok) commit(() => res.data);
      return res;
    },
    loadSample: () => void commit(() => sampleState()),
    reset: () => void commit((d) => (d.avatares.length || d.productos.length || d.celdas.length ? emptyState() : d)),
    undo: () => {
      const { past, data, future, readOnly } = get();
      const prev = past[past.length - 1];
      if (readOnly || !prev) return;
      set({ data: prev, past: past.slice(0, -1), future: [data, ...future].slice(0, HISTORY_LIMIT) });
    },
    redo: () => {
      const { past, data, future, readOnly } = get();
      const next = future[0];
      if (readOnly || !next) return;
      set({ data: next, past: [...past, data].slice(-HISTORY_LIMIT), future: future.slice(1) });
    },

    hydrate: (data, opts) => set({ data, past: [], future: [], readOnly: !!opts?.readOnly, hydrated: true }),
    setReadOnly: (v) => set({ readOnly: v }),
    markSaved: (t) => set({ lastSavedAt: t }),

    setView: (view) => set({ view }),
    setHeatmap: (heatmap) => set({ heatmap }),
    setPanelOpen: (panelOpen) => set({ panelOpen }),
    setFiltros: (patch) => set((s) => ({ filtros: { ...s.filtros, ...patch } })),
    resetFiltros: () => set({ filtros: defaultFiltros() }),
    openModal: (modal) => set({ modal, paletteOpen: false }),
    closeModal: () => set({ modal: null }),
    confirm: ({ title, message, confirmLabel = 'Eliminar', onConfirm }) =>
      set({ modal: { type: 'confirm', title, message, confirmLabel, onConfirm } }),
    selectCell: (selectedCell) => set({ selectedCell }),
    setPaletteOpen: (paletteOpen) => set({ paletteOpen }),
    toast: (message, tone = 'info') => {
      const id = uid('t-');
      set((s) => ({ toasts: [...s.toasts.slice(-3), { id, message, tone }] }));
      setTimeout(() => get().dismissToast(id), 4000);
    },
    dismissToast: (id) => set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })),
    setMoneda: (moneda) => set({ moneda }),
    setCapturing: (capturing) => set({ capturing }),
  };
});
