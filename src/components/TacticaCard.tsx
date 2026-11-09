import { memo } from 'react';
import { Copy, GripVertical, Pencil, Trash2 } from 'lucide-react';
import type { DraggableAttributes, DraggableSyntheticListeners } from '@dnd-kit/core';
import type { Estado, Tactica } from '../lib/schema';
import { ESTADO_LABEL, ESTADOS, pasosValidos } from '../lib/schema';
import { fmtMoneyShort, fmtPct, riskLevel, riskScore, roiReal } from '../lib/calc';
import { useTacticaActions } from '../hooks/useTacticaActions';

const RISK_STYLE: Record<string, string> = {
  bajo: 'bg-white',
  medio: 'bg-yellow',
  alto: 'bg-black text-white',
  'sin-dato': 'bg-white border-dashed',
};

interface Props {
  t: Tactica;
  readOnly: boolean;
  dragHandle?: { attributes: DraggableAttributes; listeners: DraggableSyntheticListeners; setActivatorNodeRef: (el: HTMLElement | null) => void };
  dragging?: boolean;
}

export const TacticaCard = memo(function TacticaCard({ t, readOnly, dragHandle, dragging }: Props) {
  const { edit, duplicate, remove, move } = useTacticaActions();
  const validos = pasosValidos(t).length;
  const roi = t.pasos[8].roiProyectado;
  const hasInv = t.pasos[6].inversionEstimada > 0;
  const real = roiReal(t);
  const lvl = riskLevel(t);

  return (
    <article
      className={`card p-3 flex flex-col gap-2 ${dragging ? 'shadow-brutal bg-yellow' : ''}`}
      aria-label={`${t.nombre}, ${ESTADO_LABEL[t.estado]}`}
    >
      <div className="flex items-start gap-2">
        {dragHandle && !readOnly && (
          <button
            ref={dragHandle.setActivatorNodeRef}
            {...dragHandle.attributes}
            {...dragHandle.listeners}
            className="hidden md:inline-flex btn btn-icon !min-h-[32px] !min-w-[32px] !p-1 cursor-grab touch-none"
            aria-label={`Mover «${t.nombre}». Pulsa Espacio para tomar, flechas para mover entre columnas, Enter para soltar, Escape para cancelar.`}
          >
            <GripVertical size={16} aria-hidden />
          </button>
        )}
        <button className="flex-1 text-left font-display text-lg leading-tight hover:underline" onClick={() => edit(t.id)}>
          {t.nombre}
        </button>
      </div>

      <div className="flex flex-wrap gap-1">
        {t.canal && <span className="chip">{t.canal}</span>}
        <span className={`chip ${RISK_STYLE[lvl]}`} title="Probabilidad × impacto">
          Riesgo {lvl === 'sin-dato' ? '—' : `${riskScore(t)}/25`}
        </span>
        {t.fechaInicio && <span className="chip">Inicio {t.fechaInicio}</span>}
      </div>

      <dl className="grid grid-cols-3 gap-1 text-xs [&>div]:min-w-0 [&_dd]:break-words">
        <div><dt className="font-bold">Inversión</dt><dd>{hasInv ? fmtMoneyShort(t.pasos[6].inversionEstimada) : '—'}</dd></div>
        <div>
          <dt className="font-bold">ROI proy.</dt>
          <dd className={hasInv && roi < 0 ? 'text-red font-bold' : ''}>{hasInv && t.pasos[8].horizonteMeses ? fmtPct(roi) : '—'}</dd>
        </div>
        <div><dt className="font-bold">ROI real</dt><dd>{real === null ? '—' : fmtPct(real)}</dd></div>
      </dl>

      <div>
        <div className="flex justify-between text-xs font-bold"><span>Pasos validados</span><span>{validos}/8</span></div>
        <div className="mt-1 h-2 border-2 border-black" role="progressbar" aria-valuemin={0} aria-valuemax={8} aria-valuenow={validos} aria-label="Pasos validados">
          <div className="h-full bg-black" style={{ width: `${(validos / 8) * 100}%` }} />
        </div>
      </div>

      {!readOnly && (
        <div className="flex flex-wrap items-center gap-1 pt-1">
          <button className="btn btn-icon !min-h-[36px]" onClick={() => edit(t.id)} aria-label={`Editar «${t.nombre}»`}><Pencil size={16} aria-hidden /></button>
          <button className="btn btn-icon !min-h-[36px]" onClick={() => duplicate(t.id)} aria-label={`Duplicar «${t.nombre}»`}><Copy size={16} aria-hidden /></button>
          <button className="btn btn-icon btn-danger !min-h-[36px]" onClick={() => remove(t)} aria-label={`Eliminar «${t.nombre}»`}><Trash2 size={16} aria-hidden /></button>
          {/* Degradación móvil del drag & drop: menú "Mover a…" */}
          <label className="md:hidden ml-auto">
            <span className="sr-only">Mover «{t.nombre}» a…</span>
            <select
              className="input !min-h-[36px] !py-1 text-sm font-bold"
              value=""
              onChange={(e) => e.target.value && move(t.id, e.target.value as Estado)}
            >
              <option value="">Mover a…</option>
              {ESTADOS.filter((e) => e !== t.estado).map((e) => (
                <option key={e} value={e}>{ESTADO_LABEL[e]}</option>
              ))}
            </select>
          </label>
        </div>
      )}
    </article>
  );
});
