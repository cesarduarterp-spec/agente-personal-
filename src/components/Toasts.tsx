import { X } from 'lucide-react';
import { useUiStore } from '../store/useUiStore';

export function Toasts() {
  const toasts = useUiStore((s) => s.toasts);
  const dismiss = useUiStore((s) => s.dismissToast);
  return (
    <div role="status" aria-live="polite" className="fixed z-[60] bottom-20 md:bottom-4 left-4 right-4 md:left-auto md:w-96 flex flex-col gap-2 pointer-events-none">
      {toasts.map((t) => (
        <div key={t.id} className={`card shadow-brutal pointer-events-auto flex items-start gap-2 px-3 py-2 ${t.tone === 'error' ? 'border-red' : ''}`}>
          <span className={`mt-1 h-3 w-3 shrink-0 border-2 border-black ${t.tone === 'error' ? 'bg-red' : 'bg-yellow'}`} aria-hidden />
          <p className="flex-1 text-sm font-bold">{t.text}</p>
          <button className="p-1" onClick={() => dismiss(t.id)} aria-label="Descartar aviso"><X size={14} aria-hidden /></button>
        </div>
      ))}
    </div>
  );
}
