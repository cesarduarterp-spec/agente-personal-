import { Component, type ReactNode } from 'react';
import { STORAGE_KEY } from '../store/useTacticaStore';

interface S { error: Error | null }

/** Captura errores de render y permite exportar el estado antes de recargar. */
export class ErrorBoundary extends Component<{ children: ReactNode }, S> {
  state: S = { error: null };
  static getDerivedStateFromError(error: Error): S { return { error }; }

  exportState = () => {
    let raw = '';
    try { raw = localStorage.getItem(STORAGE_KEY) ?? ''; } catch { /* noop */ }
    const blob = new Blob([raw || '{}'], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `tactica-aterrizada-rescate-${Date.now()}.json`;
    a.click();
  };

  render() {
    if (!this.state.error) return this.props.children;
    return (
      <main role="alert" className="min-h-screen flex items-center justify-center p-4">
        <div className="card shadow-brutal max-w-lg p-6 flex flex-col gap-4">
          <h1 className="text-3xl">Algo se rompió</h1>
          <p>Tus datos siguen guardados en este navegador. Descarga una copia antes de recargar por si acaso.</p>
          <pre className="border-2 border-black p-2 text-xs overflow-auto max-h-32">{this.state.error.message}</pre>
          <div className="flex flex-wrap gap-2">
            <button className="btn btn-dark" onClick={this.exportState}>Exportar estado (JSON)</button>
            <button className="btn btn-primary" onClick={() => window.location.reload()}>Recargar</button>
          </div>
        </div>
      </main>
    );
  }
}
