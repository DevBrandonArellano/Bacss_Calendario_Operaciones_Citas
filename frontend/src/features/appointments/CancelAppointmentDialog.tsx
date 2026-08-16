import { useRef, useState } from "react";

import { useModalA11y } from "@/hooks/useModalA11y";

interface CancelAppointmentDialogProps {
  onConfirm: (reason: string) => void;
  onCancel: () => void;
}

export function CancelAppointmentDialog({ onConfirm, onCancel }: CancelAppointmentDialogProps) {
  const [reason, setReason] = useState("");
  const modalRef = useRef<HTMLDivElement>(null);
  useModalA11y(modalRef, onCancel);

  return (
    <div className="modal-backdrop" role="dialog" aria-modal="true" aria-labelledby="cancel-dialog-title">
      <div className="modal" ref={modalRef}>
        <h2 id="cancel-dialog-title">Cancelar cita</h2>
        <label htmlFor="cancel-reason">Motivo (opcional)</label>
        <textarea id="cancel-reason" value={reason} onChange={(e) => setReason(e.target.value)} />
        <div className="toolbar">
          <button type="button" onClick={() => onConfirm(reason)}>
            Confirmar cancelación
          </button>
          <button type="button" onClick={onCancel}>
            Volver
          </button>
        </div>
      </div>
    </div>
  );
}
