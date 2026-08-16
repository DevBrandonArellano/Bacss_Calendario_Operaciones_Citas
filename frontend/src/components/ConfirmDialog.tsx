import { useRef } from "react";

import { useModalA11y } from "@/hooks/useModalA11y";

interface ConfirmDialogProps {
  title: string;
  message: string;
  confirmLabel?: string;
  onConfirm: () => void;
  onCancel: () => void;
}

export function ConfirmDialog({ title, message, confirmLabel = "Confirmar", onConfirm, onCancel }: ConfirmDialogProps) {
  const modalRef = useRef<HTMLDivElement>(null);
  useModalA11y(modalRef, onCancel);

  return (
    <div className="modal-backdrop" role="dialog" aria-modal="true" aria-labelledby="confirm-dialog-title">
      <div className="modal" ref={modalRef}>
        <h2 id="confirm-dialog-title">{title}</h2>
        <p>{message}</p>
        <div className="toolbar">
          <button type="button" onClick={onConfirm} autoFocus>
            {confirmLabel}
          </button>
          <button type="button" onClick={onCancel}>
            Cancelar
          </button>
        </div>
      </div>
    </div>
  );
}
