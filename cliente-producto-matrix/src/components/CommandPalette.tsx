import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import {
  Download,
  FileJson,
  FileSpreadsheet,
  FileText,
  Flame,
  Grid3x3,
  Image as ImageIcon,
  Lightbulb,
  Link2,
  Package,
  Plus,
  RotateCcw,
  Search,
  Settings,
  Sparkles,
  Target,
  Upload,
  User,
  UserPlus,
} from 'lucide-react';
import { useAppStore } from '../store/useAppStore';
import { useFocusTrap } from '../hooks/useFocusTrap';
import { appActions } from '../lib/actions';
import { startTour } from './Tour';

interface Cmd {
  id: string;
  group: 'Crear' | 'Ir a' | 'Buscar' | 'Exportar' | 'Datos';
  label: string;
  hint?: string;
  icon: ReactNode;
  run: () => void;
  disabled?: boolean;
}

const norm = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

export function CommandPalette() {
  const open = useAppStore((s) => s.paletteOpen);
  if (!open) return null;
  return <PaletteInner />;
}

function PaletteInner() {
  const data = useAppStore((s) => s.data);
  const readOnly = useAppStore((s) => s.readOnly);
  const heatmap = useAppStore((s) => s.heatmap);
  const st = useAppStore.getState();
  const [q, setQ] = useState('');
  const [active, setActive] = useState(0);
  const ref = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLUListElement>(null);
  const close = () => st.setPaletteOpen(false);
  useFocusTrap(ref, true, close, inputRef);

  const commands = useMemo<Cmd[]>(() => {
    const base: Cmd[] = [
      { id: 'new-avatar', group: 'Crear', label: 'Nuevo avatar', icon: <UserPlus size={16} />, run: () => st.openModal({ type: 'avatar' }), disabled: readOnly },
      { id: 'new-producto', group: 'Crear', label: 'Nuevo producto', icon: <Plus size={16} />, run: () => st.openModal({ type: 'producto' }), disabled: readOnly },
      { id: 'go-matriz', group: 'Ir a', label: 'Vista Matriz', icon: <Grid3x3 size={16} />, run: () => st.setView('matriz') },
      { id: 'go-ops', group: 'Ir a', label: 'Vista Oportunidades', icon: <Target size={16} />, run: () => st.setView('oportunidades') },
      { id: 'go-diag', group: 'Ir a', label: 'Diagnóstico ejecutivo', icon: <Lightbulb size={16} />, run: () => st.setPanelOpen(true) },
      { id: 'heat', group: 'Ir a', label: heatmap ? 'Desactivar heatmap' : 'Activar heatmap', icon: <Flame size={16} />, run: () => st.setHeatmap(!heatmap) },
      { id: 'settings', group: 'Ir a', label: 'Ajustes', icon: <Settings size={16} />, run: () => st.openModal({ type: 'settings' }) },
      { id: 'tour', group: 'Ir a', label: 'Reactivar tour de onboarding', icon: <Sparkles size={16} />, run: () => setTimeout(startTour, 50) },
      { id: 'png', group: 'Exportar', label: 'Exportar PNG', icon: <ImageIcon size={16} />, run: () => void appActions.png() },
      { id: 'pdf', group: 'Exportar', label: 'Exportar PDF ejecutivo', icon: <FileText size={16} />, run: () => void appActions.pdf() },
      { id: 'csv', group: 'Exportar', label: 'Exportar CSV', icon: <FileSpreadsheet size={16} />, run: appActions.csv },
      { id: 'json', group: 'Exportar', label: 'Exportar JSON', icon: <FileJson size={16} />, run: appActions.json },
      { id: 'share', group: 'Exportar', label: 'Copiar enlace compartido', icon: <Link2 size={16} />, run: () => void appActions.share() },
      { id: 'import', group: 'Datos', label: 'Importar JSON', icon: <Upload size={16} />, run: () => st.openModal({ type: 'import' }), disabled: readOnly },
      { id: 'sample', group: 'Datos', label: 'Cargar datos de ejemplo', icon: <Download size={16} />, run: appActions.sample, disabled: readOnly },
      { id: 'reset', group: 'Datos', label: 'Resetear matriz…', icon: <RotateCcw size={16} />, run: () => st.openModal({ type: 'reset' }), disabled: readOnly },
    ];
    const search: Cmd[] = [
      ...data.avatares.map<Cmd>((a) => ({
        id: `a-${a.id}`,
        group: 'Buscar',
        label: a.nombre,
        hint: 'Avatar · filtrar matriz',
        icon: <User size={16} />,
        run: () => {
          st.setView('matriz');
          st.setFiltros({ query: a.nombre });
        },
      })),
      ...data.productos.map<Cmd>((p) => ({
        id: `p-${p.id}`,
        group: 'Buscar',
        label: p.nombre,
        hint: 'Producto · filtrar matriz',
        icon: <Package size={16} />,
        run: () => {
          st.setView('matriz');
          st.setFiltros({ query: p.nombre });
        },
      })),
    ];
    return [...base, ...search];
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data, readOnly, heatmap]);

  const results = useMemo<Cmd[]>(() => {
    const nq = norm(q.trim());
    const list = commands.filter((c) => !c.disabled && (!nq || norm(`${c.group} ${c.label}`).includes(nq)));
    // Sin consulta, la búsqueda de entidades se omite para no saturar.
    const filtered = nq ? list : list.filter((c) => c.group !== 'Buscar');
    if (nq && !filtered.length) {
      return [
        {
          id: 'free-search',
          group: 'Buscar' as const,
          label: `Buscar «${q.trim()}» en la matriz`,
          icon: <Search size={16} />,
          run: () => st.setFiltros({ query: q.trim() }),
        },
      ];
    }
    return filtered;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [commands, q]);

  useEffect(() => setActive(0), [q]);
  useEffect(() => {
    listRef.current?.querySelector(`[data-idx="${active}"]`)?.scrollIntoView({ block: 'nearest' });
  }, [active]);

  const exec = (c: Cmd | undefined) => {
    if (!c) return;
    close();
    c.run();
  };

  const activeId = results[active] ? `cmd-${results[active]!.id}` : undefined;
  let lastGroup = '';

  return createPortal(
    <div className="fixed inset-0 z-[55] flex items-start justify-center p-4 pt-[12vh]">
      <div className="absolute inset-0 bg-black/60" aria-hidden="true" onClick={close} />
      <div ref={ref} role="dialog" aria-modal="true" aria-label="Comando rápido" className="relative w-full max-w-xl border-2 border-black bg-white shadow-brutal">
        <div className="flex items-center gap-2 border-b-2 border-black px-3">
          <Search size={18} aria-hidden />
          <input
            ref={inputRef}
            role="combobox"
            aria-expanded
            aria-controls="cmd-list"
            aria-activedescendant={activeId}
            aria-autocomplete="list"
            aria-label="Escribe un comando o busca un avatar o producto"
            className="min-h-[52px] flex-1 bg-white text-base font-bold outline-none"
            placeholder="Crear, buscar, saltar a vista, resetear…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'ArrowDown') {
                e.preventDefault();
                setActive((a) => Math.min(results.length - 1, a + 1));
              } else if (e.key === 'ArrowUp') {
                e.preventDefault();
                setActive((a) => Math.max(0, a - 1));
              } else if (e.key === 'Enter') {
                e.preventDefault();
                exec(results[active]);
              }
            }}
          />
          <span className="kbd">Esc</span>
        </div>
        <ul id="cmd-list" ref={listRef} role="listbox" aria-label="Resultados" className="max-h-[50vh] overflow-y-auto py-1">
          {results.map((c, i) => {
            const header = c.group !== lastGroup ? c.group : null;
            lastGroup = c.group;
            return (
              <li key={c.id} role="none">
                {header && (
                  <p className="px-3 pb-1 pt-2 text-[11px] font-bold uppercase" aria-hidden>
                    {header}
                  </p>
                )}
                <div
                  id={`cmd-${c.id}`}
                  role="option"
                  aria-selected={i === active}
                  data-idx={i}
                  onMouseMove={() => setActive(i)}
                  onClick={() => exec(c)}
                  className={`mx-1 flex cursor-pointer items-center gap-3 px-2 py-2 text-sm font-bold ${i === active ? 'bg-yellow outline outline-2 outline-black' : ''}`}
                >
                  <span aria-hidden>{c.icon}</span>
                  <span className="flex-1">{c.label}</span>
                  {c.hint && <span className="text-[11px]">{c.hint}</span>}
                </div>
              </li>
            );
          })}
        </ul>
        <p className="border-t-2 border-black px-3 py-2 text-[11px] font-bold">
          <span className="kbd">↑</span> <span className="kbd">↓</span> navegar · <span className="kbd">Enter</span> ejecutar · <span className="kbd">Esc</span> cerrar
        </p>
      </div>
    </div>,
    document.body,
  );
}
