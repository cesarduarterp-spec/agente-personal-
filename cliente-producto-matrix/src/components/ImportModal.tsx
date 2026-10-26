import { useRef, useState } from 'react';
import { Upload } from 'lucide-react';
import { Modal } from './Modal';
import { useAppStore } from '../store/useAppStore';

export function ImportModal({ onClose }: { onClose: () => void }) {
  const [text, setText] = useState('');
  const [error, setError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const { importData, toast } = useAppStore.getState();

  const apply = (raw: string) => {
    let parsed: unknown;
    try {
      parsed = JSON.parse(raw);
    } catch {
      setError('El archivo no es un JSON válido.');
      return;
    }
    const res = importData(parsed);
    if (!res.ok) {
      setError(`No se importó nada para no corromper tus datos: ${res.error}`);
      return;
    }
    toast(`Importado: ${res.data.avatares.length} avatares, ${res.data.productos.length} productos`, 'success');
    onClose();
  };

  return (
    <Modal
      title="Importar JSON"
      onClose={onClose}
      footer={
        <>
          <button type="button" className="btn" onClick={onClose}>
            Cancelar
          </button>
          <button type="button" className="btn btn-primary" disabled={!text.trim()} onClick={() => apply(text)}>
            Importar texto
          </button>
        </>
      }
    >
      <div className="space-y-3">
        <p className="text-sm">Acepta el JSON exportado por esta app (versión 1). Se valida con zod antes de sustituir tu matriz, y puedes deshacerlo con Ctrl/⌘+Z.</p>
        <input
          ref={fileRef}
          type="file"
          accept="application/json,.json"
          className="sr-only"
          id="import-file"
          onChange={async (e) => {
            const f = e.target.files?.[0];
            if (f) apply(await f.text());
            e.target.value = '';
          }}
        />
        <label htmlFor="import-file" className="btn w-full cursor-pointer">
          <Upload size={16} aria-hidden /> Elegir archivo .json
        </label>
        <div>
          <label htmlFor="import-text" className="label">
            O pega el contenido
          </label>
          <textarea id="import-text" rows={6} className="field font-mono text-xs" value={text} onChange={(e) => setText(e.target.value)} aria-invalid={!!error} aria-describedby={error ? 'import-err' : undefined} />
        </div>
        {error && (
          <p id="import-err" role="alert" className="border-2 border-black bg-black p-2 text-sm font-bold text-yellow">
            {error}
          </p>
        )}
      </div>
    </Modal>
  );
}
