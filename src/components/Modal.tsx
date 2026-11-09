import { useEffect, useId, useRef, type ReactNode } from 'react';
import { X } from 'lucide-react';

interface Props {
  open: boolean;
  title: string;
  onClose: () => void;
  children: ReactNode;
  role?: 'dialog' | 'alertdialog';
  size?: 'sm' | 'md' | 'lg' | 'full';
  footer?: ReactNode;
  initialFocus?: string; // selector
}

const SIZES = { sm: 'max-w-md', md: 'max-w-xl', lg: 'max-w-3xl', full: 'max-w-5xl' };

/** Modal accesible: foco atrapado, Escape cierra, devuelve el foco al disparador. */
export function Modal({ open, title, onClose, children, role = 'dialog', size = 'md', footer, initialFocus }: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const titleId = useId();
  const closeRef = useRef(onClose);
  closeRef.current = onClose;

  useEffect(() => {
    if (!open) return;
    const prev = document.activeElement as HTMLElement | null;
    const node = ref.current;
    const focusables = () =>
      Array.from(
        node?.querySelectorAll<HTMLElement>(
          'a[href],button:not([disabled]),input:not([disabled]),select:not([disabled]),textarea:not([disabled]),[tabindex]:not([tabindex="-1"])',
        ) ?? [],
      );
    const first = (initialFocus && node?.querySelector<HTMLElement>(initialFocus)) || focusables()[0];
    first?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        closeRef.current();
      } else if (e.key === 'Tab') {
        const f = focusables();
        if (!f.length) return;
        const a = f[0]!, z = f[f.length - 1]!;
        if (e.shiftKey && document.activeElement === a) { e.preventDefault(); z.focus(); }
        else if (!e.shiftKey && document.activeElement === z) { e.preventDefault(); a.focus(); }
      }
    };
    node?.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => {
      node?.removeEventListener('keydown', onKey);
      document.body.style.overflow = '';
      prev?.focus?.();
    };
  }, [open, initialFocus]);

  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-end md:items-center justify-center bg-black/60 p-0 md:p-4" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div
        ref={ref}
        role={role}
        aria-modal="true"
        aria-labelledby={titleId}
        className={`card w-full ${SIZES[size]} max-h-[92vh] md:max-h-[90vh] flex flex-col shadow-brutal`}
      >
        <div className="flex items-center justify-between gap-2 border-b-2 border-black px-4 py-3">
          <h2 id={titleId} className="text-xl md:text-2xl">{title}</h2>
          <button className="btn btn-icon" onClick={onClose} aria-label="Cerrar">
            <X size={18} aria-hidden />
          </button>
        </div>
        <div className="overflow-y-auto px-4 py-4 flex-1">{children}</div>
        {footer && <div className="border-t-2 border-black px-4 py-3 flex flex-wrap gap-2 justify-end">{footer}</div>}
      </div>
    </div>
  );
}
