import { useEffect, useState } from 'react';
import { useUiStore } from '../store/useUiStore';
import { useTacticaStore } from '../store/useTacticaStore';

function ago(ms: number) {
  const s = Math.max(0, Math.round(ms / 1000));
  if (s < 60) return `${s}s`;
  const m = Math.round(s / 60);
  return m < 60 ? `${m} min` : `${Math.round(m / 60)} h`;
}

export function SaveIndicator() {
  const at = useUiStore((s) => s.lastSavedAt);
  const readOnly = useTacticaStore((s) => s.readOnly);
  const [, tick] = useState(0);
  useEffect(() => {
    const i = setInterval(() => tick((x) => x + 1), 1000);
    return () => clearInterval(i);
  }, []);
  if (readOnly) return <span className="chip bg-yellow">Solo lectura</span>;
  return (
    <span className="text-xs font-bold whitespace-nowrap" aria-live="off" title="Auto-guardado en este navegador">
      {at ? `Guardado hace ${ago(Date.now() - at)}` : 'Sin cambios'}
    </span>
  );
}
