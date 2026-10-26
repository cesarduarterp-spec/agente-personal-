import { AlertTriangle, ChevronRight, Lightbulb, PanelRightClose, Sparkles } from 'lucide-react';
import { useAppStore } from '../store/useAppStore';
import { useInsights } from '../store/selectors';
import type { Insight } from '../lib/insights';

const sevStyle: Record<Insight['severidad'], string> = {
  alta: 'bg-black text-yellow',
  media: 'bg-yellow text-black',
  baja: 'bg-white text-black',
};

export function InsightsList() {
  const insights = useInsights();
  const { loadSample } = useAppStore.getState();
  const readOnly = useAppStore((s) => s.readOnly);
  if (!insights.length) {
    return (
      <div className="p-4 text-sm">
        <p className="mb-3">El diagnóstico aparece cuando hay al menos un avatar y un producto.</p>
        <button type="button" className="btn btn-primary w-full" onClick={loadSample} disabled={readOnly}>
          <Sparkles size={16} aria-hidden /> Cargar datos de ejemplo
        </button>
      </div>
    );
  }
  return (
    <ol className="divide-y-2 divide-black" aria-label="Hallazgos ordenados por impacto">
      {insights.map((i, n) => (
        <li key={i.id} className="p-3">
          <div className="mb-1 flex items-center gap-2">
            <span className="font-display text-sm">{n + 1}.</span>
            <span className={`tag ${sevStyle[i.severidad]}`}>Impacto {i.severidad}</span>
          </div>
          <h3 className="text-[15px] leading-snug">{i.titulo}</h3>
          <p className="mt-1 text-xs">
            <span className="font-bold uppercase">Evidencia: </span>
            {i.evidencia}
          </p>
          <p className="mt-2 flex gap-1 border-2 border-black bg-yellow px-2 py-1 text-xs font-bold">
            <ChevronRight size={14} className="mt-0.5 shrink-0" aria-hidden />
            <span>{i.accion}</span>
          </p>
        </li>
      ))}
    </ol>
  );
}

/** Panel lateral colapsable "Diagnóstico ejecutivo". */
export function InsightsPanel() {
  const open = useAppStore((s) => s.panelOpen);
  const setPanelOpen = useAppStore((s) => s.setPanelOpen);
  const count = useInsights().length;
  if (!open) {
    return (
      <button
        type="button"
        className="btn fixed bottom-4 right-4 z-20 hidden bg-yellow shadow-brutal md:inline-flex"
        onClick={() => setPanelOpen(true)}
        aria-expanded={false}
        aria-controls="insights-panel"
        data-tour="insights"
      >
        <Lightbulb size={16} aria-hidden /> Diagnóstico ({count})
      </button>
    );
  }
  return (
    <aside
      id="insights-panel"
      aria-labelledby="insights-title"
      className="border-2 border-black bg-white md:sticky md:top-4 md:max-h-[calc(100vh-2rem)] md:w-[340px] md:shrink-0 md:overflow-y-auto"
      data-tour="insights"
    >
      <div className="flex items-center justify-between gap-2 border-b-2 border-black bg-black px-3 py-2 text-yellow on-dark">
        <h2 id="insights-title" className="flex items-center gap-2 text-lg">
          <AlertTriangle size={18} aria-hidden /> Diagnóstico ejecutivo
        </h2>
        <button
          type="button"
          className="flex h-9 w-9 items-center justify-center border-2 border-yellow"
          onClick={() => setPanelOpen(false)}
          aria-label="Contraer diagnóstico"
          aria-expanded
          aria-controls="insights-panel"
        >
          <PanelRightClose size={16} aria-hidden />
        </button>
      </div>
      <InsightsList />
      <p className="border-t-2 border-black px-3 py-2 text-[11px]">Reglas deterministas · se recalcula en cada cambio.</p>
    </aside>
  );
}
