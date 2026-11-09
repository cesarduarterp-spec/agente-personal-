import { beforeEach, describe, expect, it } from 'vitest';
import { HISTORY_LIMIT, useTacticaStore } from '../store/useTacticaStore';
import { calcROI } from '../lib/calc';
import { computeInsights } from '../lib/insights';
import { sampleData } from '../lib/sample';
import { decodeSnapshot, encodeSnapshot } from '../lib/persistence';
import { tacticaCompleta } from '../lib/schema';
import { toCSV } from '../lib/exporters';

const s = () => useTacticaStore.getState();

beforeEach(() => {
  useTacticaStore.setState({ tacticas: [], past: [], future: [], readOnly: false, hydrated: true });
});

describe('store: CRUD + historial', () => {
  it('add', () => {
    const id = s().addTactica('Webinar mensual');
    expect(id).toBeTruthy();
    expect(s().tacticas).toHaveLength(1);
    expect(s().tacticas[0]!.nombre).toBe('Webinar mensual');
    expect(s().tacticas[0]!.estado).toBe('draft');
  });

  it('update recalcula inversión y ROI', () => {
    const id = s().addTactica()!;
    s().updatePaso(id, 6, { inversionEstimada: 0, desglose: [{ concepto: 'Pauta', monto: 1000 }, { concepto: 'Diseño', monto: 500 }] });
    s().updatePaso(id, 8, { retornoEsperado: 3000, horizonteMeses: 3, roiProyectado: 0 });
    const t = s().tacticas[0]!;
    expect(t.pasos[6].inversionEstimada).toBe(1500);
    expect(t.pasos[8].roiProyectado).toBe(1);
    s().updateTactica(id, { nombre: 'Renombrada' });
    expect(s().tacticas[0]!.nombre).toBe('Renombrada');
  });

  it('remove', () => {
    const id = s().addTactica()!;
    s().removeTactica(id);
    expect(s().tacticas).toHaveLength(0);
  });

  it('undo / redo', () => {
    const a = s().addTactica('A')!;
    s().addTactica('B');
    s().removeTactica(a);
    expect(s().tacticas.map((t) => t.nombre)).toEqual(['B']);
    s().undo();
    expect(s().tacticas.map((t) => t.nombre)).toEqual(['B', 'A']);
    s().undo();
    expect(s().tacticas.map((t) => t.nombre)).toEqual(['A']);
    s().redo();
    s().redo();
    expect(s().tacticas.map((t) => t.nombre)).toEqual(['B']);
    // una acción nueva invalida el futuro
    s().undo();
    s().addTactica('C');
    expect(s().future).toHaveLength(0);
  });

  it('historial limitado a 30 acciones', () => {
    for (let i = 0; i < 40; i++) s().addTactica(`T${i}`);
    expect(s().past).toHaveLength(HISTORY_LIMIT);
  });

  it('coalesce: ediciones seguidas con la misma clave = 1 entrada', () => {
    const id = s().addTactica()!;
    const before = s().past.length;
    s().updateTactica(id, { nombre: 'a' }, 'k');
    s().updateTactica(id, { nombre: 'ab' }, 'k');
    s().updateTactica(id, { nombre: 'abc' }, 'k');
    expect(s().past.length).toBe(before + 1);
  });

  it('no se aprueba sin los 8 pasos válidos', () => {
    const id = s().addTactica()!;
    const r = s().setEstado(id, 'aprobada');
    expect(r.ok).toBe(false);
    expect(s().tacticas[0]!.estado).toBe('draft');
  });

  it('modo solo lectura bloquea mutaciones', () => {
    s().hydrate(sampleData(), { readOnly: true });
    expect(s().addTactica()).toBeNull();
    s().removeTactica(s().tacticas[0]!.id);
    expect(s().tacticas).toHaveLength(5);
  });
});

describe('import / export', () => {
  it('export → import ida y vuelta', () => {
    s().loadSample();
    const json = s().exportJSON();
    const parsed = JSON.parse(json);
    expect(parsed.v).toBe(1);
    expect(parsed.updatedAt).toBeTypeOf('string');
    s().reset();
    expect(s().tacticas).toHaveLength(0);
    expect(s().importJSON(json)).toEqual({ ok: true });
    expect(s().tacticas).toHaveLength(5);
  });

  it('rechaza JSON corrupto sin tocar el estado', () => {
    s().addTactica('Intacta');
    expect(s().importJSON('{no json').ok).toBe(false);
    expect(s().importJSON(JSON.stringify({ v: 1, updatedAt: 'x', data: { tacticas: [{ id: 1 }] } })).ok).toBe(false);
    expect(s().tacticas.map((t) => t.nombre)).toEqual(['Intacta']);
  });

  it('enlace compartido comprime y restaura', () => {
    const data = sampleData();
    const restored = decodeSnapshot(encodeSnapshot(data));
    expect(restored).toHaveLength(5);
    expect(restored![0]!.nombre).toBe(data[0]!.nombre);
    expect(decodeSnapshot('basura')).toBeNull();
  });

  it('CSV una fila por táctica', () => {
    const csv = toCSV(sampleData());
    expect(csv.split('\n')).toHaveLength(6);
  });
});

describe('negocio', () => {
  it('ROI = (retorno - inversión) / inversión', () => {
    expect(calcROI(1500, 1000)).toBe(0.5);
    expect(calcROI(500, 1000)).toBe(-0.5);
    expect(calcROI(100, 0)).toBe(0);
  });

  it('datos de ejemplo disparan los insights clave', () => {
    const data = sampleData();
    expect(data.filter(tacticaCompleta).length).toBeGreaterThanOrEqual(4);
    const ids = computeInsights(data).map((i) => i.id);
    expect(ids).toEqual(expect.arrayContaining(['roi-negativo', 'concentracion', 'riesgo-recurrente', 'listas-semana']));
    expect(ids.length).toBeGreaterThanOrEqual(3);
    expect(ids.length).toBeLessThanOrEqual(6);
  });
});
