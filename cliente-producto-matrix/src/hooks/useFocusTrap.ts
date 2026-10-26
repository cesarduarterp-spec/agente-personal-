import { useEffect, type RefObject } from 'react';

const FOCUSABLE = 'a[href],button:not([disabled]),input:not([disabled]),select:not([disabled]),textarea:not([disabled]),[tabindex]:not([tabindex="-1"])';

/** Atrapa el foco dentro del contenedor, cierra con Escape y devuelve el foco al cerrar. */
export function useFocusTrap(ref: RefObject<HTMLElement>, active: boolean, onEscape?: () => void, initial?: RefObject<HTMLElement>) {
  useEffect(() => {
    if (!active) return;
    const prev = document.activeElement as HTMLElement | null;
    const node = ref.current;
    const first = initial?.current ?? node?.querySelector<HTMLElement>(FOCUSABLE);
    (first ?? node)?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (!node) return;
      if (e.key === 'Escape' && onEscape) {
        e.stopPropagation();
        onEscape();
        return;
      }
      if (e.key !== 'Tab') return;
      const items = [...node.querySelectorAll<HTMLElement>(FOCUSABLE)].filter((el) => el.offsetParent !== null || el === document.activeElement);
      if (!items.length) return;
      const f = items[0]!;
      const l = items[items.length - 1]!;
      if (e.shiftKey && document.activeElement === f) {
        e.preventDefault();
        l.focus();
      } else if (!e.shiftKey && document.activeElement === l) {
        e.preventDefault();
        f.focus();
      }
    };
    document.addEventListener('keydown', onKey, true);
    return () => {
      document.removeEventListener('keydown', onKey, true);
      if (prev && document.contains(prev)) prev.focus();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active]);
}
