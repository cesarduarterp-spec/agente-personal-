import type { Avatar, Celda, Producto, State } from '../types';

export const cellKey = (avatarId: string, productoId: string): string => `${avatarId}::${productoId}`;

export interface Totales {
  ingreso: number;
  unidades: number;
  /** Ratio 0..1 */
  cobertura: number;
  compras: number;
}

export interface Oportunidad {
  avatar: Avatar;
  producto: Producto;
  /** tamañoSegmento × precio */
  potencial: number;
  /** NPS medio que ese producto obtiene en otros avatares (señal de afinidad). */
  npsProducto: number | null;
}

export interface Metrics {
  celdaMap: Map<string, Celda>;
  ingresoCelda: Map<string, number>;
  porAvatar: Map<string, Totales>;
  porProducto: Map<string, Totales>;
  total: Totales;
  /** Ingreso máximo de una sola celda (para el heatmap). */
  maxIngresoCelda: number;
  /** Promedio de productos comprados por avatar que compra algo. */
  indiceCrossSell: number;
  /** NPS medio de los matches ponderado por unidades (0..10) o null si no hay NPS. */
  afinidadMedia: number | null;
  topCelda: { avatar: Avatar; producto: Producto; ingreso: number; share: number } | null;
  oportunidades: Oportunidad[];
}

const emptyTotals = (): Totales => ({ ingreso: 0, unidades: 0, cobertura: 0, compras: 0 });

export function computeMetrics(state: State): Metrics {
  const { avatares, productos, celdas } = state;
  const celdaMap = new Map<string, Celda>();
  for (const c of celdas) celdaMap.set(cellKey(c.avatarId, c.productoId), c);

  const precio = new Map(productos.map((p) => [p.id, p.precio] as const));
  const ingresoCelda = new Map<string, number>();
  const porAvatar = new Map<string, Totales>(avatares.map((a) => [a.id, emptyTotals()]));
  const porProducto = new Map<string, Totales>(productos.map((p) => [p.id, emptyTotals()]));
  const total = emptyTotals();
  let maxIngresoCelda = 0;
  let top: Metrics['topCelda'] = null;
  let npsSum = 0;
  let npsWeight = 0;
  const npsPorProducto = new Map<string, { sum: number; n: number }>();

  const avatarById = new Map(avatares.map((a) => [a.id, a] as const));
  const productoById = new Map(productos.map((p) => [p.id, p] as const));

  for (const c of celdas) {
    if (!c.compra) continue;
    const a = porAvatar.get(c.avatarId);
    const p = porProducto.get(c.productoId);
    const pr = precio.get(c.productoId);
    if (!a || !p || pr === undefined) continue;
    const ingreso = c.unidades * pr;
    const k = cellKey(c.avatarId, c.productoId);
    ingresoCelda.set(k, ingreso);
    a.ingreso += ingreso;
    a.unidades += c.unidades;
    a.compras += 1;
    p.ingreso += ingreso;
    p.unidades += c.unidades;
    p.compras += 1;
    total.ingreso += ingreso;
    total.unidades += c.unidades;
    total.compras += 1;
    if (ingreso > maxIngresoCelda) maxIngresoCelda = ingreso;
    if (!top || ingreso > top.ingreso) {
      top = { avatar: avatarById.get(c.avatarId)!, producto: productoById.get(c.productoId)!, ingreso, share: 0 };
    }
    if (c.npsDelMatch !== undefined) {
      const w = Math.max(1, c.unidades);
      npsSum += c.npsDelMatch * w;
      npsWeight += w;
      const np = npsPorProducto.get(c.productoId) ?? { sum: 0, n: 0 };
      np.sum += c.npsDelMatch;
      np.n += 1;
      npsPorProducto.set(c.productoId, np);
    }
  }

  const nP = productos.length;
  const nA = avatares.length;
  porAvatar.forEach((t) => (t.cobertura = nP ? t.compras / nP : 0));
  porProducto.forEach((t) => (t.cobertura = nA ? t.compras / nA : 0));
  total.cobertura = nA && nP ? total.compras / (nA * nP) : 0;

  const compradores = [...porAvatar.values()].filter((t) => t.compras > 0);
  const indiceCrossSell = compradores.length ? compradores.reduce((s, t) => s + t.compras, 0) / compradores.length : 0;

  if (top && total.ingreso > 0) top.share = top.ingreso / total.ingreso;
  if (top && top.ingreso === 0) top = null;

  const oportunidades: Oportunidad[] = [];
  for (const a of avatares) {
    for (const p of productos) {
      const c = celdaMap.get(cellKey(a.id, p.id));
      if (c?.compra) continue;
      const np = npsPorProducto.get(p.id);
      oportunidades.push({
        avatar: a,
        producto: p,
        potencial: a.tamañoSegmento * p.precio,
        npsProducto: np ? np.sum / np.n : null,
      });
    }
  }
  oportunidades.sort((x, y) => y.potencial - x.potencial || x.avatar.nombre.localeCompare(y.avatar.nombre));

  return {
    celdaMap,
    ingresoCelda,
    porAvatar,
    porProducto,
    total,
    maxIngresoCelda,
    indiceCrossSell,
    afinidadMedia: npsWeight ? npsSum / npsWeight : null,
    topCelda: top,
    oportunidades,
  };
}

/** Bucket 0..4 para el heatmap (escalones discretos, sin degradados). */
export function heatBucket(ingreso: number, max: number): 0 | 1 | 2 | 3 | 4 {
  if (ingreso <= 0 || max <= 0) return 0;
  const r = ingreso / max;
  if (r > 0.75) return 4;
  if (r > 0.5) return 3;
  if (r > 0.25) return 2;
  return 1;
}
