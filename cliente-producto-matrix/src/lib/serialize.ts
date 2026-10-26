import type { State } from '../types';
import { cellKey, computeMetrics } from './metrics';
import { makeEnvelope } from './schema';

export function toJSON(data: State): string {
  return JSON.stringify(makeEnvelope(data), null, 2);
}

const esc = (v: string | number | boolean | undefined): string => {
  if (v === undefined) return '';
  const s = String(v);
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

/** Una fila por celda (avatar × producto), incluidas las vacías. */
export function toCSV(data: State): string {
  const m = computeMetrics(data);
  const header = [
    'avatar_id',
    'avatar',
    'tamano_segmento',
    'producto_id',
    'producto',
    'precio',
    'compra',
    'unidades',
    'ingreso',
    'nps_del_match',
    'potencial',
    'notas',
  ];
  const rows = [header.join(',')];
  for (const a of data.avatares) {
    for (const p of data.productos) {
      const c = m.celdaMap.get(cellKey(a.id, p.id));
      rows.push(
        [
          a.id,
          a.nombre,
          a.tamañoSegmento,
          p.id,
          p.nombre,
          p.precio,
          c?.compra ? 'si' : 'no',
          c?.unidades ?? 0,
          m.ingresoCelda.get(cellKey(a.id, p.id)) ?? 0,
          c?.npsDelMatch,
          c?.compra ? 0 : a.tamañoSegmento * p.precio,
          c?.notas,
        ]
          .map(esc)
          .join(','),
      );
    }
  }
  // BOM para que Excel detecte UTF-8 (acentos y ñ).
  return '﻿' + rows.join('\r\n');
}
