import { useEffect, useRef, useState } from "react";

import { getAvailability } from "@/features/appointments/api";
import { useModalA11y } from "@/hooks/useModalA11y";
import { toISODate } from "@/lib/dates";
import type { Appointment, AvailabilitySlot } from "@/types/appointment";

interface RescheduleDialogProps {
  appointment: Appointment;
  onConfirm: (date: string, startTime: string) => void;
  onCancel: () => void;
}

export function RescheduleDialog({ appointment, onConfirm, onCancel }: RescheduleDialogProps) {
  const [date, setDate] = useState(appointment.appointment_date);
  const [slots, setSlots] = useState<AvailabilitySlot[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const modalRef = useRef<HTMLDivElement>(null);
  useModalA11y(modalRef, onCancel);

  useEffect(() => {
    setLoading(true);
    setError(null);
    getAvailability({
      service_id: appointment.service,
      branch_id: appointment.branch,
      date,
      employee_id: appointment.employee,
    })
      .then((data) => setSlots(data.slots))
      .catch(() => setError("No se pudo cargar la disponibilidad."))
      .finally(() => setLoading(false));
  }, [date, appointment]);

  return (
    <div className="modal-backdrop" role="dialog" aria-modal="true" aria-labelledby="reschedule-dialog-title">
      <div className="modal" ref={modalRef}>
        <h2 id="reschedule-dialog-title">Reprogramar cita</h2>

        <label htmlFor="reschedule-date">Nueva fecha</label>
        <input
          id="reschedule-date"
          type="date"
          value={date}
          min={toISODate(new Date())}
          onChange={(e) => setDate(e.target.value)}
        />

        {error && <p className="form-error">{error}</p>}
        {loading && <p>Buscando horarios disponibles...</p>}
        {!loading && slots.length === 0 && !error && <p>No hay horarios disponibles ese día.</p>}

        {!loading && slots.length > 0 && (
          <div className="toolbar" role="list" aria-label="Horarios disponibles">
            {slots.map((slot) => (
              <button
                key={slot.start_time}
                type="button"
                onClick={() => onConfirm(date, slot.start_time)}
              >
                {slot.start_time.slice(0, 5)}
              </button>
            ))}
          </div>
        )}

        <div className="toolbar">
          <button type="button" onClick={onCancel}>
            Volver
          </button>
        </div>
      </div>
    </div>
  );
}
