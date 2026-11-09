import { create } from 'zustand';
import type { Estado } from '../lib/schema';
import type { RiskLevel } from '../lib/calc';

export type View = 'tablero' | 'portafolio';

export interface Filters {
  estados: Estado[];
  canal: string; // '' = todos
  riesgo: RiskLevel | '';
  soloRoiNegativo: boolean;
  soloListas: boolean;
}

export const EMPTY_FILTERS: Filters = { estados: [], canal: '', riesgo: '', soloRoiNegativo: false, soloListas: false };

export interface Toast {
  id: number;
  text: string;
  tone: 'info' | 'error';
}

export interface ConfirmRequest {
  title: string;
  body: string;
  confirmLabel: string;
  requireText?: string;
  resolve: (ok: boolean) => void;
}

interface UiStore {
  view: View;
  editingId: string | null;
  search: string;
  filters: Filters;
  insightsOpen: boolean;
  paletteOpen: boolean;
  settingsOpen: boolean;
  sheetOpen: boolean;
  lastSavedAt: number | null;
  toasts: Toast[];
  confirm: ConfirmRequest | null;
  setView: (v: View) => void;
  openEditor: (id: string | null) => void;
  setSearch: (s: string) => void;
  setFilters: (f: Partial<Filters>) => void;
  clearFilters: () => void;
  set: (p: Partial<Pick<UiStore, 'insightsOpen' | 'paletteOpen' | 'settingsOpen' | 'sheetOpen' | 'lastSavedAt'>>) => void;
  toast: (text: string, tone?: Toast['tone']) => void;
  dismissToast: (id: number) => void;
  ask: (req: Omit<ConfirmRequest, 'resolve'>) => Promise<boolean>;
  closeConfirm: (ok: boolean) => void;
}

let toastId = 0;

export const useUiStore = create<UiStore>()((set, get) => ({
  view: 'tablero',
  editingId: null,
  search: '',
  filters: EMPTY_FILTERS,
  insightsOpen: typeof window !== 'undefined' ? window.innerWidth >= 1280 : true,
  paletteOpen: false,
  settingsOpen: false,
  sheetOpen: false,
  lastSavedAt: null,
  toasts: [],
  confirm: null,
  setView: (view) => set({ view }),
  openEditor: (editingId) => set({ editingId }),
  setSearch: (search) => set({ search }),
  setFilters: (f) => set({ filters: { ...get().filters, ...f } }),
  clearFilters: () => set({ filters: EMPTY_FILTERS, search: '' }),
  set: (p) => set(p),
  toast: (text, tone = 'info') => {
    const id = ++toastId;
    set({ toasts: [...get().toasts, { id, text, tone }].slice(-4) });
    setTimeout(() => get().dismissToast(id), 4000);
  },
  dismissToast: (id) => set({ toasts: get().toasts.filter((t) => t.id !== id) }),
  ask: (req) =>
    new Promise<boolean>((resolve) => {
      get().confirm?.resolve(false);
      set({ confirm: { ...req, resolve } });
    }),
  closeConfirm: (ok) => {
    const c = get().confirm;
    set({ confirm: null });
    c?.resolve(ok);
  },
}));
