import { Sparkles } from 'lucide-react';
import { Modal } from './Modal';
import { useAppStore } from '../store/useAppStore';
import { savePrefs } from '../lib/persistence';
import { startTour } from './Tour';
import type { Moneda } from '../types';

const MONEDAS: Moneda[] = ['EUR', 'USD', 'MXN', 'COP', 'ARS', 'CLP', 'PEN'];

export function SettingsModal({ onClose }: { onClose: () => void }) {
  const moneda = useAppStore((s) => s.moneda);
  const heatmap = useAppStore((s) => s.heatmap);
  const { setMoneda, setHeatmap } = useAppStore.getState();
  return (
    <Modal
      title="Ajustes"
      onClose={onClose}
      size="sm"
      footer={
        <button type="button" className="btn btn-primary" onClick={onClose}>
          Listo
        </button>
      }
    >
      <div className="space-y-4">
        <div>
          <label htmlFor="set-moneda" className="label">
            Moneda
          </label>
          <select
            id="set-moneda"
            className="field"
            value={moneda}
            onChange={(e) => {
              const m = e.target.value as Moneda;
              setMoneda(m);
              savePrefs({ moneda: m });
            }}
          >
            {MONEDAS.map((m) => (
              <option key={m}>{m}</option>
            ))}
          </select>
        </div>
        <label className="flex items-center gap-2 text-sm font-bold">
          <input
            type="checkbox"
            className="h-5 w-5 accent-black"
            checked={heatmap}
            onChange={(e) => {
              setHeatmap(e.target.checked);
              savePrefs({ heatmap: e.target.checked });
            }}
          />
          Heatmap por ingreso activado
        </label>
        <div className="border-t-2 border-black pt-4">
          <p className="label">Onboarding</p>
          <button
            type="button"
            className="btn"
            onClick={() => {
              onClose();
              setTimeout(startTour, 80);
            }}
          >
            <Sparkles size={16} aria-hidden /> Reactivar tour de 3 pasos
          </button>
        </div>
        <p className="border-t-2 border-black pt-3 text-xs">
          Atajos: <span className="kbd">Ctrl/⌘ K</span> comando rápido · <span className="kbd">Ctrl/⌘ Z</span> deshacer ·{' '}
          <span className="kbd">Ctrl/⌘ ⇧ Z</span> rehacer · flechas para moverte entre celdas.
        </p>
      </div>
    </Modal>
  );
}
