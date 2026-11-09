import { useMemo } from 'react';
import { AlertTriangle, PanelRightClose, Sparkles, Activity } from 'lucide-react';
import { computeInsights } from '../lib/insights';
import { useTacticaStore } from '../store/useTacticaStore';
import { useUiStore } from '../store/useUiStore';

const ICON = { alerta: AlertTriangle, oportunidad: Sparkles, salud: Activity };

export function InsightsPanel() {
  const tacticas = useTacticaStore((s) => s.tacticas);
  const open = useUiStore((s) => s.insightsOpen);
  const set = useUiStore((s) => s.set);
  const edit = useUiStore((s) => s.openEditor);
  const insights = useMemo(() => computeInsights(tacticas), [tacticas]);
  const name = (id: string) => tacticas.find((t) => t.id === id)?.nombre ?? '';
  if (!open) return null;
  return (
    <aside id="diagnostico" aria-labelledby="diag-h" className="card p-3 flex flex-col gap-3 xl:sticky xl:top-4 self-start w-full">
      <div className="flex items-center justify-between gap-2">
        <h2 id="diag-h" className="text-xl">Diagnóstico ejecutivo</h2>
        <button className="btn btn-icon" onClick={() => set({ insightsOpen: false })} aria-label="Colapsar diagnóstico" aria-expanded="true" aria-controls="diagnostico"><PanelRightClose size={18} aria-hidden /></button>
      </div>
      <p className="text-xs font-bold">Reglas deterministas · se actualiza en vivo · ordenado por impacto</p>
      {insights.length === 0 ? (
        <p className="border-2 border-dashed border-black p-3 text-sm font-bold">Crea o carga tácticas para ver hallazgos.</p>
      ) : (
        <ol className="flex flex-col gap-2" aria-live="polite">
          {insights.map((ins, i) => {
            const Icon = ICON[ins.tipo];
            return (
              <li key={ins.id} className={`border-2 border-black p-3 ${i === 0 ? 'bg-yellow' : ''}`}>
                <div className="flex items-start gap-2">
                  <span className="font-display text-lg w-6 shrink-0">{i + 1}</span>
                  <div className="flex-1 min-w-0">
                    <h3 className="font-display text-base leading-tight flex items-center gap-1"><Icon size={16} aria-hidden /> {ins.titulo}</h3>
                    <p className="text-sm mt-1"><span className="font-bold">Evidencia:</span> {ins.evidencia}</p>
                    <p className="text-sm mt-1 font-bold">→ {ins.accion}</p>
                    {ins.tacticaIds.length > 0 && (
                      <div className="flex flex-wrap gap-1 mt-2">
                        {ins.tacticaIds.slice(0, 4).map((id) => (
                          <button key={id} className="chip bg-white text-blue underline max-w-full truncate" onClick={() => edit(id)}>{name(id)}</button>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </li>
            );
          })}
        </ol>
      )}
    </aside>
  );
}
