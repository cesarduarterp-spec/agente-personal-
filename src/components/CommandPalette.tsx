import { useEffect, useMemo, useRef, useState } from 'react';
import { Search } from 'lucide-react';
import { useTacticaStore } from '../store/useTacticaStore';
import { useUiStore } from '../store/useUiStore';
import { useTacticaActions } from '../hooks/useTacticaActions';
import { useExportActions } from '../hooks/useExportActions';

interface Cmd { id: string; label: string; group: string; run: () => void; }

const norm = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

export function CommandPalette() {
  const open = useUiStore((s) => s.paletteOpen);
  const set = useUiStore((s) => s.set);
  const tacticas = useTacticaStore((s) => s.tacticas);
  const actions = useTacticaActions();
  const exp = useExportActions();
  const [q, setQ] = useState('');
  const [idx, setIdx] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const prevFocus = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (open) {
      prevFocus.current = document.activeElement as HTMLElement;
      setQ('');
      setIdx(0);
      setTimeout(() => inputRef.current?.focus(), 0);
    } else prevFocus.current?.focus?.();
  }, [open]);

  const cmds = useMemo<Cmd[]>(() => {
    const ui = useUiStore.getState();
    const base: Cmd[] = [
      { id: 'new', group: 'Crear', label: 'Nueva táctica', run: actions.create },
      { id: 'search', group: 'Buscar', label: 'Buscar tácticas…', run: () => setTimeout(() => document.getElementById('search')?.focus(), 0) },
      { id: 'v-board', group: 'Ir a', label: 'Vista: Tablero', run: () => ui.setView('tablero') },
      { id: 'v-port', group: 'Ir a', label: 'Vista: Portafolio de tácticas', run: () => ui.setView('portafolio') },
      { id: 'v-diag', group: 'Ir a', label: 'Abrir diagnóstico ejecutivo', run: () => ui.set({ insightsOpen: true }) },
      { id: 'settings', group: 'Ir a', label: 'Ajustes y sincronización', run: () => ui.set({ settingsOpen: true }) },
      { id: 'sample', group: 'Datos', label: 'Cargar datos de ejemplo', run: actions.loadSample },
      { id: 'pdf', group: 'Exportar', label: 'Exportar PDF ejecutivo', run: exp.pdf },
      { id: 'png', group: 'Exportar', label: 'Exportar PNG (2x)', run: exp.png },
      { id: 'csv', group: 'Exportar', label: 'Exportar CSV', run: exp.csv },
      { id: 'json', group: 'Exportar', label: 'Exportar JSON', run: exp.json },
      { id: 'share', group: 'Exportar', label: 'Copiar enlace compartido', run: exp.share },
      { id: 'reset', group: 'Datos', label: 'Resetear todo…', run: actions.reset },
    ];
    const ts: Cmd[] = tacticas.map((t) => ({ id: `t-${t.id}`, group: 'Tácticas', label: t.nombre, run: () => ui.openEditor(t.id) }));
    const all = [...base, ...ts];
    const nq = norm(q.trim());
    return nq ? all.filter((c) => nq.split(/\s+/).every((w) => norm(`${c.group} ${c.label}`).includes(w))) : all;
  }, [q, tacticas, actions, exp]);

  if (!open) return null;
  const close = () => set({ paletteOpen: false });
  const run = (c?: Cmd) => { if (!c) return; close(); c.run(); };

  return (
    <div className="fixed inset-0 z-50 bg-black/60 flex items-start justify-center p-4 pt-[10vh]" onMouseDown={(e) => e.target === e.currentTarget && close()}>
      <div role="dialog" aria-modal="true" aria-label="Comando rápido" className="card shadow-brutal w-full max-w-xl">
        <div className="flex items-center gap-2 border-b-2 border-black px-3">
          <Search size={18} aria-hidden />
          <input
            ref={inputRef}
            role="combobox"
            aria-expanded="true"
            aria-controls="cmd-list"
            aria-activedescendant={cmds[idx] ? `cmd-${cmds[idx]!.id}` : undefined}
            aria-label="Escribe un comando o el nombre de una táctica"
            placeholder="Crear, buscar, ir a, exportar, resetear…"
            className="w-full py-3 text-base outline-none bg-white"
            value={q}
            onChange={(e) => { setQ(e.target.value); setIdx(0); }}
            onKeyDown={(e) => {
              if (e.key === 'Escape') close();
              else if (e.key === 'ArrowDown') { e.preventDefault(); setIdx((i) => Math.min(cmds.length - 1, i + 1)); }
              else if (e.key === 'ArrowUp') { e.preventDefault(); setIdx((i) => Math.max(0, i - 1)); }
              else if (e.key === 'Enter') { e.preventDefault(); run(cmds[idx]); }
              else if (e.key === 'Tab') e.preventDefault();
            }}
          />
          <kbd className="chip">Esc</kbd>
        </div>
        <ul id="cmd-list" role="listbox" className="max-h-[50vh] overflow-y-auto">
          {cmds.length === 0 && <li className="p-3 font-bold">Sin resultados</li>}
          {cmds.map((c, i) => (
            <li key={c.id} id={`cmd-${c.id}`} role="option" aria-selected={i === idx}
              className={`flex justify-between gap-2 px-3 py-2 cursor-pointer border-b-2 border-black last:border-b-0 ${i === idx ? 'bg-yellow' : ''}`}
              onMouseEnter={() => setIdx(i)} onClick={() => run(c)}>
              <span className="font-bold truncate">{c.label}</span>
              <span className="text-xs font-bold shrink-0">{c.group}</span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
