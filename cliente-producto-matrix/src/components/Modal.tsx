import { useId, useRef, type ReactNode, type RefObject } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';
import { useFocusTrap } from '../hooks/useFocusTrap';

interface Props {
  title: string;
  onClose: () => void;
  children: ReactNode;
  footer?: ReactNode;
  role?: 'dialog' | 'alertdialog';
  initialFocus?: RefObject<HTMLElement>;
  size?: 'sm' | 'md' | 'lg';
  describedBy?: string;
}

export function Modal({ title, onClose, children, footer, role = 'dialog', initialFocus, size = 'md', describedBy }: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const titleId = useId();
  useFocusTrap(ref, true, onClose, initialFocus);
  const w = size === 'sm' ? 'max-w-md' : size === 'lg' ? 'max-w-2xl' : 'max-w-lg';
  return createPortal(
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center sm:p-4">
      <div className="absolute inset-0 bg-black/60" aria-hidden="true" onClick={onClose} />
      <div
        ref={ref}
        role={role}
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={describedBy}
        tabIndex={-1}
        className={`relative w-full ${w} max-h-[90vh] overflow-y-auto border-2 border-black bg-white shadow-brutal`}
      >
        <div className="flex items-start justify-between gap-4 border-b-2 border-black bg-yellow px-4 py-3">
          <h2 id={titleId} className="text-xl leading-tight">
            {title}
          </h2>
          <button type="button" className="btn btn-icon btn-ghost -my-1 -mr-2 min-h-[36px]" onClick={onClose} aria-label="Cerrar">
            <X size={18} aria-hidden />
          </button>
        </div>
        <div className="px-4 py-4">{children}</div>
        {footer && <div className="flex flex-wrap justify-end gap-2 border-t-2 border-black px-4 py-3">{footer}</div>}
      </div>
    </div>,
    document.body,
  );
}
