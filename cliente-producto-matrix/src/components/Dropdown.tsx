import { useEffect, useId, useRef, useState, type ReactNode } from 'react';

interface Item {
  label: string;
  icon?: ReactNode;
  onSelect: () => void;
  disabled?: boolean;
  danger?: boolean;
}

/** Menú desplegable accesible: flechas para moverse, Escape para cerrar. */
export function Dropdown({ label, icon, items, align = 'right', tourId }: { label: string; icon?: ReactNode; items: Item[]; align?: 'left' | 'right'; tourId?: string }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const btnRef = useRef<HTMLButtonElement>(null);
  const menuId = useId();

  useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('pointerdown', onDown);
    ref.current?.querySelector<HTMLElement>('[role="menuitem"]:not([disabled])')?.focus();
    return () => document.removeEventListener('pointerdown', onDown);
  }, [open]);

  const onKey = (e: React.KeyboardEvent) => {
    const els = [...(ref.current?.querySelectorAll<HTMLElement>('[role="menuitem"]:not([disabled])') ?? [])];
    const i = els.indexOf(document.activeElement as HTMLElement);
    if (e.key === 'Escape') {
      e.stopPropagation();
      setOpen(false);
      btnRef.current?.focus();
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      els[(i + 1) % els.length]?.focus();
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      els[(i - 1 + els.length) % els.length]?.focus();
    } else if (e.key === 'Tab') setOpen(false);
  };

  return (
    <div ref={ref} className="relative" onKeyDown={onKey}>
      <button
        ref={btnRef}
        type="button"
        className="btn"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={open ? menuId : undefined}
        onClick={() => setOpen((o) => !o)}
        data-tour={tourId}
      >
        {icon}
        {label}
      </button>
      {open && (
        <div id={menuId} role="menu" aria-label={label} className={`absolute top-full z-40 mt-1 min-w-[220px] border-2 border-black bg-white shadow-brutal ${align === 'right' ? 'right-0' : 'left-0'}`}>
          {items.map((it) => (
            <button
              key={it.label}
              type="button"
              role="menuitem"
              disabled={it.disabled}
              className={`flex w-full items-center gap-2 border-b-2 border-black px-3 py-2.5 text-left text-sm font-bold last:border-b-0 hover:bg-yellow focus:bg-yellow disabled:opacity-40 ${it.danger ? 'text-black' : ''}`}
              onClick={() => {
                setOpen(false);
                btnRef.current?.focus();
                it.onSelect();
              }}
            >
              {it.icon}
              {it.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
