import { useId, useRef, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';
import { useFocusTrap } from '../hooks/useFocusTrap';

export function BottomSheet({ title, onClose, children }: { title: string; onClose: () => void; children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  const id = useId();
  useFocusTrap(ref, true, onClose);
  return createPortal(
    <div className="fixed inset-0 z-50">
      <div className="absolute inset-0 bg-black/60" aria-hidden="true" onClick={onClose} />
      <div ref={ref} role="dialog" aria-modal="true" aria-labelledby={id} className="absolute inset-x-0 bottom-0 max-h-[85vh] overflow-y-auto border-t-2 border-black bg-white">
        <div className="sticky top-0 flex items-center justify-between border-b-2 border-black bg-yellow px-4 py-3">
          <h2 id={id} className="text-xl">
            {title}
          </h2>
          <button type="button" className="btn btn-icon btn-ghost" onClick={onClose} aria-label="Cerrar">
            <X size={18} aria-hidden />
          </button>
        </div>
        <div className="p-4 pb-8">{children}</div>
      </div>
    </div>,
    document.body,
  );
}
