import { useEffect, useState } from 'react';
import { Check, Eye } from 'lucide-react';
import { useAppStore } from '../store/useAppStore';

function rel(ms: number): string {
  const s = Math.max(0, Math.round(ms / 1000));
  if (s < 60) return `${s}s`;
  const m = Math.round(s / 60);
  if (m < 60) return `${m} min`;
  return `${Math.round(m / 60)} h`;
}

/**
 * "Guardado hace Xs". El texto relativo se actualiza visualmente cada segundo,
 * pero sólo se anuncia al lector de pantalla cuando ocurre un guardado.
 */
export function SaveIndicator() {
  const lastSavedAt = useAppStore((s) => s.lastSavedAt);
  const readOnly = useAppStore((s) => s.readOnly);
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);
  if (readOnly) {
    return (
      <span className="tag gap-1 bg-black py-1 text-yellow">
        <Eye size={12} aria-hidden /> Solo lectura
      </span>
    );
  }
  return (
    <>
      <span className="tag gap-1 py-1" aria-hidden="true">
        <Check size={12} aria-hidden /> {lastSavedAt ? `Guardado hace ${rel(now - lastSavedAt)}` : 'Sin cambios'}
      </span>
      <span className="sr-only" role="status" aria-live="polite">
        {lastSavedAt ? 'Cambios guardados' : ''}
      </span>
    </>
  );
}
