import type { State } from '../types';
import { cellKey, type Metrics } from './metrics';

export type InsightTipo = 'mono-producto' | 'huerfano' | 'match-perfecto' | 'concentracion' | 'oportunidad-top' | 'detractor' | 'sin-compras' | 'cobertura';

export interface Insight {
  id: string;
  tipo: InsightTipo;
  titulo: string;
  evidencia: string;
  accion: string;
  /** Impacto estimado en unidades monetarias: sirve para ordenar. */
  impacto: number;
  severidad: 'alta' | 'media' | 'baja';
}

type Fmt = (n: number) => string;

const pct = (r: number) => `${Math.round(r * 100)}%`;

/**
 * Motor determinista: genera candidatos por regla, ordena por impacto y
 * devuelve entre 3 y 6 hallazgos (menos sólo si no hay datos suficientes).
 */
export function generateInsights(state: State, m: Metrics, money: Fmt): Insight[] {
  const { avatares, productos } = state;
  if (!avatares.length || !productos.length) return [];
  const out: Insight[] = [];
  const productoById = new Map(productos.map((p) => [p.id, p] as const));

  // 1. Avatar mono-producto → cross-sell
  for (const a of avatares) {
    const t = m.porAvatar.get(a.id);
    if (!t || t.compras !== 1) continue;
    const comprado = productos.find((p) => m.celdaMap.get(cellKey(a.id, p.id))?.compra);
    const mejor = m.oportunidades.find((o) => o.avatar.id === a.id);
    const impacto = mejor?.potencial ?? 0;
    out.push({
      id: `mono-${a.id}`,
      tipo: 'mono-producto',
      titulo: `Avatar mono-producto: ${a.nombre}`,
      evidencia: `Solo compra «${comprado?.nombre ?? '—'}» (1 de ${productos.length} productos, ${money(t.ingreso)} de ingreso).${
        mejor ? ` Hueco de mayor potencial: «${mejor.producto.nombre}» (${money(mejor.potencial)}).` : ''
      }`,
      accion: mejor
        ? `Lanza una oferta de cross-sell de «${mejor.producto.nombre}» a ${a.nombre} justo después de su compra de «${comprado?.nombre ?? 'entrada'}».`
        : `Diseña un bundle que lleve a ${a.nombre} a un segundo producto.`,
      impacto,
      severidad: impacto > 0 ? 'alta' : 'media',
    });
  }

  // 2. Producto huérfano → candidato a jubilar
  for (const p of productos) {
    const t = m.porProducto.get(p.id);
    if (!t || t.compras > 0) continue;
    const segTotal = avatares.reduce((s, a) => s + a.tamañoSegmento, 0);
    out.push({
      id: `huerfano-${p.id}`,
      tipo: 'huerfano',
      titulo: `Producto huérfano: ${p.nombre}`,
      evidencia: `0 de ${avatares.length} avatares lo compran. Precio ${money(p.precio)}; mantenerlo consume catálogo y foco.`,
      accion: `Jubila «${p.nombre}» o reposiciónalo con un test de 30 días dirigido a un solo avatar antes de decidir.`,
      // Coste de oportunidad: lo que se dejaría de ganar si el 1% del mercado lo comprase.
      impacto: segTotal * p.precio * 0.01,
      severidad: 'media',
    });
  }

  // 3. Match perfecto (NPS >= 9)
  const perfectos = state.celdas.filter((c) => c.compra && (c.npsDelMatch ?? -1) >= 9);
  if (perfectos.length) {
    const ingresoPerf = perfectos.reduce((s, c) => s + (m.ingresoCelda.get(cellKey(c.avatarId, c.productoId)) ?? 0), 0);
    const nombres = perfectos
      .slice()
      .sort((x, y) => (m.ingresoCelda.get(cellKey(y.avatarId, y.productoId)) ?? 0) - (m.ingresoCelda.get(cellKey(x.avatarId, x.productoId)) ?? 0))
      .slice(0, 3)
      .map((c) => {
        const a = avatares.find((x) => x.id === c.avatarId);
        return `${a?.nombre ?? '?'} × ${productoById.get(c.productoId)?.nombre ?? '?'} (NPS ${c.npsDelMatch})`;
      });
    out.push({
      id: 'match-perfecto',
      tipo: 'match-perfecto',
      titulo: `${perfectos.length} match${perfectos.length > 1 ? 'es' : ''} perfecto${perfectos.length > 1 ? 's' : ''} (NPS ≥ 9)`,
      evidencia: `${nombres.join('; ')}. Suman ${money(ingresoPerf)} (${pct(m.total.ingreso ? ingresoPerf / m.total.ingreso : 0)} del ingreso).`,
      accion: 'Convierte estos matches en casos de éxito y testimonios, y úsalos como público semilla para campañas lookalike.',
      impacto: ingresoPerf,
      severidad: 'media',
    });
  }

  // 4. Diversificación de riesgo: concentración en la celda top
  if (m.topCelda && m.total.ingreso > 0) {
    const { avatar, producto, share, ingreso } = m.topCelda;
    const sev = share >= 0.4 ? 'alta' : share >= 0.25 ? 'media' : 'baja';
    out.push({
      id: 'concentracion',
      tipo: 'concentracion',
      titulo: `Riesgo de concentración: ${pct(share)} en una sola celda`,
      evidencia: `${avatar.nombre} × ${producto.nombre} genera ${money(ingreso)} de ${money(m.total.ingreso)}.`,
      accion:
        sev === 'baja'
          ? 'Mantén la diversificación: ninguna celda supera el 25% del ingreso. Revisa este indicador cada trimestre.'
          : `Reduce la dependencia: fija un objetivo para que ${avatar.nombre} × ${producto.nombre} baje del 25% creciendo las 2 siguientes celdas.`,
      // El ingreso expuesto escala con la concentración.
      impacto: sev === 'baja' ? ingreso * 0.1 : ingreso * share,
      severidad: sev,
    });
  }

  // 5. Detractores: matches con NPS <= 6
  const detractores = state.celdas.filter((c) => c.compra && c.npsDelMatch !== undefined && c.npsDelMatch <= 6);
  if (detractores.length) {
    const ingresoDet = detractores.reduce((s, c) => s + (m.ingresoCelda.get(cellKey(c.avatarId, c.productoId)) ?? 0), 0);
    const ej = detractores
      .slice(0, 2)
      .map((c) => `${avatares.find((a) => a.id === c.avatarId)?.nombre ?? '?'} × ${productoById.get(c.productoId)?.nombre ?? '?'} (NPS ${c.npsDelMatch})`);
    out.push({
      id: 'detractor',
      tipo: 'detractor',
      titulo: `${detractores.length} match${detractores.length > 1 ? 'es' : ''} con NPS detractor (≤ 6)`,
      evidencia: `${ej.join('; ')}. ${money(ingresoDet)} de ingreso en riesgo de churn.`,
      accion: 'Entrevista a 5 clientes de cada match detractor esta semana y corrige la promesa del producto antes de escalar ventas.',
      impacto: ingresoDet,
      severidad: 'alta',
    });
  }

  // 6. Avatares que no compran nada
  const sinCompras = avatares.filter((a) => (m.porAvatar.get(a.id)?.compras ?? 0) === 0);
  if (sinCompras.length) {
    const best = m.oportunidades.find((o) => o.avatar.id === sinCompras[0]!.id);
    out.push({
      id: 'sin-compras',
      tipo: 'sin-compras',
      titulo: `${sinCompras.length} avatar${sinCompras.length > 1 ? 'es' : ''} sin ninguna compra`,
      evidencia: `${sinCompras.map((a) => a.nombre).slice(0, 3).join(', ')} no compran ningún producto del catálogo.`,
      accion: best
        ? `Valida si ${best.avatar.nombre} es un avatar real: ofrécele «${best.producto.nombre}» como producto de entrada o elimínalo del foco.`
        : 'Valida si estos avatares son reales o elimínalos del foco comercial.',
      impacto: sinCompras.reduce((s, a) => s + (m.oportunidades.find((o) => o.avatar.id === a.id)?.potencial ?? 0), 0) * 0.5,
      severidad: 'media',
    });
  }

  // Relleno para garantizar >= 3: top oportunidad y cobertura general
  const top = m.oportunidades[0];
  if (top && top.potencial > 0) {
    out.push({
      id: 'oportunidad-top',
      tipo: 'oportunidad-top',
      titulo: `Mayor hueco: ${top.avatar.nombre} × ${top.producto.nombre}`,
      evidencia: `Segmento de ${top.avatar.tamañoSegmento.toLocaleString('es-ES')} × precio ${money(top.producto.precio)} = potencial ${money(top.potencial)}${
        top.npsProducto !== null ? `; el producto tiene NPS medio ${top.npsProducto.toFixed(1)} en otros avatares` : ''
      }.`,
      accion: `Prueba una campaña de ${top.producto.nombre} para ${top.avatar.nombre} con un piloto de 2 semanas y mide conversión.`,
      impacto: top.potencial * 0.05,
      severidad: 'baja',
    });
  }
  out.push({
    id: 'cobertura',
    tipo: 'cobertura',
    titulo: `Cobertura de la matriz: ${pct(m.total.cobertura)}`,
    evidencia: `${m.total.compras} de ${avatares.length * productos.length} combinaciones avatar × producto tienen compras. Índice de cross-sell: ${m.indiceCrossSell.toFixed(1)} productos por avatar comprador.`,
    accion:
      m.total.cobertura < 0.5
        ? 'Sube el índice de cross-sell a 2+ productos por avatar con secuencias post-compra antes de captar nuevos segmentos.'
        : 'Prioriza profundidad (más unidades por celda) sobre amplitud: la cobertura ya es alta.',
    impacto: 0,
    severidad: 'baja',
  });

  const sevRank = { alta: 0, media: 1, baja: 2 } as const;
  out.sort((x, y) => y.impacto - x.impacto || sevRank[x.severidad] - sevRank[y.severidad]);
  // Los dos rellenos sólo entran si hacen falta para llegar a 3.
  const core = out.filter((i) => i.tipo !== 'oportunidad-top' && i.tipo !== 'cobertura');
  const filler = out.filter((i) => i.tipo === 'oportunidad-top' || i.tipo === 'cobertura');
  const result = core.slice(0, 6);
  for (const f of filler) if (result.length < 3) result.push(f);
  return result.sort((x, y) => y.impacto - x.impacto || sevRank[x.severidad] - sevRank[y.severidad]);
}
