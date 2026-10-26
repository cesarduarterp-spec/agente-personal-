import { useAppStore, type AppStore } from './useAppStore';
import { computeMetrics, type Metrics } from '../lib/metrics';
import { generateInsights, type Insight } from '../lib/insights';
import { fmtMoney } from '../lib/format';
import type { Avatar, Producto, State } from '../types';

/** Memoiza por identidad de referencia (los datos son inmutables). */
function memoRef<A extends object, R>(fn: (a: A) => R): (a: A) => R {
  let lastA: A | undefined;
  let lastR: R;
  return (a) => {
    if (a !== lastA) {
      lastA = a;
      lastR = fn(a);
    }
    return lastR;
  };
}

export const selectMetrics = memoRef((data: State): Metrics => computeMetrics(data));

let insightsKey: { data: State; moneda: string } | null = null;
let insightsVal: Insight[] = [];
export function selectInsights(s: Pick<AppStore, 'data' | 'moneda'>): Insight[] {
  if (!insightsKey || insightsKey.data !== s.data || insightsKey.moneda !== s.moneda) {
    insightsKey = { data: s.data, moneda: s.moneda };
    insightsVal = generateInsights(s.data, selectMetrics(s.data), (n) => fmtMoney(n, s.moneda));
  }
  return insightsVal;
}

export interface Visible {
  avatares: Avatar[];
  productos: Producto[];
}

let visKey: { data: State; filtros: AppStore['filtros'] } | null = null;
let visVal: Visible = { avatares: [], productos: [] };
/** Aplica búsqueda + filtros combinables a filas y columnas. */
export function selectVisible(s: Pick<AppStore, 'data' | 'filtros'>): Visible {
  if (visKey && visKey.data === s.data && visKey.filtros === s.filtros) return visVal;
  const { avatares, productos } = s.data;
  const m = selectMetrics(s.data);
  const q = s.filtros.query.trim().toLowerCase();
  const aMatch = q ? avatares.filter((a) => a.nombre.toLowerCase().includes(q)) : avatares;
  const pMatch = q ? productos.filter((p) => p.nombre.toLowerCase().includes(q)) : productos;
  // Si la búsqueda sólo coincide en un eje, el otro eje se muestra completo.
  let va = q && (aMatch.length || !pMatch.length) ? aMatch : avatares;
  let vp = q && (pMatch.length || !aMatch.length) ? pMatch : productos;
  if (s.filtros.soloMono) va = va.filter((a) => m.porAvatar.get(a.id)?.compras === 1);
  if (s.filtros.soloHuerfanos) vp = vp.filter((p) => (m.porProducto.get(p.id)?.compras ?? 0) === 0);
  const npsMin = s.filtros.npsMin;
  if (npsMin !== null) {
    const ok = new Set(s.data.celdas.filter((c) => c.compra && (c.npsDelMatch ?? -1) >= npsMin).map((c) => c.avatarId));
    va = va.filter((a) => ok.has(a.id));
  }
  visKey = { data: s.data, filtros: s.filtros };
  visVal = { avatares: va, productos: vp };
  return visVal;
}

export const useMetrics = () => useAppStore((s) => selectMetrics(s.data));
export const useInsights = () => useAppStore(selectInsights);
export const useVisible = () => useAppStore(selectVisible);
export const useCanUndo = () => useAppStore((s) => s.past.length > 0 && !s.readOnly);
export const useCanRedo = () => useAppStore((s) => s.future.length > 0 && !s.readOnly);
export const useIsEmpty = () => useAppStore((s) => s.data.avatares.length === 0 && s.data.productos.length === 0);
