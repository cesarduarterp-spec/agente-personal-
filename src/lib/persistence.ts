import { compressToEncodedURIComponent, decompressFromEncodedURIComponent } from 'lz-string';
import type { Tactica } from './schema';
import { envelopeSchema, stateSchema, STORAGE_VERSION } from './schema';
import { STORAGE_KEY, useTacticaStore } from '../store/useTacticaStore';

export function readLocal(): Tactica[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const env = envelopeSchema.safeParse(JSON.parse(raw));
    return env.success ? env.data.data.tacticas : [];
  } catch {
    return [];
  }
}

export function writeLocal(tacticas: Tactica[]): string {
  const updatedAt = new Date().toISOString();
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ v: STORAGE_VERSION, updatedAt, data: { tacticas } }));
  } catch {
    /* almacenamiento lleno o bloqueado: seguimos en memoria */
  }
  return updatedAt;
}

/** Suscribe el store a localStorage con debounce de 500 ms. */
export function startAutosave(onSaved: (at: number) => void, delay = 500): () => void {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const unsub = useTacticaStore.subscribe((s, prev) => {
    if (s.readOnly || !s.hydrated || s.tacticas === prev.tacticas) return;
    clearTimeout(timer);
    timer = setTimeout(() => {
      writeLocal(useTacticaStore.getState().tacticas);
      onSaved(Date.now());
    }, delay);
  });
  return () => {
    clearTimeout(timer);
    unsub();
  };
}

/* ------------------------- Enlace compartible ------------------------ */
/* lz-string compressToEncodedURIComponent = base64 URL-safe comprimido.   */

export function encodeSnapshot(tacticas: Tactica[]): string {
  return compressToEncodedURIComponent(JSON.stringify({ v: STORAGE_VERSION, data: { tacticas } }));
}

export function decodeSnapshot(s: string): Tactica[] | null {
  try {
    const json = decompressFromEncodedURIComponent(s);
    if (!json) return null;
    const raw = JSON.parse(json) as { data?: unknown };
    const parsed = stateSchema.safeParse(raw.data);
    return parsed.success ? parsed.data.tacticas : null;
  } catch {
    return null;
  }
}

export function publicBase(): string {
  const env = (import.meta.env.VITE_PUBLIC_URL as string | undefined)?.replace(/\/$/, '');
  return env || `${window.location.origin}${window.location.pathname}`;
}

export function buildShareUrl(tacticas: Tactica[]): string {
  return `${publicBase()}?s=${encodeSnapshot(tacticas)}`;
}

export function clearShareParam() {
  const url = new URL(window.location.href);
  url.searchParams.delete('s');
  url.searchParams.delete('id');
  window.history.replaceState(null, '', url.toString());
}
