import { useId, useRef } from 'react';
import { Modal } from './Modal';

interface Props {
  title: string;
  message: string;
  confirmLabel: string;
  onConfirm: () => void;
  onClose: () => void;
}

/** Confirmación reutilizable para acciones destructivas (aria-live assertive). */
export function ConfirmModal({ title, message, confirmLabel, onConfirm, onClose }: Props) {
  const cancelRef = useRef<HTMLButtonElement>(null);
  const msgId = useId();
  return (
    <Modal
      title={title}
      onClose={onClose}
      role="alertdialog"
      size="sm"
      initialFocus={cancelRef}
      describedBy={msgId}
      footer={
        <>
          <button ref={cancelRef} type="button" className="btn" onClick={onClose}>
            Cancelar
          </button>
          <button
            type="button"
            className="btn btn-danger"
            onClick={() => {
              onConfirm();
              onClose();
            }}
          >
            {confirmLabel}
          </button>
        </>
      }
    >
      <p id={msgId} aria-live="assertive" className="text-sm">
        {message}
      </p>
    </Modal>
  );
}
