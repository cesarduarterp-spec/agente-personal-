import type { Moneda } from '../types';

const cache = new Map<string, Intl.NumberFormat>();

export function fmtMoney(n: number, moneda: Moneda = 'EUR', compact = false): string {
  const key = `${moneda}:${compact}`;
  let f = cache.get(key);
  if (!f) {
    f = new Intl.NumberFormat('es-ES', {
      style: 'currency',
      currency: moneda,
      maximumFractionDigits: compact ? 1 : 0,
      notation: compact ? 'compact' : 'standard',
    });
    cache.set(key, f);
  }
  return f.format(n);
}

const intFmt = new Intl.NumberFormat('es-ES', { maximumFractionDigits: 0 });
export const fmtInt = (n: number): string => intFmt.format(n);

export const fmtPct = (ratio: number): string => `${Math.round(ratio * 100)}%`;

export function fmtDate(d: Date): string {
  return d.toLocaleDateString('es-ES', { day: '2-digit', month: 'long', year: 'numeric' });
}

export function slugDate(d = new Date()): string {
  return d.toISOString().slice(0, 10);
}
