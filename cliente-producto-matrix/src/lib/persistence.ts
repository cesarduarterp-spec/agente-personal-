import type { Envelope, Moneda, State } from '../types';
import { makeEnvelope, parseState } from './schema';

export const APP_SLUG = 'cliente-producto-matrix';
export const STORAGE_KEY = `vn-${APP_SLUG}`;
export const PREFS_KEY = `vn-${APP_SLUG}-prefs`;

export interface Prefs {
  tourSeen: boolean;
  moneda: Moneda;
  heatmap: boolean;
  panelOpen: boolean;
}

const defaultPrefs: Prefs = { tourSeen: false, moneda: 'EUR', heatmap: true, panelOpen: true };

function safeGet(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}
function safeSet(key: string, value: string): boolean {
  try {
    localStorage.setItem(key, value);
    return true;
  } catch {
    return false;
  }
}

export function loadState(): State | null {
  const raw = safeGet(STORAGE_KEY);
  if (!raw) return null;
  try {
    const res = parseState(JSON.parse(raw));
    return res.ok ? res.data : null;
  } catch {
    return null;
  }
}

export function saveState(data: State): Envelope | null {
  const env = makeEnvelope(data);
  return safeSet(STORAGE_KEY, JSON.stringify(env)) ? env : null;
}

export function loadPrefs(): Prefs {
  const raw = safeGet(PREFS_KEY);
  if (!raw) return { ...defaultPrefs };
  try {
    return { ...defaultPrefs, ...(JSON.parse(raw) as Partial<Prefs>) };
  } catch {
    return { ...defaultPrefs };
  }
}

export function savePrefs(patch: Partial<Prefs>): void {
  safeSet(PREFS_KEY, JSON.stringify({ ...loadPrefs(), ...patch }));
}

export function hasStoredData(): boolean {
  const s = loadState();
  return !!s && (s.avatares.length > 0 || s.productos.length > 0);
}

export function debounce<A extends unknown[]>(fn: (...args: A) => void, ms: number) {
  let t: ReturnType<typeof setTimeout> | undefined;
  const d = (...args: A) => {
    if (t) clearTimeout(t);
    t = setTimeout(() => fn(...args), ms);
  };
  d.cancel = () => t && clearTimeout(t);
  return d;
}
