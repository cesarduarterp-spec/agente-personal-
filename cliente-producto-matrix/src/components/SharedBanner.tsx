import { Copy } from 'lucide-react';
import { useAppStore } from '../store/useAppStore';
import { clearShareParam } from '../lib/share';
import { hasStoredData, saveState } from '../lib/persistence';

export function SharedBanner() {
  const readOnly = useAppStore((s) => s.readOnly);
  if (!readOnly) return null;

  const duplicate = () => {
    const st = useAppStore.getState();
    const run = () => {
      const s = useAppStore.getState();
      saveState(s.data);
      s.setReadOnly(false);
      s.markSaved(Date.now());
      clearShareParam();
      s.toast('Snapshot duplicado en tu espacio. Ya puedes editar.', 'success');
    };
    if (hasStoredData()) {
      st.confirm({
        title: 'Duplicar snapshot',
        message: 'Ya tienes una matriz guardada en este navegador. Duplicar el snapshot la sustituirá. Exporta un JSON antes si quieres conservarla.',
        confirmLabel: 'Sustituir y editar',
        onConfirm: run,
      });
    } else run();
  };

  return (
    <div role="region" aria-label="Snapshot compartido" className="border-b-2 border-black bg-blue text-white">
      <div className="mx-auto flex max-w-[1600px] flex-wrap items-center justify-between gap-2 px-4 py-2">
        <p className="text-sm font-bold">Estás viendo un snapshot compartido — duplicar para editar.</p>
        <button type="button" className="btn bg-white text-black" onClick={duplicate}>
          <Copy size={16} aria-hidden /> Duplicar para editar
        </button>
      </div>
    </div>
  );
}
