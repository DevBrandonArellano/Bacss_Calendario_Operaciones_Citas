import { useState } from "react";

import { Button } from "@/components/ui/Button";
import { Dialog } from "@/components/ui/Dialog";
import { Field } from "@/components/ui/Field";
import { AppointmentSummary } from "@/features/appointments/AppointmentSummary";
import type { Appointment } from "@/types/appointment";

interface CancelAppointmentDialogProps {
  appointment: Appointment;
  busy: boolean;
  error: string | null;
  onConfirm: (reason: string) => void;
  onClose: () => void;
}

/** Confirmación de cancelación con resumen de la cita y motivo opcional. La cita no se borra: queda como «Cancelada». */
export function CancelAppointmentDialog({ appointment, busy, error, onConfirm, onClose }: CancelAppointmentDialogProps) {
  const [reason, setReason] = useState("");

  return (
    <Dialog
      title="Cancelar cita"
      description="El horario quedará libre y la cita se conservará en el historial como cancelada."
      onClose={onClose}
      footer={
        <>
          <Button onClick={onClose} disabled={busy}>
            Mantener cita
          </Button>
          <Button variant="danger" onClick={() => onConfirm(reason.trim())} disabled={busy}>
            {busy ? "Cancelando..." : "Cancelar cita"}
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        <AppointmentSummary appointment={appointment} />
        <Field label="Motivo (opcional)">
          {(control) => <textarea {...control} rows={3} value={reason} onChange={(event) => setReason(event.target.value)} />}
        </Field>
        {error && (
          <p role="alert" className="form-error">
            {error}
          </p>
        )}
      </div>
    </Dialog>
  );
}
