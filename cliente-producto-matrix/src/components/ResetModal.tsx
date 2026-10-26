import { useRef, useState } from 'react';
import { Modal } from './Modal';
import { useAppStore } from '../store/useAppStore';

const WORD = 'BORRAR';

/** Doble confirmación: paso 1 aviso, paso 2 escribir BORRAR a mano. */
export function ResetModal({ onClose }: { onClose: () => void }) {
  const [step, setStep] = useState<1 | 2>(1);
  const [text, setText] = useState('');
  const reset = useAppStore((s) => s.reset);
  const toast = useAppStore((s) => s.toast);
  const cancelRef = useRef<HTMLButtonElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const ok = text === WORD;

  return (
    <Modal
      title={step === 1 ? '¿Resetear toda la matriz?' : 'Confirmación final'}
      onClose={onClose}
      role="alertdialog"
      size="sm"
      initialFocus={cancelRef}
      footer={
        <>
          <button ref={cancelRef} type="button" className="btn" onClick={onClose}>
            Cancelar
          </button>
          {step === 1 ? (
            <button
              type="button"
              className="btn btn-danger"
              onClick={() => setStep(2)}
            >
              Continuar
            </button>
          ) : (
            <button
              type="button"
              className="btn btn-danger"
              disabled={!ok}
              onClick={() => {
                reset();
                toast('Matriz reseteada. Puedes deshacer con Ctrl/Cmd+Z.', 'success');
                onClose();
              }}
            >
              Borrar todo
            </button>
          )}
        </>
      }
    >
      <div aria-live="assertive">
        {step === 1 ? (
          <p className="text-sm">Se eliminarán todos los avatares, productos y celdas. Exporta un JSON antes si quieres conservarlos.</p>
        ) : (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (ok) {
                reset();
                toast('Matriz reseteada. Puedes deshacer con Ctrl/Cmd+Z.', 'success');
                onClose();
              }
            }}
          >
            <label htmlFor="reset-confirm" className="label">
              Escribe {WORD} para confirmar
            </label>
            <input
              id="reset-confirm"
              ref={inputRef}
              autoFocus
              className="field font-bold tracking-widest"
              value={text}
              onChange={(e) => setText(e.target.value)}
              autoComplete="off"
              spellCheck={false}
              onPaste={(e) => e.preventDefault()}
            />
          </form>
        )}
      </div>
    </Modal>
  );
}
