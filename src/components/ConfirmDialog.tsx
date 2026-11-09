import { useEffect, useState } from 'react';
import { useUiStore } from '../store/useUiStore';
import { Modal } from './Modal';

/** Modal de confirmación reutilizable (useUiStore.ask). Opcionalmente exige escribir un texto. */
export function ConfirmDialog() {
  const confirm = useUiStore((s) => s.confirm);
  const close = useUiStore((s) => s.closeConfirm);
  const [typed, setTyped] = useState('');
  useEffect(() => setTyped(''), [confirm]);
  if (!confirm) return null;
  const blocked = !!confirm.requireText && typed !== confirm.requireText;
  return (
    <Modal
      open
      role="alertdialog"
      size="sm"
      title={confirm.title}
      onClose={() => close(false)}
      initialFocus={confirm.requireText ? '#confirm-text' : '[data-cancel]'}
      footer={
        <>
          <button className="btn" data-cancel onClick={() => close(false)}>Cancelar</button>
          <button className="btn btn-danger" disabled={blocked} onClick={() => close(true)}>{confirm.confirmLabel}</button>
        </>
      }
    >
      <p aria-live="assertive" className="text-base">{confirm.body}</p>
      {confirm.requireText && (
        <div className="mt-4">
          <label htmlFor="confirm-text" className="label">
            Escribe <span className="hl font-display">{confirm.requireText}</span> para confirmar
          </label>
          <input
            id="confirm-text"
            className="input"
            autoComplete="off"
            value={typed}
            onChange={(e) => setTyped(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && !blocked && close(true)}
          />
        </div>
      )}
    </Modal>
  );
}
