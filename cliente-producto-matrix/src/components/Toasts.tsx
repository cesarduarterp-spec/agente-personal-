import { X } from 'lucide-react';
import { useAppStore } from '../store/useAppStore';

export function Toasts() {
  const toasts = useAppStore((s) => s.toasts);
  const dismiss = useAppStore((s) => s.dismissToast);
  return (
    <div
      role="status"
      aria-live="polite"
      aria-atomic="false"
      className="pointer-events-none fixed inset-x-0 bottom-20 z-[60] flex flex-col items-center gap-2 px-4 md:bottom-6 md:left-auto md:right-6 md:items-end"
    >
      {toasts.map((t) => (
        <div
          key={t.id}
          className={`pointer-events-auto flex max-w-sm items-start gap-3 border-2 border-black px-3 py-2 text-sm font-bold shadow-brutal ${
            t.tone === 'error' ? 'bg-black text-yellow on-dark' : t.tone === 'success' ? 'bg-yellow text-black' : 'bg-white text-black'
          }`}
        >
          <span className="flex-1">{t.message}</span>
          <button type="button" onClick={() => dismiss(t.id)} aria-label="Cerrar aviso" className="-mr-1 shrink-0">
            <X size={14} aria-hidden />
          </button>
        </div>
      ))}
    </div>
  );
}
