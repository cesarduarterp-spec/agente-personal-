import { beforeEach, describe, expect, it } from 'vitest';
import { HISTORY_LIMIT, emptyState, useAppStore } from './useAppStore';
import { selectInsights, selectMetrics, selectVisible } from './selectors';
import { toCSV, toJSON } from '../lib/serialize';
import { decodeShare, encodeShare } from '../lib/share';
import { sampleState } from '../lib/sample';

const s = () => useAppStore.getState();

beforeEach(() => {
  s().hydrate(emptyState());
  s().resetFiltros();
});

describe('store: CRUD', () => {
  it('add / update / remove avatar y producto', () => {
    const a = s().addAvatar({ nombre: '  Pyme ', tamañoSegmento: 100 })!;
    const p = s().addProducto({ nombre: 'Curso', precio: 200 })!;
    expect(s().data.avatares).toEqual([{ id: a, nombre: 'Pyme', tamañoSegmento: 100 }]);
    s().updateAvatar(a, { tamañoSegmento: 300 });
    s().updateProducto(p, { precio: 250 });
    expect(s().data.avatares[0]!.tamañoSegmento).toBe(300);
    expect(s().data.productos[0]!.precio).toBe(250);

    s().upsertCelda({ avatarId: a, productoId: p, compra: true, unidades: 4, npsDelMatch: 9 });
    expect(selectMetrics(s().data).total.ingreso).toBe(1000);

    s().removeProducto(p);
    expect(s().data.productos).toHaveLength(0);
    expect(s().data.celdas).toHaveLength(0); // cascada
    s().removeAvatar(a);
    expect(s().data.avatares).toHaveLength(0);
  });

  it('toggleCompra crea celda con 1 unidad y la desactiva sin perder datos', () => {
    const a = s().addAvatar({ nombre: 'A', tamañoSegmento: 1 })!;
    const p = s().addProducto({ nombre: 'P', precio: 10 })!;
    s().toggleCompra(a, p);
    expect(s().data.celdas[0]).toMatchObject({ compra: true, unidades: 1 });
    s().toggleCompra(a, p);
    expect(s().data.celdas[0]).toMatchObject({ compra: false, unidades: 1 });
  });

  it('moveAvatar / moveProducto reordenan', () => {
    s().loadSample();
    const first = s().data.avatares[0]!.id;
    s().moveAvatar(0, 2);
    expect(s().data.avatares[2]!.id).toBe(first);
    const p0 = s().data.productos[0]!.id;
    s().moveProducto(0, 1);
    expect(s().data.productos[1]!.id).toBe(p0);
  });
});

describe('store: undo / redo', () => {
  it('deshace y rehace en orden', () => {
    s().addAvatar({ nombre: 'A', tamañoSegmento: 1 });
    s().addAvatar({ nombre: 'B', tamañoSegmento: 1 });
    expect(s().data.avatares).toHaveLength(2);
    s().undo();
    expect(s().data.avatares.map((a) => a.nombre)).toEqual(['A']);
    s().undo();
    expect(s().data.avatares).toHaveLength(0);
    s().redo();
    s().redo();
    expect(s().data.avatares.map((a) => a.nombre)).toEqual(['A', 'B']);
  });

  it('una acción nueva vacía el futuro', () => {
    s().addAvatar({ nombre: 'A', tamañoSegmento: 1 });
    s().undo();
    s().addAvatar({ nombre: 'C', tamañoSegmento: 1 });
    expect(s().future).toHaveLength(0);
  });

  it(`limita el historial a ${HISTORY_LIMIT} acciones`, () => {
    for (let i = 0; i < 40; i++) s().addAvatar({ nombre: `A${i}`, tamañoSegmento: i });
    expect(s().past).toHaveLength(HISTORY_LIMIT);
  });

  it('no registra acciones sin efecto', () => {
    s().updateAvatar('no-existe', { nombre: 'x' });
    expect(s().past).toHaveLength(0);
  });

  it('modo solo lectura bloquea edición', () => {
    s().hydrate(sampleState(), { readOnly: true });
    s().addAvatar({ nombre: 'X', tamañoSegmento: 1 });
    expect(s().data.avatares).toHaveLength(5);
  });
});

describe('store: import / export', () => {
  it('export JSON es re-importable', () => {
    s().loadSample();
    const json = toJSON(s().data);
    const original = s().data;
    s().reset();
    expect(s().data.avatares).toHaveLength(0);
    const res = s().importData(JSON.parse(json));
    expect(res.ok).toBe(true);
    expect(s().data).toEqual(original);
    s().undo(); // import es deshacible
    expect(s().data.avatares).toHaveLength(0);
  });

  it('rechaza JSON corrupto sin tocar el estado', () => {
    s().loadSample();
    const before = s().data;
    const bad = { v: 1, updatedAt: 'x', data: { avatares: [{ id: 'a', nombre: '', tamañoSegmento: -1 }], productos: [], celdas: [] } };
    expect(s().importData(bad).ok).toBe(false);
    expect(s().importData({ avatares: [], productos: [], celdas: [{ avatarId: 'x', productoId: 'y', compra: true, unidades: 1 }] }).ok).toBe(false);
    expect(s().importData('basura').ok).toBe(false);
    expect(s().data).toBe(before);
  });

  it('CSV tiene una fila por celda', () => {
    s().loadSample();
    const lines = toCSV(s().data).trim().split('\r\n');
    expect(lines).toHaveLength(1 + 5 * 7);
  });

  it('enlace compartido ida y vuelta', () => {
    const data = sampleState();
    const res = decodeShare(encodeShare(data));
    expect(res.ok && res.data).toEqual(data);
    expect(decodeShare('xxx').ok).toBe(false);
  });
});

describe('selectors e insights', () => {
  it('memoiza por referencia', () => {
    s().loadSample();
    expect(selectMetrics(s().data)).toBe(selectMetrics(s().data));
    expect(selectVisible(s())).toBe(selectVisible(s()));
  });

  it('genera entre 3 y 6 hallazgos con los tipos clave', () => {
    s().loadSample();
    const ins = selectInsights(s());
    expect(ins.length).toBeGreaterThanOrEqual(3);
    expect(ins.length).toBeLessThanOrEqual(6);
    const tipos = ins.map((i) => i.tipo);
    expect(tipos).toContain('mono-producto');
    expect(tipos).toContain('huerfano');
    expect(tipos).toContain('match-perfecto');
    expect(tipos).toContain('concentracion');
    for (let i = 1; i < ins.length; i++) expect(ins[i - 1]!.impacto).toBeGreaterThanOrEqual(ins[i]!.impacto);
  });

  it('oportunidades ordenadas por tamañoSegmento × precio', () => {
    s().loadSample();
    const ops = selectMetrics(s().data).oportunidades;
    expect(ops[0]!.potencial).toBe(ops[0]!.avatar.tamañoSegmento * ops[0]!.producto.precio);
    for (let i = 1; i < ops.length; i++) expect(ops[i - 1]!.potencial).toBeGreaterThanOrEqual(ops[i]!.potencial);
  });

  it('filtros combinables', () => {
    s().loadSample();
    s().setFiltros({ soloMono: true });
    expect(selectVisible(s()).avatares.map((a) => a.id)).toEqual(['a-estudiante']);
    s().setFiltros({ soloMono: false, soloHuerfanos: true });
    expect(selectVisible(s()).productos.map((p) => p.id)).toEqual(['p-auditoria']);
    s().setFiltros({ soloHuerfanos: false, query: 'mentor' });
    expect(selectVisible(s()).productos.map((p) => p.id)).toEqual(['p-mentoria']);
    expect(selectVisible(s()).avatares).toHaveLength(5);
  });
});
