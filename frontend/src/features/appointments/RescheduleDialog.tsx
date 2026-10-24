import { useCallback, useState } from "react";

import { Button } from "@/components/ui/Button";
import { Dialog } from "@/components/ui/Dialog";
import { Field } from "@/components/ui/Field";
import { getAvailability } from "@/features/appointments/api";
import { AppointmentSummary } from "@/features/appointments/AppointmentSummary";
import { SlotPicker } from "@/features/appointments/SlotPicker";
import { useAsyncResource } from "@/hooks/useAsyncResource";
import { formatLongDate } from "@/lib/dates";
import type { Appointment, AvailabilitySlot } from "@/types/appointment";

interface RescheduleDialogProps {
  appointment: Appointment;
  /** Hoy en la zona del negocio: no se puede reprogramar al pasado. */
  today: string;
  busy: boolean;
  error: string | null;
  onConfirm: (date: string, startTime: string) => void;
  onClose: () => void;
}

/**
 * Reprogramación en dos pasos (elegir horario → confirmar). El backend crea la cita nueva y deja la
 * original como «Reprogramada» (se conserva el historial y se libera el hueco); el diálogo lo explica.
 */
export function RescheduleDialog({ appointment, today, busy, error, onConfirm, onClose }: RescheduleDialogProps) {
  const [date, setDate] = useState(appointment.appointment_date >= today ? appointment.appointment_date : today);
  const [selected, setSelected] = useState<AvailabilitySlot | null>(null);

  const loadSlots = useCallback(
    () =>
      getAvailability({
        service_id: appointment.service,
        branch_id: appointment.branch,
        employee_id: appointment.employee,
        date,
      }).then((response) => response.slots),
    [appointment.service, appointment.branch, appointment.employee, date]
  );
  const [slots, reloadSlots] = useAsyncResource(loadSlots);

  return (
    <Dialog
      title="Reprogramar cita"
      description="Elige una nueva fecha y horario para esta cita."
      onClose={onClose}
      footer={
        <>
          <Button onClick={onClose} disabled={busy}>
            Volver
          </Button>
          <Button variant="primary" disabled={!selected || busy} onClick={() => selected && onConfirm(date, selected.start_time)}>
            {busy ? "Reprogramando..." : "Confirmar reprogramación"}
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        <AppointmentSummary appointment={appointment} />

        <Field label="Nueva fecha">
          {(control) => (
            <input
              {...control}
              type="date"
              value={date}
              min={today}
              onChange={(event) => {
                setDate(event.target.value);
                setSelected(null);
              }}
            />
          )}
        </Field>

        <div aria-live="polite">
          {slots.status === "loading" && <p className="m-0 text-sm text-muted">Buscando horarios disponibles...</p>}
          {slots.status === "error" && (
            <p role="alert" className="form-error">
              No se pudo cargar la disponibilidad.{" "}
              <button type="button" className="min-h-0 border-0 bg-transparent p-0 font-semibold underline shadow-none" onClick={reloadSlots}>
                Reintentar
              </button>
            </p>
          )}
          {slots.status === "ready" &&
            (slots.data.length === 0 ? (
              <p className="m-0 rounded-xl bg-subtle px-4 py-3 text-sm text-muted">
                No hay horarios disponibles el {formatLongDate(date)}. Prueba con otra fecha.
              </p>
            ) : (
              <SlotPicker
                slots={slots.data}
                selected={selected}
                employeeNames={{ [appointment.employee]: appointment.employee_name }}
                showEmployeeNames={false}
                onSelect={setSelected}
              />
            ))}
        </div>

        {selected && (
          <p className="m-0 rounded-xl bg-brand-soft px-4 py-3 text-sm text-ink">
            Nuevo horario: <strong>{formatLongDate(date)}</strong>, {selected.start_time.slice(0, 5)} – {selected.end_time.slice(0, 5)}.
            La cita original quedará como <strong>Reprogramada</strong> y se creará la nueva.
          </p>
        )}

        {error && (
          <p role="alert" className="form-error">
            {error}
          </p>
        )}
      </div>
    </Dialog>
  );
}
