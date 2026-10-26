import { useState } from 'react';
import {
  Command,
  Download,
  FileJson,
  FileSpreadsheet,
  FileText,
  Filter,
  Flame,
  Image as ImageIcon,
  Lightbulb,
  Link2,
  Menu,
  MoreHorizontal,
  Plus,
  Redo2,
  RotateCcw,
  Search,
  Settings,
  Sparkles,
  Undo2,
  Upload,
  UserPlus,
  X,
} from 'lucide-react';
import { useAppStore } from '../store/useAppStore';
import { useCanRedo, useCanUndo } from '../store/selectors';
import { appActions } from '../lib/actions';
import { Dropdown } from './Dropdown';
import { BottomSheet } from './BottomSheet';
import type { View } from '../types';

const isMac = typeof navigator !== 'undefined' && /Mac|iPhone|iPad/.test(navigator.platform);
export const MOD = isMac ? '⌘' : 'Ctrl';

export function ViewTabs() {
  const view = useAppStore((s) => s.view);
  const setView = useAppStore((s) => s.setView);
  const count = useAppStore((s) => s.data.avatares.length * s.data.productos.length - s.data.celdas.filter((c) => c.compra).length);
  const tabs: { id: View; label: string }[] = [
    { id: 'matriz', label: 'Matriz' },
    { id: 'oportunidades', label: `Oportunidades${count > 0 ? ` (${count})` : ''}` },
  ];
  return (
    <div role="tablist" aria-label="Vista" className="flex border-2 border-black" data-tour="views">
      {tabs.map((t) => (
        <button
          key={t.id}
          type="button"
          role="tab"
          id={`tab-${t.id}`}
          aria-selected={view === t.id}
          aria-controls="main-panel"
          tabIndex={view === t.id ? 0 : -1}
          onClick={() => setView(t.id)}
          onKeyDown={(e) => {
            if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') {
              const next = t.id === 'matriz' ? 'oportunidades' : 'matriz';
              setView(next);
              document.getElementById(`tab-${next}`)?.focus();
            }
          }}
          className={`min-h-[40px] flex-1 px-3 text-sm font-bold whitespace-nowrap ${view === t.id ? 'bg-black text-yellow' : 'bg-white hover:bg-yellow'}`}
        >
          {t.label}
        </button>
      ))}
    </div>
  );
}

export function SearchBox() {
  const query = useAppStore((s) => s.filtros.query);
  const setFiltros = useAppStore((s) => s.setFiltros);
  return (
    <div className="relative min-w-0 flex-1">
      <label htmlFor="search" className="sr-only">
        Buscar avatar o producto
      </label>
      <Search size={16} className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2" aria-hidden />
      <input
        id="search"
        type="search"
        className="field pl-8 pr-8"
        placeholder="Buscar avatar o producto…"
        value={query}
        onChange={(e) => setFiltros({ query: e.target.value })}
        autoComplete="off"
      />
      {query && (
        <button type="button" className="absolute right-1 top-1/2 flex h-8 w-8 -translate-y-1/2 items-center justify-center" aria-label="Limpiar búsqueda" onClick={() => setFiltros({ query: '' })}>
          <X size={14} aria-hidden />
        </button>
      )}
    </div>
  );
}

export function FiltersPanel() {
  const f = useAppStore((s) => s.filtros);
  const setFiltros = useAppStore((s) => s.setFiltros);
  const resetFiltros = useAppStore((s) => s.resetFiltros);
  return (
    <fieldset className="space-y-2">
      <legend className="label">Filtros combinables</legend>
      <label className="flex items-center gap-2 text-sm font-bold">
        <input type="checkbox" className="h-5 w-5 accent-black" checked={f.soloMono} onChange={(e) => setFiltros({ soloMono: e.target.checked })} />
        Solo avatares mono-producto
      </label>
      <label className="flex items-center gap-2 text-sm font-bold">
        <input type="checkbox" className="h-5 w-5 accent-black" checked={f.soloHuerfanos} onChange={(e) => setFiltros({ soloHuerfanos: e.target.checked })} />
        Solo productos huérfanos
      </label>
      <div>
        <label htmlFor="nps-min" className="text-sm font-bold">
          Avatares con algún match de NPS ≥
        </label>
        <select id="nps-min" className="field mt-1" value={f.npsMin ?? ''} onChange={(e) => setFiltros({ npsMin: e.target.value === '' ? null : Number(e.target.value) })}>
          <option value="">Cualquiera</option>
          {[10, 9, 8, 7, 6, 5].map((n) => (
            <option key={n} value={n}>
              {n}
            </option>
          ))}
        </select>
      </div>
      <button type="button" className="btn w-full" onClick={resetFiltros}>
        Limpiar filtros
      </button>
    </fieldset>
  );
}

function FiltersButton() {
  const [open, setOpen] = useState(false);
  const f = useAppStore((s) => s.filtros);
  const n = (f.soloMono ? 1 : 0) + (f.soloHuerfanos ? 1 : 0) + (f.npsMin !== null ? 1 : 0);
  return (
    <div className="relative">
      <button type="button" className={`btn ${n ? 'bg-yellow' : ''}`} aria-expanded={open} aria-controls="filters-pop" onClick={() => setOpen((o) => !o)}>
        <Filter size={16} aria-hidden /> Filtros{n ? ` (${n})` : ''}
      </button>
      {open && (
        <div
          id="filters-pop"
          className="absolute left-0 top-full z-40 mt-1 w-72 border-2 border-black bg-white p-3 shadow-brutal"
          onKeyDown={(e) => {
            if (e.key === 'Escape') {
              e.stopPropagation();
              setOpen(false);
            }
          }}
        >
          <FiltersPanel />
        </div>
      )}
    </div>
  );
}

function useMenus() {
  const readOnly = useAppStore((s) => s.readOnly);
  const { openModal } = useAppStore.getState();
  const exportItems = [
    { label: 'PNG (2x)', icon: <ImageIcon size={16} aria-hidden />, onSelect: () => void appActions.png() },
    { label: 'PDF ejecutivo', icon: <FileText size={16} aria-hidden />, onSelect: () => void appActions.pdf() },
    { label: 'CSV (datos brutos)', icon: <FileSpreadsheet size={16} aria-hidden />, onSelect: appActions.csv },
    { label: 'JSON re-importable', icon: <FileJson size={16} aria-hidden />, onSelect: appActions.json },
    { label: 'Copiar enlace compartido', icon: <Link2 size={16} aria-hidden />, onSelect: () => void appActions.share() },
  ];
  const moreItems = [
    { label: 'Importar JSON', icon: <Upload size={16} aria-hidden />, onSelect: () => openModal({ type: 'import' }), disabled: readOnly },
    { label: 'Cargar datos de ejemplo', icon: <Sparkles size={16} aria-hidden />, onSelect: appActions.sample, disabled: readOnly },
    { label: 'Ajustes', icon: <Settings size={16} aria-hidden />, onSelect: () => openModal({ type: 'settings' }) },
    { label: 'Reset…', icon: <RotateCcw size={16} aria-hidden />, onSelect: () => openModal({ type: 'reset' }), disabled: readOnly, danger: true },
  ];
  return { exportItems, moreItems };
}

export function Toolbar() {
  const heatmap = useAppStore((s) => s.heatmap);
  const panelOpen = useAppStore((s) => s.panelOpen);
  const readOnly = useAppStore((s) => s.readOnly);
  const { setHeatmap, setPanelOpen, openModal, setPaletteOpen } = useAppStore.getState();
  const canUndo = useCanUndo();
  const canRedo = useCanRedo();
  const { exportItems, moreItems } = useMenus();

  return (
    <div className="hidden flex-wrap items-center gap-2 md:flex" data-tour="toolbar">
      <ViewTabs />
      <div className="flex min-w-[220px] flex-1 gap-2">
        <SearchBox />
        <FiltersButton />
      </div>
      <button type="button" className={`btn ${heatmap ? 'bg-yellow' : ''}`} aria-pressed={heatmap} onClick={() => setHeatmap(!heatmap)}>
        <Flame size={16} aria-hidden /> Heatmap
      </button>
      <div className="flex">
        <button type="button" className="btn btn-icon" onClick={appActions.undo} disabled={!canUndo} aria-label={`Deshacer (${MOD}+Z)`} title={`Deshacer (${MOD}+Z)`}>
          <Undo2 size={16} aria-hidden />
        </button>
        <button type="button" className="btn btn-icon -ml-[2px]" onClick={appActions.redo} disabled={!canRedo} aria-label={`Rehacer (${MOD}+Shift+Z)`} title={`Rehacer (${MOD}+Shift+Z)`}>
          <Redo2 size={16} aria-hidden />
        </button>
      </div>
      <button type="button" className="btn" onClick={() => openModal({ type: 'avatar' })} disabled={readOnly}>
        <UserPlus size={16} aria-hidden /> Avatar
      </button>
      <button type="button" className="btn" onClick={() => openModal({ type: 'producto' })} disabled={readOnly}>
        <Plus size={16} aria-hidden /> Producto
      </button>
      <Dropdown label="Exportar" icon={<Download size={16} aria-hidden />} items={exportItems} tourId="export" />
      <Dropdown label="Más" icon={<MoreHorizontal size={16} aria-hidden />} items={moreItems} />
      <button type="button" className={`btn ${panelOpen ? 'bg-black text-yellow' : ''}`} aria-pressed={panelOpen} aria-controls="insights-panel" onClick={() => setPanelOpen(!panelOpen)}>
        <Lightbulb size={16} aria-hidden /> Diagnóstico
      </button>
      <button type="button" className="btn btn-primary" onClick={() => setPaletteOpen(true)} aria-label={`Comando rápido (${MOD}+K)`}>
        <Command size={16} aria-hidden /> {MOD}+K
      </button>
    </div>
  );
}

/** < 768 px: la toolbar colapsa en un Sheet inferior. */
export function MobileBar() {
  const [open, setOpen] = useState(false);
  const readOnly = useAppStore((s) => s.readOnly);
  const heatmap = useAppStore((s) => s.heatmap);
  const { setHeatmap, openModal, setPaletteOpen, setPanelOpen } = useAppStore.getState();
  const canUndo = useCanUndo();
  const canRedo = useCanRedo();
  const { exportItems, moreItems } = useMenus();
  const run = (fn: () => void) => () => {
    setOpen(false);
    fn();
  };
  const groups: { title: string; items: { label: string; icon?: React.ReactNode; onSelect: () => void; disabled?: boolean }[] }[] = [
    {
      title: 'Crear',
      items: [
        { label: 'Nuevo avatar', icon: <UserPlus size={16} aria-hidden />, onSelect: () => openModal({ type: 'avatar' }), disabled: readOnly },
        { label: 'Nuevo producto', icon: <Plus size={16} aria-hidden />, onSelect: () => openModal({ type: 'producto' }), disabled: readOnly },
      ],
    },
    {
      title: 'Ver',
      items: [
        { label: heatmap ? 'Ocultar heatmap' : 'Mostrar heatmap', icon: <Flame size={16} aria-hidden />, onSelect: () => setHeatmap(!heatmap) },
        {
          label: 'Ir al diagnóstico',
          icon: <Lightbulb size={16} aria-hidden />,
          onSelect: () => {
            setPanelOpen(true);
            setTimeout(() => document.getElementById('insights-panel')?.scrollIntoView({ behavior: 'smooth' }), 50);
          },
        },
        { label: 'Comando rápido', icon: <Command size={16} aria-hidden />, onSelect: () => setPaletteOpen(true) },
      ],
    },
    { title: 'Exportar', items: exportItems },
    { title: 'Más', items: moreItems },
  ];
  return (
    <>
      <nav aria-label="Acciones" className="fixed inset-x-0 bottom-0 z-30 flex border-t-2 border-black bg-white md:hidden">
        <button type="button" className="flex min-h-[56px] flex-1 items-center justify-center gap-2 border-r-2 border-black font-bold disabled:opacity-40" onClick={appActions.undo} disabled={!canUndo} aria-label="Deshacer">
          <Undo2 size={18} aria-hidden />
        </button>
        <button type="button" className="flex min-h-[56px] flex-1 items-center justify-center gap-2 border-r-2 border-black font-bold disabled:opacity-40" onClick={appActions.redo} disabled={!canRedo} aria-label="Rehacer">
          <Redo2 size={18} aria-hidden />
        </button>
        <button type="button" className="flex min-h-[56px] flex-[2] items-center justify-center gap-2 bg-black font-bold text-yellow" onClick={() => setOpen(true)} aria-haspopup="dialog" aria-expanded={open}>
          <Menu size={18} aria-hidden /> Acciones
        </button>
      </nav>
      {open && (
        <BottomSheet title="Acciones" onClose={() => setOpen(false)}>
          <div className="mb-4">
            <FiltersPanel />
          </div>
          {groups.map((g) => (
            <div key={g.title} className="mb-4">
              <p className="label">{g.title}</p>
              <div className="grid grid-cols-1 gap-2">
                {g.items.map((it) => (
                  <button key={it.label} type="button" className="btn justify-start" disabled={it.disabled} onClick={run(it.onSelect)}>
                    {it.icon}
                    {it.label}
                  </button>
                ))}
              </div>
            </div>
          ))}
        </BottomSheet>
      )}
    </>
  );
}
