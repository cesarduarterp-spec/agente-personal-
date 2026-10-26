import { useEffect } from 'react';
import { emptyState, useAppStore } from './store/useAppStore';
import { debounce, loadPrefs, loadState, savePrefs, saveState } from './lib/persistence';
import { decodeShare, readShareParam } from './lib/share';
import { appActions } from './lib/actions';
import { MatrixView, CaptureHost } from './components/MatrixView';
import { OpportunitiesView } from './components/OpportunitiesView';
import { InsightsPanel } from './components/InsightsPanel';
import { MobileBar, SearchBox, Toolbar, ViewTabs } from './components/Toolbar';
import { SaveIndicator } from './components/SaveIndicator';
import { SharedBanner } from './components/SharedBanner';
import { Toasts } from './components/Toasts';
import { CellPopover } from './components/CellPopover';
import { CommandPalette } from './components/CommandPalette';
import { ConfirmModal } from './components/ConfirmModal';
import { ResetModal } from './components/ResetModal';
import { AvatarFormModal, ProductoFormModal } from './components/EntityForms';
import { SettingsModal } from './components/SettingsModal';
import { ImportModal } from './components/ImportModal';
import { Skeleton } from './components/Skeleton';
import { startTour } from './components/Tour';

function useHydration() {
  useEffect(() => {
    const st = useAppStore.getState();
    const prefs = loadPrefs();
    st.setMoneda(prefs.moneda);
    st.setHeatmap(prefs.heatmap);
    st.setPanelOpen(window.matchMedia('(max-width: 767px)').matches ? true : prefs.panelOpen);

    const shared = readShareParam();
    let readOnly = false;
    if (shared) {
      const res = decodeShare(shared);
      if (res.ok) {
        st.hydrate(res.data, { readOnly: true });
        readOnly = true;
      } else {
        st.hydrate(loadState() ?? emptyState());
        st.toast(`No se pudo abrir el enlace compartido: ${res.error}`, 'error');
      }
    } else {
      st.hydrate(loadState() ?? emptyState());
    }
    if (!prefs.tourSeen && !readOnly) setTimeout(startTour, 600);
  }, []);
}

function useAutosave() {
  useEffect(() => {
    const save = debounce(() => {
      const s = useAppStore.getState();
      if (s.readOnly || !s.hydrated) return;
      if (saveState(s.data)) s.markSaved(Date.now());
      else s.toast('No se pudo guardar en este navegador (almacenamiento lleno o bloqueado).', 'error');
    }, 500);
    const unsub = useAppStore.subscribe((s, prev) => {
      if (s.data !== prev.data && s.hydrated && prev.hydrated && !s.readOnly) save();
      if (s.heatmap !== prev.heatmap || s.panelOpen !== prev.panelOpen) savePrefs({ heatmap: s.heatmap, panelOpen: s.panelOpen });
    });
    const flush = () => {
      const s = useAppStore.getState();
      if (!s.readOnly && s.hydrated) saveState(s.data);
    };
    window.addEventListener('beforeunload', flush);
    return () => {
      unsub();
      save.cancel();
      window.removeEventListener('beforeunload', flush);
    };
  }, []);
}

function useShortcuts() {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const mod = e.metaKey || e.ctrlKey;
      if (!mod) return;
      const k = e.key.toLowerCase();
      const t = e.target as HTMLElement | null;
      const editing = !!t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable);
      if (k === 'k') {
        e.preventDefault();
        const s = useAppStore.getState();
        s.setPaletteOpen(!s.paletteOpen);
      } else if (k === 'z' && !editing) {
        e.preventDefault();
        if (e.shiftKey) appActions.redo();
        else appActions.undo();
      } else if (k === 'y' && !editing) {
        e.preventDefault();
        appActions.redo();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);
}

function Modals() {
  const modal = useAppStore((s) => s.modal);
  const close = useAppStore((s) => s.closeModal);
  if (!modal) return null;
  switch (modal.type) {
    case 'avatar':
      return <AvatarFormModal key={modal.id ?? 'new'} id={modal.id} onClose={close} />;
    case 'producto':
      return <ProductoFormModal key={modal.id ?? 'new'} id={modal.id} onClose={close} />;
    case 'confirm':
      return <ConfirmModal title={modal.title} message={modal.message} confirmLabel={modal.confirmLabel} onConfirm={modal.onConfirm} onClose={close} />;
    case 'reset':
      return <ResetModal onClose={close} />;
    case 'settings':
      return <SettingsModal onClose={close} />;
    case 'import':
      return <ImportModal onClose={close} />;
  }
}

export default function App() {
  useHydration();
  useAutosave();
  useShortcuts();
  const hydrated = useAppStore((s) => s.hydrated);
  const view = useAppStore((s) => s.view);

  return (
    <div className="flex min-h-screen flex-col pb-20 md:pb-0">
      <a href="#main-panel" className="sr-only-focusable fixed left-2 top-2 z-[70] btn bg-yellow">
        Saltar al contenido
      </a>
      <SharedBanner />
      <header className="border-b-2 border-black">
        <div className="mx-auto max-w-[1600px] space-y-3 px-4 py-3">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center border-2 border-black bg-yellow font-display text-xl" aria-hidden>
                ×
              </span>
              <div>
                <h1 className="text-xl leading-none sm:text-2xl">Cliente × Producto Matrix</h1>
                <p className="text-xs font-bold">Cross-sell y afinidad · avatar por producto</p>
              </div>
            </div>
            <SaveIndicator />
          </div>
          <Toolbar />
          <div className="space-y-2 md:hidden">
            <ViewTabs />
            <SearchBox />
          </div>
        </div>
      </header>

      <div className="mx-auto flex w-full max-w-[1600px] flex-1 flex-col gap-4 px-4 py-4 md:flex-row md:items-start">
        <main id="main-panel" role="tabpanel" aria-labelledby={`tab-${view}`} tabIndex={-1} className="min-w-0 flex-1 focus:outline-none">
          {!hydrated ? <Skeleton /> : view === 'matriz' ? <MatrixView /> : <OpportunitiesView />}
        </main>
        {hydrated && <InsightsPanel />}
      </div>

      <footer className="border-t-2 border-black px-4 py-3 text-center text-xs font-bold">
        © Vilma Núñez, PhD — Todos los derechos reservados · <a className="link" href="https://vilmanunez.com" target="_blank" rel="noreferrer">vilmanunez.com</a>
      </footer>

      <MobileBar />
      <Modals />
      <CellPopover />
      <CommandPalette />
      <CaptureHost />
      <Toasts />
    </div>
  );
}
