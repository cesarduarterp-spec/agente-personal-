import { useEffect, useRef, type ReactNode } from 'react';
import { useFieldArray, useForm, type DefaultValues, type FieldError, type Resolver, type UseFormReturn } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { DndContext, KeyboardSensor, PointerSensor, closestCenter, useSensor, useSensors, type DragEndEvent } from '@dnd-kit/core';
import { SortableContext, arrayMove, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { ArrowDown, ArrowUp, GripVertical, Plus, Trash2 } from 'lucide-react';
import type { PasoN, Pasos, Tactica } from '../lib/schema';
import { FRECUENCIAS, pasoSchemas } from '../lib/schema';
import { calcROI, costoHerramientasHorizonte, fmtMoney, fmtPct } from '../lib/calc';
import { useTacticaStore } from '../store/useTacticaStore';

export const STEP_FORM_ID = 'step-form';

/* ------------------------- utilidades de forma ---------------------- */

function sanitize<T>(v: T): T {
  if (typeof v === 'number') return (Number.isFinite(v) ? v : 0) as T;
  if (Array.isArray(v)) return v.map(sanitize) as T;
  if (v && typeof v === 'object') return Object.fromEntries(Object.entries(v).map(([k, x]) => [k, sanitize(x)])) as T;
  return (v ?? '') as T;
}

/** Formulario de un paso: validación zod + sincronización de borrador con debounce. */
function useStepForm<N extends PasoN>(t: Tactica, n: N): UseFormReturn<Pasos[N]> {
  const form = useForm<Pasos[N]>({
    resolver: zodResolver(pasoSchemas[n]) as unknown as Resolver<Pasos[N]>,
    defaultValues: structuredClone(t.pasos[n]) as DefaultValues<Pasos[N]>,
    mode: 'onTouched',
  });
  const updatePaso = useTacticaStore((s) => s.updatePaso);
  const timer = useRef<ReturnType<typeof setTimeout>>();
  const pending = useRef<Pasos[N] | null>(null);
  useEffect(() => {
    const flush = () => {
      if (pending.current) updatePaso(t.id, n, pending.current, `${t.id}:${n}`);
      pending.current = null;
    };
    const sub = form.watch((values) => {
      pending.current = sanitize(structuredClone(values)) as Pasos[N];
      clearTimeout(timer.current);
      timer.current = setTimeout(flush, 350);
    });
    return () => {
      sub.unsubscribe();
      clearTimeout(timer.current);
      flush();
    };
  }, [form, t.id, n, updatePaso]);
  return form;
}

export interface StepProps {
  t: Tactica;
  onValid: <N extends PasoN>(n: N, data: Pasos[N]) => void;
}

/* ------------------------------ campos ----------------------------- */

function Err({ e, id }: { e?: FieldError | { message?: string }; id?: string }) {
  return e?.message ? <p id={id} className="err" role="alert">{e.message}</p> : null;
}

function Field({ label, id, error, hint, children }: { label: string; id: string; error?: { message?: string }; hint?: string; children: ReactNode }) {
  return (
    <div>
      <label htmlFor={id} className="label">{label}</label>
      {hint && <p className="text-xs mb-1" id={`${id}-hint`}>{hint}</p>}
      {children}
      <Err e={error} id={`${id}-err`} />
    </div>
  );
}

const aria = (err: unknown, id: string) => ({
  'aria-invalid': err ? ('true' as const) : ('false' as const),
  'aria-describedby': err ? `${id}-err` : undefined,
});

/** Lista de textos (fuentes, equipo) sobre un array de strings. */
function StringList({
  form, name, label, placeholder, min = 1,
}: { form: UseFormReturn<any>; name: string; label: string; placeholder: string; min?: number }) {
  const values = (form.watch(name) as string[] | undefined) ?? [];
  const errs = form.formState.errors[name] as unknown as (FieldError & Record<number, FieldError>) | undefined;
  const set = (arr: string[]) => form.setValue(name, arr, { shouldDirty: true, shouldValidate: form.formState.isSubmitted });
  return (
    <fieldset>
      <legend className="label">{label}</legend>
      <ul className="flex flex-col gap-2">
        {values.map((_, i) => (
          <li key={i} className="flex gap-2">
            <label className="sr-only" htmlFor={`${name}-${i}`}>{`${label} ${i + 1}`}</label>
            <input id={`${name}-${i}`} className="input" placeholder={placeholder} {...form.register(`${name}.${i}`)} {...aria(errs?.[i], `${name}-${i}`)} />
            <button type="button" className="btn btn-icon" disabled={values.length <= min} onClick={() => set(values.filter((__, j) => j !== i))} aria-label={`Quitar ${label.toLowerCase()} ${i + 1}`}>
              <Trash2 size={16} aria-hidden />
            </button>
          </li>
        ))}
      </ul>
      {values.map((_, i) => <Err key={i} e={errs?.[i]} id={`${name}-${i}-err`} />)}
      <Err e={errs?.root ?? errs} />
      <button type="button" className="btn mt-2" onClick={() => set([...values, ''])}><Plus size={16} aria-hidden /> Añadir</button>
    </fieldset>
  );
}

/* ------------------------------ pasos ------------------------------ */

function Paso1({ t, onValid }: StepProps) {
  const f = useStepForm(t, 1);
  const e = f.formState.errors;
  return (
    <form id={STEP_FORM_ID} noValidate onSubmit={f.handleSubmit((d) => onValid(1, d))} className="flex flex-col gap-4">
      <Field label="Evidencia que la justifica" id="ev" error={e.evidenciaJustifica} hint="Datos, no opiniones: cifras, tests previos, benchmarks.">
        <textarea id="ev" rows={5} className="input" {...f.register('evidenciaJustifica')} {...aria(e.evidenciaJustifica, 'ev')} />
      </Field>
      <StringList form={f} name="fuentes" label="Fuentes" placeholder="Ej. Google Analytics – cohortes 2026" />
    </form>
  );
}

function SortableRow({ id, index, total, children, onMove }: { id: string; index: number; total: number; children: ReactNode; onMove: (from: number, to: number) => void }) {
  const { attributes, listeners, setNodeRef, setActivatorNodeRef, transform, transition, isDragging } = useSortable({ id });
  return (
    <li ref={setNodeRef} style={{ transform: CSS.Transform.toString(transform), transition }} className={`flex gap-2 items-start ${isDragging ? 'relative z-10 bg-yellow' : ''}`}>
      <button type="button" ref={setActivatorNodeRef} {...attributes} {...listeners} className="hidden md:inline-flex btn btn-icon cursor-grab touch-none" aria-label={`Reordenar paso ${index + 1}. Espacio para tomar, flechas para mover, Enter para soltar.`}>
        <GripVertical size={16} aria-hidden />
      </button>
      <span className="font-display text-xl w-6 pt-2 text-right" aria-hidden>{index + 1}</span>
      <div className="flex-1">{children}</div>
      <div className="flex md:hidden flex-col">
        <button type="button" className="btn btn-icon !min-h-[22px] !py-0" disabled={index === 0} onClick={() => onMove(index, index - 1)} aria-label={`Subir paso ${index + 1}`}><ArrowUp size={14} aria-hidden /></button>
        <button type="button" className="btn btn-icon !min-h-[22px] !py-0" disabled={index === total - 1} onClick={() => onMove(index, index + 1)} aria-label={`Bajar paso ${index + 1}`}><ArrowDown size={14} aria-hidden /></button>
      </div>
    </li>
  );
}

function Paso2({ t, onValid }: StepProps) {
  const f = useStepForm(t, 2);
  const values = f.watch('planPasoAPaso') ?? [];
  const errs = f.formState.errors.planPasoAPaso as unknown as (FieldError & Record<number, FieldError>) | undefined;
  const set = (arr: string[]) => f.setValue('planPasoAPaso', arr, { shouldDirty: true, shouldValidate: f.formState.isSubmitted });
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 4 } }), useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }));
  const ids = values.map((_, i) => `plan-${i}`);
  const move = (a: number, b: number) => set(arrayMove(values, a, b));
  const onEnd = (e: DragEndEvent) => {
    if (!e.over || e.active.id === e.over.id) return;
    move(ids.indexOf(String(e.active.id)), ids.indexOf(String(e.over.id)));
  };
  return (
    <form id={STEP_FORM_ID} noValidate onSubmit={f.handleSubmit((d) => onValid(2, d))} className="flex flex-col gap-3">
      <p className="text-sm">Ordena los pasos arrastrando (o con teclado). Mínimo 3, cada uno con verbo de acción.</p>
      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragEnd={onEnd}
        accessibility={{
          announcements: {
            onDragStart: ({ active }) => `Tomaste el paso ${ids.indexOf(String(active.id)) + 1}.`,
            onDragOver: ({ over }) => (over ? `Sobre la posición ${ids.indexOf(String(over.id)) + 1}.` : 'Fuera de la lista.'),
            onDragEnd: ({ over }) => (over ? `Soltado en la posición ${ids.indexOf(String(over.id)) + 1}.` : 'Soltado sin cambios.'),
            onDragCancel: () => 'Reordenación cancelada.',
          },
        }}
      >
        <SortableContext items={ids} strategy={verticalListSortingStrategy}>
          <ol className="flex flex-col gap-2">
            {values.map((_, i) => (
              <SortableRow key={ids[i]} id={ids[i]!} index={i} total={values.length} onMove={move}>
                <div className="flex gap-2">
                  <label htmlFor={`plan-${i}-in`} className="sr-only">{`Paso ${i + 1}`}</label>
                  <input id={`plan-${i}-in`} className="input" placeholder="Ej. Segmentar compradores recurrentes" {...f.register(`planPasoAPaso.${i}`)} {...aria(errs?.[i], `plan-${i}-in`)} />
                  <button type="button" className="btn btn-icon" disabled={values.length <= 1} onClick={() => set(values.filter((__, j) => j !== i))} aria-label={`Quitar paso ${i + 1}`}><Trash2 size={16} aria-hidden /></button>
                </div>
                <Err e={errs?.[i]} id={`plan-${i}-in-err`} />
              </SortableRow>
            ))}
          </ol>
        </SortableContext>
      </DndContext>
      <Err e={errs?.root ?? errs} />
      <button type="button" className="btn self-start" onClick={() => set([...values, ''])}><Plus size={16} aria-hidden /> Añadir paso</button>
    </form>
  );
}

function Paso3({ t, onValid }: StepProps) {
  const f = useStepForm(t, 3);
  const e = f.formState.errors;
  return (
    <form id={STEP_FORM_ID} noValidate onSubmit={f.handleSubmit((d) => onValid(3, d))} className="flex flex-col gap-4">
      <Field label="Responsable (una sola persona)" id="resp" error={e.responsable}>
        <input id="resp" className="input" placeholder="Nombre (rol)" {...f.register('responsable')} {...aria(e.responsable, 'resp')} />
      </Field>
      <StringList form={f} name="equipo" label="Equipo" placeholder="Persona o proveedor" />
    </form>
  );
}

function Paso4({ t, onValid }: StepProps) {
  const f = useStepForm(t, 4);
  const { fields, append, remove } = useFieldArray({ control: f.control, name: 'herramientas' });
  const e = f.formState.errors.herramientas;
  const vals = f.watch('herramientas') ?? [];
  const mensual = vals.reduce((s, h) => s + (Number.isFinite(h?.costoMensual) ? h.costoMensual : 0), 0);
  return (
    <form id={STEP_FORM_ID} noValidate onSubmit={f.handleSubmit((d) => onValid(4, d))} className="flex flex-col gap-3">
      <ul className="flex flex-col gap-2">
        {fields.map((fl, i) => (
          <li key={fl.id} className="grid grid-cols-[1fr_8rem_auto] gap-2 items-start">
            <div>
              <label htmlFor={`h-n-${i}`} className="sr-only">Herramienta {i + 1}</label>
              <input id={`h-n-${i}`} className="input" placeholder="Herramienta" {...f.register(`herramientas.${i}.nombre`)} {...aria(e?.[i]?.nombre, `h-n-${i}`)} />
              <Err e={e?.[i]?.nombre} id={`h-n-${i}-err`} />
            </div>
            <div>
              <label htmlFor={`h-c-${i}`} className="sr-only">Costo mensual {i + 1}</label>
              <input id={`h-c-${i}`} type="number" inputMode="decimal" min={0} step="any" className="input" placeholder="USD/mes" {...f.register(`herramientas.${i}.costoMensual`, { valueAsNumber: true })} {...aria(e?.[i]?.costoMensual, `h-c-${i}`)} />
              <Err e={e?.[i]?.costoMensual} id={`h-c-${i}-err`} />
            </div>
            <button type="button" className="btn btn-icon" disabled={fields.length <= 1} onClick={() => remove(i)} aria-label={`Quitar herramienta ${i + 1}`}><Trash2 size={16} aria-hidden /></button>
          </li>
        ))}
      </ul>
      <Err e={e?.root ?? (e as FieldError | undefined)} />
      <button type="button" className="btn self-start" onClick={() => append({ nombre: '', costoMensual: 0 })}><Plus size={16} aria-hidden /> Añadir herramienta</button>
      <p className="text-sm font-bold">Total: <span className="hl">{fmtMoney(mensual)}/mes</span> · en el horizonte: {fmtMoney(costoHerramientasHorizonte({ ...t, pasos: { ...t.pasos, 4: { herramientas: vals } } }))}</p>
    </form>
  );
}

function Scale({ form, name, label }: { form: UseFormReturn<Pasos[5]>; name: 'probabilidad' | 'impacto'; label: string }) {
  const v = Number(form.watch(name));
  const err = form.formState.errors[name];
  return (
    <fieldset aria-describedby={err ? `${name}-err` : undefined}>
      <legend className="label">{label}</legend>
      <div className="flex gap-1" role="radiogroup" aria-label={label}>
        {[1, 2, 3, 4, 5].map((n) => (
          <label key={n} className={`btn btn-icon cursor-pointer ${v === n ? '!bg-black !text-white' : ''}`}>
            <input type="radio" className="sr-only" value={n} checked={v === n} onChange={() => form.setValue(name, n, { shouldDirty: true, shouldValidate: true })} />
            {n}
          </label>
        ))}
      </div>
      <Err e={err} id={`${name}-err`} />
    </fieldset>
  );
}

function Paso5({ t, onValid }: StepProps) {
  const f = useStepForm(t, 5);
  const e = f.formState.errors;
  const score = (Number(f.watch('probabilidad')) || 0) * (Number(f.watch('impacto')) || 0);
  return (
    <form id={STEP_FORM_ID} noValidate onSubmit={f.handleSubmit((d) => onValid(5, d))} className="flex flex-col gap-4">
      <Field label="Riesgo principal" id="rp" error={e.riesgoPrincipal}>
        <textarea id="rp" rows={3} className="input" {...f.register('riesgoPrincipal')} {...aria(e.riesgoPrincipal, 'rp')} />
      </Field>
      <Field label="Mitigación" id="mi" error={e.mitigacion} hint="Acción concreta, con dueño y momento.">
        <textarea id="mi" rows={3} className="input" {...f.register('mitigacion')} {...aria(e.mitigacion, 'mi')} />
      </Field>
      <div className="grid sm:grid-cols-2 gap-4">
        <Scale form={f} name="probabilidad" label="Probabilidad (1-5)" />
        <Scale form={f} name="impacto" label="Impacto (1-5)" />
      </div>
      <p className="text-sm font-bold">Puntaje de riesgo: <span className="hl">{score}/25</span></p>
    </form>
  );
}

function Paso6({ t, onValid }: StepProps) {
  const f = useStepForm(t, 6);
  const { fields, append, remove } = useFieldArray({ control: f.control, name: 'desglose' });
  const e = f.formState.errors;
  const desglose = f.watch('desglose') ?? [];
  const total = Math.round(desglose.reduce((s, d) => s + (Number.isFinite(d?.monto) ? d.monto : 0), 0) * 100) / 100;
  useEffect(() => {
    if (f.getValues('inversionEstimada') !== total) f.setValue('inversionEstimada', total, { shouldValidate: f.formState.isSubmitted });
  }, [total, f]);
  return (
    <form id={STEP_FORM_ID} noValidate onSubmit={f.handleSubmit((d) => onValid(6, d))} className="flex flex-col gap-3">
      <ul className="flex flex-col gap-2">
        {fields.map((fl, i) => (
          <li key={fl.id} className="grid grid-cols-[1fr_8rem_auto] gap-2 items-start">
            <div>
              <label htmlFor={`d-c-${i}`} className="sr-only">Concepto {i + 1}</label>
              <input id={`d-c-${i}`} className="input" placeholder="Concepto (pauta, diseño, herramientas…)" {...f.register(`desglose.${i}.concepto`)} {...aria(e.desglose?.[i]?.concepto, `d-c-${i}`)} />
              <Err e={e.desglose?.[i]?.concepto} id={`d-c-${i}-err`} />
            </div>
            <div>
              <label htmlFor={`d-m-${i}`} className="sr-only">Monto {i + 1}</label>
              <input id={`d-m-${i}`} type="number" inputMode="decimal" min={0} step="any" className="input" placeholder="USD" {...f.register(`desglose.${i}.monto`, { valueAsNumber: true })} {...aria(e.desglose?.[i]?.monto, `d-m-${i}`)} />
              <Err e={e.desglose?.[i]?.monto} id={`d-m-${i}-err`} />
            </div>
            <button type="button" className="btn btn-icon" disabled={fields.length <= 1} onClick={() => remove(i)} aria-label={`Quitar concepto ${i + 1}`}><Trash2 size={16} aria-hidden /></button>
          </li>
        ))}
      </ul>
      <Err e={e.desglose?.root ?? (e.desglose as FieldError | undefined)} />
      <button type="button" className="btn self-start" onClick={() => append({ concepto: '', monto: 0 })}><Plus size={16} aria-hidden /> Añadir concepto</button>
      <div className="card p-3 flex items-center justify-between">
        <span className="font-bold">Inversión estimada (suma automática)</span>
        <output className="font-display text-2xl" aria-live="polite">{fmtMoney(total)}</output>
      </div>
      <Err e={e.inversionEstimada} />
    </form>
  );
}

function Paso7({ t, onValid }: StepProps) {
  const f = useStepForm(t, 7);
  const e = f.formState.errors;
  return (
    <form id={STEP_FORM_ID} noValidate onSubmit={f.handleSubmit((d) => onValid(7, d))} className="flex flex-col gap-4">
      <Field label="KPI de éxito" id="kpi" error={e.kpiExito} hint="Un número que puedas leer en una herramienta, no una sensación.">
        <input id="kpi" className="input" {...f.register('kpiExito')} {...aria(e.kpiExito, 'kpi')} />
      </Field>
      <Field label="Fórmula de medición" id="fm" error={e.formulaMedicion}>
        <input id="fm" className="input" placeholder="Ej. Pedidos atribuidos / inversión en pauta" {...f.register('formulaMedicion')} {...aria(e.formulaMedicion, 'fm')} />
      </Field>
      <Field label="Frecuencia de medición" id="fr" error={e.frecuencia}>
        <select id="fr" className="input" {...f.register('frecuencia')} {...aria(e.frecuencia, 'fr')}>
          <option value="">Elige…</option>
          {FRECUENCIAS.map((x) => <option key={x} value={x}>{x[0]!.toUpperCase() + x.slice(1)}</option>)}
        </select>
      </Field>
    </form>
  );
}

function Paso8({ t, onValid }: StepProps) {
  const f = useStepForm(t, 8);
  const e = f.formState.errors;
  const inv = t.pasos[6].inversionEstimada;
  const ret = f.watch('retornoEsperado');
  const roi = calcROI(Number.isFinite(ret) ? ret : 0, inv);
  useEffect(() => {
    if (f.getValues('roiProyectado') !== roi) f.setValue('roiProyectado', roi);
  }, [roi, f]);
  return (
    <form id={STEP_FORM_ID} noValidate onSubmit={f.handleSubmit((d) => onValid(8, d))} className="flex flex-col gap-4">
      <div className="grid sm:grid-cols-2 gap-4">
        <Field label="Retorno esperado (USD)" id="ret" error={e.retornoEsperado} hint="Ingresos o ahorro atribuible en el horizonte.">
          <input id="ret" type="number" inputMode="decimal" min={0} step="any" className="input" {...f.register('retornoEsperado', { valueAsNumber: true })} {...aria(e.retornoEsperado, 'ret')} />
        </Field>
        <Field label="Horizonte (meses)" id="hz" error={e.horizonteMeses}>
          <input id="hz" type="number" inputMode="numeric" min={1} max={60} className="input" {...f.register('horizonteMeses', { valueAsNumber: true })} {...aria(e.horizonteMeses, 'hz')} />
        </Field>
      </div>
      <div className={`card p-4 ${roi < 0 ? 'border-red' : 'bg-yellow'}`}>
        <p className="text-sm font-bold">ROI proyectado = (retorno − inversión) / inversión</p>
        <p className="text-sm">({fmtMoney(Number.isFinite(ret) ? ret : 0)} − {fmtMoney(inv)}) / {fmtMoney(inv)}</p>
        <output className={`font-display text-4xl block mt-1 ${roi < 0 ? 'text-red' : ''}`} aria-live="polite">{inv > 0 ? fmtPct(roi) : 'Completa el paso 6'}</output>
      </div>
    </form>
  );
}

export const STEP_COMPONENTS: Record<PasoN, (p: StepProps) => JSX.Element> = {
  1: Paso1, 2: Paso2, 3: Paso3, 4: Paso4, 5: Paso5, 6: Paso6, 7: Paso7, 8: Paso8,
};
