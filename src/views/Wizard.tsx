import { useEffect, useMemo, useState } from 'react';
import { Check, ChevronLeft, ChevronRight, ClipboardCopy, FileDown, Plus, Trash2 } from 'lucide-react';
import type { Estado, PasoN, Pasos, Tactica } from '../lib/schema';
import { ESTADO_LABEL, ESTADOS, PASO_META, PASOS, pasoValido, tacticaCompleta } from '../lib/schema';
import { fmtMoney, fmtPct, ritmo, riskScore, roiReal, todayISO } from '../lib/calc';
import { briefMarkdown, exportBriefPDF } from '../lib/exporters';
import { Modal } from '../components/Modal';
import { useTacticaStore, selectCanales } from '../store/useTacticaStore';
import { useUiStore } from '../store/useUiStore';
import { useTacticaActions } from '../hooks/useTacticaActions';
import { STEP_COMPONENTS, STEP_FORM_ID } from './steps';

type Tab = PasoN | 'brief' | 'resultados';

export function Wizard() {
  const id = useUiStore((s) => s.editingId);
  const close = () => useUiStore.getState().openEditor(null);
  const t = useTacticaStore((s) => s.tacticas.find((x) => x.id === id));
  const readOnly = useTacticaStore((s) => s.readOnly);
  const firstInvalid = (x: Tactica) => PASOS.find((n) => !pasoValido(x, n));
  const [tab, setTab] = useState<Tab>(1);

  useEffect(() => {
    if (!t) return;
    const fi = firstInvalid(t);
    setTab(t.estado === 'ejecutando' || t.estado === 'medida' ? 'resultados' : fi ?? 'brief');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  if (!id || !t) return null;
  return (
    <Modal open size="full" title={readOnly ? `Ver táctica` : 'Aterrizar táctica'} onClose={close} initialFocus="#t-nombre"
      footer={<Footer t={t} tab={tab} setTab={setTab} readOnly={readOnly} />}
    >
      <Header t={t} readOnly={readOnly} />
      <Stepper t={t} tab={tab} setTab={setTab} />
      <fieldset disabled={readOnly} className="mt-4 min-w-0">
        {typeof tab === 'number' ? (
          <StepPanel key={`${t.id}-${tab}`} t={t} n={tab} onNext={(n) => setTab(n < 8 ? ((n + 1) as PasoN) : 'brief')} />
        ) : tab === 'brief' ? (
          <Brief t={t} />
        ) : (
          <Resultados t={t} />
        )}
      </fieldset>
    </Modal>
  );
}

function Header({ t, readOnly }: { t: Tactica; readOnly: boolean }) {
  const update = useTacticaStore((s) => s.updateTactica);
  const canales = useTacticaStore((s) => selectCanales(s.tacticas));
  return (
    <fieldset disabled={readOnly} className="grid gap-3 md:grid-cols-[2fr_1fr_1fr]">
      <div>
        <label htmlFor="t-nombre" className="label">Nombre de la táctica</label>
        <input id="t-nombre" className="input font-display text-lg" value={t.nombre} onChange={(e) => update(t.id, { nombre: e.target.value }, `${t.id}:nombre`)} aria-invalid={t.nombre.trim().length < 3} />
        {t.nombre.trim().length < 3 && <p className="err">Mínimo 3 caracteres</p>}
      </div>
      <div>
        <label htmlFor="t-canal" className="label">Canal</label>
        <input id="t-canal" className="input" list="canales" placeholder="Email, Meta Ads, SEO…" value={t.canal} onChange={(e) => update(t.id, { canal: e.target.value }, `${t.id}:canal`)} />
        <datalist id="canales">{canales.map((c) => <option key={c} value={c} />)}</datalist>
      </div>
      <div>
        <label htmlFor="t-fecha" className="label">Fecha de inicio</label>
        <input id="t-fecha" type="date" className="input" value={t.fechaInicio} onChange={(e) => update(t.id, { fechaInicio: e.target.value }, `${t.id}:fecha`)} />
      </div>
    </fieldset>
  );
}

function Stepper({ t, tab, setTab }: { t: Tactica; tab: Tab; setTab: (t: Tab) => void }) {
  const firstInvalid = PASOS.find((n) => !pasoValido(t, n)) ?? 9;
  return (
    <nav aria-label="Pasos del wizard" className="mt-4 overflow-x-auto">
      <ol className="flex gap-1 min-w-max">
        {PASOS.map((n) => {
          const ok = pasoValido(t, n);
          const reachable = n <= firstInvalid; // no se salta un paso sin datos mínimos
          const current = tab === n;
          return (
            <li key={n}>
              <button
                type="button"
                disabled={!reachable}
                aria-current={current ? 'step' : undefined}
                onClick={() => setTab(n)}
                className={`btn !min-h-[44px] !px-2 flex-col !gap-0 !items-start w-[92px] ${current ? '!bg-black !text-white' : ok ? '!bg-yellow' : ''}`}
                title={reachable ? PASO_META[n].pregunta : 'Completa los pasos anteriores'}
              >
                <span className="text-xs flex items-center gap-1">{n} {ok && <Check size={12} aria-label="validado" />}</span>
                <span className="text-xs">{PASO_META[n].titulo}</span>
              </button>
            </li>
          );
        })}
        <li>
          <button type="button" disabled={firstInvalid !== 9} aria-current={tab === 'brief' ? 'step' : undefined} onClick={() => setTab('brief')} className={`btn !min-h-[44px] w-[92px] ${tab === 'brief' ? '!bg-black !text-white' : ''}`}>Brief</button>
        </li>
        <li>
          <button type="button" aria-current={tab === 'resultados' ? 'step' : undefined} onClick={() => setTab('resultados')} className={`btn !min-h-[44px] w-[100px] ${tab === 'resultados' ? '!bg-black !text-white' : ''}`}>Resultados</button>
        </li>
      </ol>
    </nav>
  );
}

function StepPanel({ t, n, onNext }: { t: Tactica; n: PasoN; onNext: (n: PasoN) => void }) {
  const updatePaso = useTacticaStore((s) => s.updatePaso);
  const Comp = STEP_COMPONENTS[n];
  const onValid = <N extends PasoN>(k: N, data: Pasos[N]) => {
    updatePaso(t.id, k, data);
    onNext(k);
  };
  return (
    <section aria-labelledby="step-h">
      <p className="text-xs font-bold">PASO {n} DE 8</p>
      <h3 id="step-h" className="text-2xl mb-1">{PASO_META[n].titulo}</h3>
      <p className="mb-4"><span className="hl">{PASO_META[n].pregunta}</span></p>
      <Comp t={t} onValid={onValid} />
    </section>
  );
}

function Footer({ t, tab, setTab, readOnly }: { t: Tactica; tab: Tab; setTab: (t: Tab) => void; readOnly: boolean }) {
  const close = () => useUiStore.getState().openEditor(null);
  if (typeof tab !== 'number')
    return <button className="btn" onClick={close}>Cerrar</button>;
  return (
    <>
      <button className="btn mr-auto" disabled={tab === 1} onClick={() => setTab((tab - 1) as PasoN)}><ChevronLeft size={16} aria-hidden /> Anterior</button>
      <button className="btn" onClick={close}>Guardar y cerrar</button>
      {readOnly ? (
        <button className="btn btn-primary" onClick={() => setTab(tab < 8 ? ((tab + 1) as PasoN) : 'brief')}>Siguiente</button>
      ) : (
        <button className="btn btn-primary" type="submit" form={STEP_FORM_ID}>
          {tab < 8 ? 'Validar y seguir' : 'Generar brief'} <ChevronRight size={16} aria-hidden />
        </button>
      )}
      <span className="sr-only">Táctica {t.nombre}</span>
    </>
  );
}

function Brief({ t }: { t: Tactica }) {
  const { move } = useTacticaActions();
  const toast = useUiStore((s) => s.toast);
  const readOnly = useTacticaStore((s) => s.readOnly);
  const completa = tacticaCompleta(t);
  const p = t.pasos;
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(briefMarkdown(t));
      toast('Brief copiado en Markdown');
    } catch {
      toast('No se pudo copiar al portapapeles', 'error');
    }
  };
  return (
    <section aria-labelledby="brief-h" className="flex flex-col gap-4">
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div>
          <p className="text-xs font-bold">BRIEF LISTO PARA EJECUTAR</p>
          <h3 id="brief-h" className="text-3xl">{t.nombre}</h3>
        </div>
        <div className="flex flex-wrap gap-2">
          <button className="btn" onClick={copy}><ClipboardCopy size={16} aria-hidden /> Copiar Markdown</button>
          <button className="btn btn-dark" onClick={() => exportBriefPDF(t).catch(() => toast('Error al generar el PDF', 'error'))}><FileDown size={16} aria-hidden /> Brief PDF</button>
        </div>
      </div>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
        {[
          ['Inversión', fmtMoney(p[6].inversionEstimada)],
          ['Retorno', fmtMoney(p[8].retornoEsperado)],
          ['ROI proyectado', fmtPct(p[8].roiProyectado)],
          ['Riesgo', `${riskScore(t)}/25`],
        ].map(([k, v]) => (
          <div key={k} className={`card p-3 ${k === 'ROI proyectado' ? (p[8].roiProyectado < 0 ? 'border-red' : 'bg-yellow') : ''}`}>
            <p className="text-xs font-bold">{k}</p>
            <p className="font-display text-2xl">{v}</p>
          </div>
        ))}
      </div>
      <dl className="grid md:grid-cols-2 gap-3 text-sm">
        <div className="card p-3"><dt className="font-bold">Evidencia</dt><dd>{p[1].evidenciaJustifica}</dd></div>
        <div className="card p-3"><dt className="font-bold">Plan</dt><dd><ol className="list-decimal pl-5">{p[2].planPasoAPaso.filter(Boolean).map((x, i) => <li key={i}>{x}</li>)}</ol></dd></div>
        <div className="card p-3"><dt className="font-bold">Responsable</dt><dd>{p[3].responsable} · {p[3].equipo.filter(Boolean).join(', ')}</dd></div>
        <div className="card p-3"><dt className="font-bold">KPI</dt><dd>{p[7].kpiExito} — {p[7].formulaMedicion} ({p[7].frecuencia})</dd></div>
        <div className="card p-3 md:col-span-2"><dt className="font-bold">Riesgo y mitigación</dt><dd>{p[5].riesgoPrincipal} → {p[5].mitigacion}</dd></div>
      </dl>
      {!readOnly && (
        <div className="card p-3 flex flex-wrap items-center gap-2">
          <span className="font-bold mr-2">Estado: {ESTADO_LABEL[t.estado]}</span>
          {ESTADOS.filter((e) => e !== t.estado).map((e: Estado) => (
            <button key={e} className={`btn ${e === 'aprobada' && t.estado === 'draft' ? 'btn-primary' : ''}`} disabled={e !== 'draft' && !completa} onClick={() => move(t.id, e)}>
              Mover a {ESTADO_LABEL[e]}
            </button>
          ))}
        </div>
      )}
    </section>
  );
}

function Resultados({ t }: { t: Tactica }) {
  const add = useTacticaStore((s) => s.addMedicion);
  const remove = useTacticaStore((s) => s.removeMedicion);
  const readOnly = useTacticaStore((s) => s.readOnly);
  const toast = useUiStore((s) => s.toast);
  const [form, setForm] = useState({ fecha: todayISO(), valorKpi: '', retornoReal: '', nota: '' });
  const [err, setErr] = useState('');
  const real = roiReal(t);
  const r = ritmo(t);
  const sorted = useMemo(() => [...t.mediciones].sort((a, b) => b.fecha.localeCompare(a.fecha)), [t.mediciones]);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const v = Number(form.valorKpi), ret = Number(form.retornoReal);
    if (!form.fecha || form.valorKpi === '' || !Number.isFinite(v) || form.retornoReal === '' || !Number.isFinite(ret) || ret < 0) {
      setErr('Completa fecha, valor del KPI y retorno acumulado (≥ 0)');
      return;
    }
    setErr('');
    add(t.id, { fecha: form.fecha, valorKpi: v, retornoReal: ret, nota: form.nota.trim() });
    setForm({ ...form, valorKpi: '', retornoReal: '', nota: '' });
    toast('Medición registrada');
  };

  return (
    <section aria-labelledby="res-h" className="flex flex-col gap-4">
      <div>
        <h3 id="res-h" className="text-2xl">Resultados reales</h3>
        <p className="text-sm">Registra el KPI «{t.pasos[7].kpiExito || 'sin definir'}» y el retorno acumulado. Así el ROI deja de ser una promesa.</p>
      </div>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
        <div className="card p-3"><p className="text-xs font-bold">ROI proyectado</p><p className="font-display text-2xl">{fmtPct(t.pasos[8].roiProyectado)}</p></div>
        <div className={`card p-3 ${real !== null && real < 0 ? 'border-red' : ''}`}><p className="text-xs font-bold">ROI real</p><p className="font-display text-2xl">{real === null ? '—' : fmtPct(real)}</p></div>
        <div className="card p-3"><p className="text-xs font-bold">Avance del retorno</p><p className="font-display text-2xl">{r ? fmtPct(r.avance) : '—'}</p></div>
        <div className="card p-3"><p className="text-xs font-bold">Horizonte consumido</p><p className="font-display text-2xl">{r ? fmtPct(r.tiempo) : '—'}</p></div>
      </div>
      {r && (
        <div aria-label="Ritmo: avance frente a tiempo" className="flex flex-col gap-1 text-xs font-bold">
          <span>Retorno</span>
          <div className="h-4 border-2 border-black"><div className="h-full bg-blue" style={{ width: `${Math.min(100, r.avance * 100)}%` }} /></div>
          <span>Tiempo</span>
          <div className="h-4 border-2 border-black"><div className="h-full bg-black" style={{ width: `${Math.min(100, r.tiempo * 100)}%` }} /></div>
        </div>
      )}
      {!readOnly && (
        <form onSubmit={submit} noValidate className="card p-3 grid gap-2 md:grid-cols-[9rem_1fr_1fr_2fr_auto] items-end">
          <div><label className="label" htmlFor="m-f">Fecha</label><input id="m-f" type="date" className="input" value={form.fecha} onChange={(e) => setForm({ ...form, fecha: e.target.value })} /></div>
          <div><label className="label" htmlFor="m-k">Valor KPI</label><input id="m-k" type="number" step="any" inputMode="decimal" className="input" value={form.valorKpi} onChange={(e) => setForm({ ...form, valorKpi: e.target.value })} /></div>
          <div><label className="label" htmlFor="m-r">Retorno acumulado USD</label><input id="m-r" type="number" step="any" min={0} inputMode="decimal" className="input" value={form.retornoReal} onChange={(e) => setForm({ ...form, retornoReal: e.target.value })} /></div>
          <div><label className="label" htmlFor="m-n">Nota</label><input id="m-n" className="input" value={form.nota} onChange={(e) => setForm({ ...form, nota: e.target.value })} /></div>
          <button className="btn btn-primary" type="submit"><Plus size={16} aria-hidden /> Registrar</button>
          {err && <p className="err md:col-span-5" role="alert">{err}</p>}
        </form>
      )}
      {sorted.length === 0 ? (
        <p className="border-2 border-dashed border-black p-4 font-bold">Aún no hay mediciones. Registra la primera cuando tengas el dato de tu herramienta.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[520px] border-2 border-black text-sm">
            <thead className="bg-black text-white"><tr><th className="text-left p-2">Fecha</th><th className="text-right p-2">KPI</th><th className="text-right p-2">Retorno acum.</th><th className="text-left p-2">Nota</th><th className="p-2"><span className="sr-only">Acciones</span></th></tr></thead>
            <tbody>
              {sorted.map((m) => (
                <tr key={m.id} className="border-t-2 border-black">
                  <td className="p-2">{m.fecha}</td>
                  <td className="p-2 text-right tabular-nums">{m.valorKpi}</td>
                  <td className="p-2 text-right tabular-nums">{fmtMoney(m.retornoReal)}</td>
                  <td className="p-2">{m.nota}</td>
                  <td className="p-2 text-right">{!readOnly && <button className="btn btn-icon btn-danger !min-h-[32px]" onClick={() => remove(t.id, m.id)} aria-label={`Eliminar medición del ${m.fecha}`}><Trash2 size={14} aria-hidden /></button>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
