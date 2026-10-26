import { Component, type ErrorInfo, type ReactNode } from 'react';
import { useAppStore } from '../store/useAppStore';
import { STORAGE_KEY } from '../lib/persistence';
import { downloadText } from '../lib/download';
import { toJSON } from '../lib/serialize';

interface S {
  error: Error | null;
}

/** Error boundary global con opción de exportar el estado antes de recargar. */
export class ErrorBoundary extends Component<{ children: ReactNode }, S> {
  state: S = { error: null };

  static getDerivedStateFromError(error: Error): S {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('[Cliente × Producto Matrix]', error, info.componentStack);
  }

  exportState = () => {
    let text: string;
    try {
      text = toJSON(useAppStore.getState().data);
    } catch {
      text = localStorage.getItem(STORAGE_KEY) ?? '{}';
    }
    downloadText(text, `cliente-producto-matrix-rescate-${Date.now()}.json`, 'application/json');
  };

  render() {
    if (!this.state.error) return this.props.children;
    return (
      <div role="alert" className="mx-auto my-16 max-w-lg border-2 border-black bg-white p-6 shadow-brutal">
        <p className="tag mb-3 bg-black text-yellow">Error inesperado</p>
        <h1 className="text-3xl">Algo se ha roto</h1>
        <p className="mt-3 text-sm">Tus datos siguen guardados en este navegador. Exporta una copia antes de recargar por si acaso.</p>
        <pre className="mt-3 max-h-32 overflow-auto border-2 border-black p-2 text-xs">{this.state.error.message}</pre>
        <div className="mt-5 flex flex-wrap gap-2">
          <button type="button" className="btn btn-primary" onClick={this.exportState}>
            Exportar estado (JSON)
          </button>
          <button type="button" className="btn" onClick={() => window.location.reload()}>
            Recargar
          </button>
        </div>
      </div>
    );
  }
}
