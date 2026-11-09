import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './index.css';
import App from './App';
import { ErrorBoundary } from './components/ErrorBoundary';
import { useTacticaStore } from './store/useTacticaStore';
import { useUiStore } from './store/useUiStore';
import { decodeSnapshot, readLocal, startAutosave } from './lib/persistence';
import { fetchShortLink } from './lib/supabase';
import { startTour, tourSeen } from './lib/tour';

async function boot() {
  const params = new URLSearchParams(window.location.search);
  const s = params.get('s');
  const id = params.get('id');
  const store = useTacticaStore.getState();
  const toast = useUiStore.getState().toast;

  let shared = s ? decodeSnapshot(s) : null;
  if (!shared && id) shared = await fetchShortLink(id);

  if (shared) {
    store.hydrate(shared, { readOnly: true });
  } else {
    if (s || id) toast('El enlace compartido no es válido o expiró', 'error');
    store.hydrate(readLocal());
  }
  startAutosave((at) => useUiStore.getState().set({ lastSavedAt: at }));
  if (!tourSeen() && !shared) setTimeout(startTour, 600);
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </StrictMode>,
);

// Hidratación tras el primer render para mostrar skeletons
requestAnimationFrame(() => void boot());
