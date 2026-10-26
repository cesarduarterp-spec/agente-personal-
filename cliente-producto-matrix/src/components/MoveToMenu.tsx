import { useId } from 'react';

/** Alternativa al drag & drop en móvil: selector "Mover a…". */
export function MoveToMenu({ index, total, label, onMove, disabled }: { index: number; total: number; label: string; onMove: (to: number) => void; disabled?: boolean }) {
  const id = useId();
  return (
    <div className="flex items-center gap-1">
      <label htmlFor={id} className="sr-only">
        Mover {label} a la posición…
      </label>
      <select
        id={id}
        className="field min-h-[36px] w-auto py-1 pr-6 text-xs font-bold"
        value=""
        disabled={disabled || total < 2}
        onChange={(e) => {
          if (e.target.value !== '') onMove(Number(e.target.value));
        }}
      >
        <option value="">Mover a…</option>
        {Array.from({ length: total }, (_, i) => i)
          .filter((i) => i !== index)
          .map((i) => (
            <option key={i} value={i}>
              Posición {i + 1}
              {i === 0 ? ' (primera)' : i === total - 1 ? ' (última)' : ''}
            </option>
          ))}
      </select>
    </div>
  );
}
