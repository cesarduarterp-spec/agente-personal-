import { useEffect, useMemo, useState } from 'react';
import {
  Command, Database, FileJson, FileSpreadsheet, FileText, Image, LayoutGrid, Link2, Menu,
  PanelRightOpen, Plus, Redo2, RotateCcw, Settings as SettingsIcon, Table2, Undo2, X,
} from 'lucide-react';
import { useTacticaStore, selectCanRedo, selectCanUndo, selectCanales } from './store/useTacticaStore';
import { useUiStore, type View } from './store/useUiStore';
import { ESTADO_LABEL, ESTADOS } from './lib/schema';
import { filterTacticas, activeFilterCount } from './lib/filter';
import { clearShareParam, readLocal } from './lib/persistence';
import { useTacticaActions } from './hooks/useTacticaActions';
import { useExportActions } from './hooks/useExportActions';
import { Board } from './views/Board';
import { Portfolio } from './views/Portfolio';
import { Wizard } from './views/Wizard';
import { InsightsPanel } from './components/InsightsPanel';
import { CommandPalette } from './components/CommandPalette';
import { ConfirmDialog } from './components/ConfirmDialog';
import { Toasts } from './components/Toasts';
import { SaveIndicator } from './components/SaveIndicator';
import { Settings } from './components/Settings';
import { ExportStage } from './components/ExportStage';

function useShortcuts() {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const mod = e.metaKey || e.ctrlKey;
      if (!mod) return;
      const k = e.key.toLowerCase();
      if (k === 'k') {
        e.preventDefault();
        const ui = useUiStore.getState();
        ui.set({ paletteOpen: !ui.paletteOpen });
        return;
      }
      if (k === 'z' || k === 'y') {
        // En campos de texto dejamos el deshacer nativo del navegador
        const el = e.target as HTMLElement;
        if (el.closest('input, textarea, [contenteditable="true"]')) return;
        e.preventDefault();
        const s = useTacticaStore.getState();
        if ((k === 'z' && e.shiftKey) || k === 'y') s.redo();
        else s.undo();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);
}

function Skeleton() {
  return (
    <div aria-busy="true" aria-label="Cargando tus tácticas" className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-3">
      {[0, 1, 2, 3].map((i) => <div key={i} className="skeleton h-64 rounded-sm" />)}
    </div>
  );
}

function EmptyState() {
  const { create, loadSample } = useTacticaActions();
  const readOnly = useTacticaStore((s) => s.readOnly);
  return (
    <section className="card p-6 md:p-10 flex flex-col items-start gap-4 max-w-2xl">
      <p className="chip bg-yellow">0 tácticas</p>
      <h2 className="text-3xl md:text-5xl leading-none">Aterriza tu primera táctica en 8 pasos.</h2>
      <p className="text-lg">De idea a plan ejecutable con evidencia, responsable, riesgo, inversión, KPI y ROI calculado. Sin datos mínimos no se avanza.</p>
      {!readOnly && (
        <div className="flex flex-wrap gap-2">
          <button className="btn btn-primary text-base" onClick={create}><Plus size={18} aria-hidden /> Crear táctica</button>
          <button className="btn text-base" onClick={loadSample}><Database size={18} aria-hidden /> Cargar datos de ejemplo</button>
        </div>
      )}
    </section>
  );
}

function NoResults() {
  const clear = useUiStore((s) => s.clearFilters);
  return (
    <div className="border-2 border-dashed border-black p-6 flex flex-col items-start gap-2">
      <p className="font-display text-2xl">Ninguna táctica coincide</p>
      <button className="btn" onClick={clear}><X size={16} aria-hidden /> Limpiar búsqueda y filtros</button>
    </div>
  );
}

function SharedBanner() {
  const readOnly = useTacticaStore((s) => s.readOnly);
  const fork = useTacticaStore((s) => s.forkSnapshot);
  const toast = useUiStore((s) => s.toast);
  if (!readOnly) return null;
  return (
    <div role="region" aria-label="Snapshot compartido" className="bg-yellow border-b-2 border-black px-4 py-2 flex flex-wrap items-center gap-2 justify-between">
      <p className="font-bold">Estás viendo un snapshot compartido — duplicar para editar</p>
      <button className="btn btn-dark" onClick={() => { fork(readLocal()); clearShareParam(); toast('Snapshot duplicado en tu espacio local'); }}>Duplicar para editar</button>
    </div>
  );
}

function Filters() {
  const filters = useUiStore((s) => s.filters);
  const setF = useUiStore((s) => s.setFilters);
  const clear = useUiStore((s) => s.clearFilters);
  const search = useUiStore((s) => s.search);
  const setSearch = useUiStore((s) => s.setSearch);
  const canales = useTacticaStore((s) => selectCanales(s.tacticas));
  const n = activeFilterCount(filters) + (search ? 1 : 0);
  return (
    <div className="flex flex-col gap-2" role="search">
      <div className="flex flex-col sm:flex-row gap-2">
        <label htmlFor="search" className="sr-only">Buscar tácticas</label>
        <input id="search" type="search" className="input sm:max-w-sm" placeholder="Buscar por nombre, canal, responsable, riesgo…" value={search} onChange={(e) => setSearch(e.target.value)} />
        <label className="sr-only" htmlFor="f-canal">Canal</label>
        <select id="f-canal" className="input sm:w-44" value={filters.canal} onChange={(e) => setF({ canal: e.target.value })}>
          <option value="">Todos los canales</option>
          {canales.map((c) => <option key={c} value={c}>{c}</option>)}
        </select>
        <label className="sr-only" htmlFor="f-riesgo">Riesgo</label>
        <select id="f-riesgo" className="input sm:w-40" value={filters.riesgo} onChange={(e) => setF({ riesgo: e.target.value as typeof filters.riesgo })}>
          <option value="">Cualquier riesgo</option>
          <option value="bajo">Riesgo bajo</option>
          <option value="medio">Riesgo medio</option>
          <option value="alto">Riesgo alto</option>
          <option value="sin-dato">Sin evaluar</option>
        </select>
      </div>
      <div className="flex flex-wrap gap-1 items-center" aria-label="Filtros rápidos">
        {ESTADOS.map((e) => {
          const on = filters.estados.includes(e);
          return (
            <button key={e} aria-pressed={on} className={`chip !py-1 ${on ? 'bg-black text-white' : ''}`} onClick={() => setF({ estados: on ? filters.estados.filter((x) => x !== e) : [...filters.estados, e] })}>{ESTADO_LABEL[e]}</button>
          );
        })}
        <button aria-pressed={filters.soloRoiNegativo} className={`chip !py-1 ${filters.soloRoiNegativo ? 'bg-black text-white' : ''}`} onClick={() => setF({ soloRoiNegativo: !filters.soloRoiNegativo })}>ROI negativo</button>
        <button aria-pressed={filters.soloListas} className={`chip !py-1 ${filters.soloListas ? 'bg-black text-white' : ''}`} onClick={() => setF({ soloListas: !filters.soloListas })}>Listas para ejecutar</button>
        {n > 0 && <button className="chip !py-1 bg-yellow" onClick={clear}>Limpiar ({n})</button>}
      </div>
    </div>
  );
}

function ToolbarButtons({ onAction }: { onAction?: () => void }) {
  const actions = useTacticaActions();
  const exp = useExportActions();
  const set = useUiStore((s) => s.set);
  const readOnly = useTacticaStore((s) => s.readOnly);
  const wrap = (fn: () => void) => () => { onAction?.(); fn(); };
  return (
    <>
      <button className="btn" onClick={wrap(exp.pdf)}><FileText size={16} aria-hidden /> PDF</button>
      <button className="btn" onClick={wrap(exp.png)}><Image size={16} aria-hidden /> PNG</button>
      <button className="btn" onClick={wrap(exp.csv)}><FileSpreadsheet size={16} aria-hidden /> CSV</button>
      <button className="btn" onClick={wrap(exp.json)}><FileJson size={16} aria-hidden /> JSON</button>
      <button className="btn" onClick={wrap(exp.share)}><Link2 size={16} aria-hidden /> Copiar enlace</button>
      {!readOnly && <button className="btn" onClick={wrap(actions.loadSample)}><Database size={16} aria-hidden /> Ejemplo</button>}
      {!readOnly && <button className="btn btn-danger" onClick={wrap(actions.reset)}><RotateCcw size={16} aria-hidden /> Reset</button>}
      <button className="btn" onClick={wrap(() => set({ settingsOpen: true }))}><SettingsIcon size={16} aria-hidden /> Ajustes</button>
    </>
  );
}

function BottomSheet() {
  const open = useUiStore((s) => s.sheetOpen);
  const set = useUiStore((s) => s.set);
  if (!open) return null;
  return (
    <div className="md:hidden fixed inset-0 z-40 bg-black/60" onMouseDown={(e) => e.target === e.currentTarget && set({ sheetOpen: false })}>
      <div role="dialog" aria-modal="true" aria-label="Acciones" className="absolute bottom-0 inset-x-0 bg-white border-t-2 border-black p-4 pb-8">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-xl">Acciones</h2>
          <button className="btn btn-icon" onClick={() => set({ sheetOpen: false })} aria-label="Cerrar acciones" autoFocus><X size={18} aria-hidden /></button>
        </div>
        <div className="grid grid-cols-2 gap-2 [&>.btn]:justify-start">
          <ToolbarButtons onAction={() => set({ sheetOpen: false })} />
        </div>
      </div>
    </div>
  );
}

export default function App() {
  useShortcuts();
  const hydrated = useTacticaStore((s) => s.hydrated);
  const tacticas = useTacticaStore((s) => s.tacticas);
  const readOnly = useTacticaStore((s) => s.readOnly);
  const canUndo = useTacticaStore(selectCanUndo);
  const canRedo = useTacticaStore(selectCanRedo);
  const undo = useTacticaStore((s) => s.undo);
  const redo = useTacticaStore((s) => s.redo);
  const view = useUiStore((s) => s.view);
  const setView = useUiStore((s) => s.setView);
  const search = useUiStore((s) => s.search);
  const filters = useUiStore((s) => s.filters);
  const insightsOpen = useUiStore((s) => s.insightsOpen);
  const set = useUiStore((s) => s.set);
  const lastSavedAt = useUiStore((s) => s.lastSavedAt);
  const { create } = useTacticaActions();
  const visible = useMemo(() => filterTacticas(tacticas, search, filters), [tacticas, search, filters]);
  const [savedMsg, setSavedMsg] = useState('');
  useEffect(() => { if (lastSavedAt) setSavedMsg(`Cambios guardados`); }, [lastSavedAt]);

  const tabs: { id: View; label: string; Icon: typeof LayoutGrid }[] = [
    { id: 'tablero', label: 'Tablero', Icon: LayoutGrid },
    { id: 'portafolio', label: 'Portafolio', Icon: Table2 },
  ];

  return (
    <div className="min-h-screen flex flex-col">
      <a href="#main-view" className="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-[70] btn">Saltar al contenido</a>
      <SharedBanner />
      <header className="border-b-2 border-black px-4 py-3 flex flex-col gap-3">
        <div className="flex items-center gap-2 flex-wrap">
          <div className="mr-auto">
            <h1 className="text-2xl md:text-3xl leading-none"><span className="bg-yellow px-1 border-2 border-black">Táctica</span> Aterrizada</h1>
            <p className="text-xs font-bold mt-1">De idea a plan ejecutable y medible · <SaveIndicator /></p>
          </div>
          <div className="flex items-center gap-1">
            <button className="btn btn-icon" onClick={undo} disabled={!canUndo} aria-label="Deshacer (Ctrl/Cmd+Z)" title="Deshacer"><Undo2 size={18} aria-hidden /></button>
            <button className="btn btn-icon" onClick={redo} disabled={!canRedo} aria-label="Rehacer (Ctrl/Cmd+Shift+Z)" title="Rehacer"><Redo2 size={18} aria-hidden /></button>
            <button className="btn btn-icon hidden sm:inline-flex" onClick={() => set({ paletteOpen: true })} aria-label="Comando rápido (Ctrl/Cmd+K)" title="Ctrl/Cmd+K"><Command size={18} aria-hidden /></button>
            <button id="btn-diag" className="btn" onClick={() => set({ insightsOpen: !insightsOpen })} aria-expanded={insightsOpen} aria-controls="diagnostico">
              <PanelRightOpen size={16} aria-hidden /> <span className="hidden sm:inline">Diagnóstico</span>
            </button>
            {!readOnly && <button id="btn-new" className="btn btn-primary" onClick={create}><Plus size={16} aria-hidden /> <span className="hidden sm:inline">Nueva táctica</span><span className="sm:hidden">Nueva</span></button>}
          </div>
        </div>
        <nav aria-label="Vistas" className="flex items-center gap-2 flex-wrap">
          <div className="flex" role="tablist" aria-label="Vista principal">
            {tabs.map(({ id, label, Icon }) => (
              <button key={id} role="tab" aria-selected={view === id} aria-controls="main-view" onClick={() => setView(id)} className={`btn -ml-[2px] first:ml-0 ${view === id ? '!bg-black !text-white' : ''}`}>
                <Icon size={16} aria-hidden /> {label}
              </button>
            ))}
          </div>
          <div className="hidden md:flex flex-wrap gap-1 ml-auto"><ToolbarButtons /></div>
        </nav>
      </header>

      <div className={`flex-1 p-4 pb-24 md:pb-6 grid gap-4 ${insightsOpen ? 'xl:grid-cols-[1fr_380px]' : ''}`}>
        <main id="main-view" tabIndex={-1} role="tabpanel" aria-label={view === 'tablero' ? 'Tablero' : 'Portafolio'} className="min-w-0 flex flex-col gap-4 outline-none">
          {!hydrated ? (
            <Skeleton />
          ) : tacticas.length === 0 ? (
            <EmptyState />
          ) : (
            <>
              <Filters />
              <p className="text-sm font-bold" aria-live="polite">{visible.length} de {tacticas.length} tácticas</p>
              {visible.length === 0 ? <NoResults /> : view === 'tablero' ? <Board tacticas={visible} readOnly={readOnly} /> : <Portfolio tacticas={visible} />}
            </>
          )}
        </main>
        {insightsOpen && hydrated && <InsightsPanel />}
      </div>

      <footer className="border-t-2 border-black px-4 py-3 text-xs font-bold flex flex-wrap justify-between gap-2 mb-16 md:mb-0">
        <span>© Vilma Núñez, PhD — Todos los derechos reservados</span>
        <a className="text-blue underline" href="https://vilmanunez.com" target="_blank" rel="noreferrer">vilmanunez.com</a>
      </footer>

      {/* Toolbar móvil: colapsa en Sheet inferior */}
      <div className="md:hidden fixed bottom-0 inset-x-0 z-30 bg-white border-t-2 border-black p-2 flex gap-2">
        <button className="btn flex-1" onClick={() => set({ sheetOpen: true })} aria-haspopup="dialog"><Menu size={16} aria-hidden /> Acciones</button>
        <button className="btn flex-1" onClick={() => set({ paletteOpen: true })}><Command size={16} aria-hidden /> Comandos</button>
      </div>

      <span className="sr-only" role="status" aria-live="polite">{savedMsg}</span>
      <BottomSheet />
      <Wizard />
      <Settings />
      <CommandPalette />
      <ConfirmDialog />
      <Toasts />
      <ExportStage />
    </div>
  );
}
