import { useAppStore } from '../store/useAppStore';
import { exportCSV, exportJSON, exportPDF, exportPNG } from './exporters';
import { buildShareUrl } from './share';
import { copyText } from './download';

const nextFrame = () => new Promise<void>((r) => requestAnimationFrame(() => r()));

async function withCapture(fn: () => Promise<void>): Promise<void> {
  const st = useAppStore.getState();
  if (!st.data.avatares.length || !st.data.productos.length) {
    st.toast('Añade al menos un avatar y un producto para exportar la matriz.', 'error');
    return;
  }
  st.setCapturing(true);
  try {
    await nextFrame();
    await nextFrame();
    await document.fonts?.ready;
    await fn();
  } finally {
    useAppStore.getState().setCapturing(false);
  }
}

/** Acciones de alto nivel compartidas por toolbar, sheet móvil y paleta Cmd+K. */
export const appActions = {
  async png() {
    const { toast } = useAppStore.getState();
    try {
      await withCapture(exportPNG);
      toast('PNG descargado (2x)', 'success');
    } catch (e) {
      toast(`No se pudo exportar el PNG: ${(e as Error).message}`, 'error');
    }
  },
  async pdf() {
    const { toast } = useAppStore.getState();
    try {
      toast('Generando PDF ejecutivo…');
      await withCapture(() => {
        const { data, moneda } = useAppStore.getState();
        return exportPDF(data, moneda);
      });
      toast('PDF ejecutivo descargado', 'success');
    } catch (e) {
      toast(`No se pudo exportar el PDF: ${(e as Error).message}`, 'error');
    }
  },
  csv() {
    const { data, toast } = useAppStore.getState();
    exportCSV(data);
    toast('CSV descargado', 'success');
  },
  json() {
    const { data, toast } = useAppStore.getState();
    exportJSON(data);
    toast('JSON descargado', 'success');
  },
  async share() {
    const { data, toast } = useAppStore.getState();
    const url = buildShareUrl(data);
    const ok = await copyText(url);
    toast(ok ? `Enlace copiado (${Math.round(url.length / 1024)} KB)` : 'No se pudo copiar el enlace', ok ? 'success' : 'error');
  },
  undo() {
    const s = useAppStore.getState();
    if (!s.past.length) return;
    s.undo();
    s.toast('Acción deshecha');
  },
  redo() {
    const s = useAppStore.getState();
    if (!s.future.length) return;
    s.redo();
    s.toast('Acción rehecha');
  },
  sample() {
    const s = useAppStore.getState();
    const hasData = s.data.avatares.length || s.data.productos.length;
    const run = () => {
      s.loadSample();
      useAppStore.getState().toast('Caso de ejemplo cargado: escuela online de marketing', 'success');
    };
    if (hasData) {
      s.confirm({
        title: 'Cargar datos de ejemplo',
        message: 'Se sustituirán tus datos actuales por el caso de ejemplo. Puedes deshacerlo con Ctrl/Cmd+Z.',
        confirmLabel: 'Sustituir',
        onConfirm: run,
      });
    } else run();
  },
};
