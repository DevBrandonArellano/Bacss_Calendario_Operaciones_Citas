import { useCallback, useState } from "react";

import {
  cancelAppointment,
  completeAppointment,
  confirmAppointment,
  markNoShow,
  rescheduleAppointment,
  startAppointment,
  updateAppointmentNotes,
} from "@/features/appointments/api";
import { ACTION_SUCCESS, type AppointmentAction } from "@/features/appointments/agenda/appointmentActions";
import { errorMessage } from "@/lib/errors";
import type { Appointment } from "@/types/appointment";

const SIMPLE_ACTIONS: Partial<Record<AppointmentAction, (id: string) => Promise<Appointment>>> = {
  confirm: confirmAppointment,
  start: startAppointment,
  complete: completeAppointment,
  no_show: markNoShow,
};

export type ActionRequest =
  | { type: "confirm" | "start" | "complete" | "no_show" }
  | { type: "cancel"; reason: string }
  | { type: "reschedule"; date: string; startTime: string }
  | { type: "notes"; notes: string };

export interface ActionOutcome {
  ok: boolean;
  /** Mensaje de éxito para mostrar al usuario (solo si `ok`). */
  message?: string;
  /** Cita resultante (en reprogramar, la cita nueva). */
  result?: Appointment;
}

/**
 * Ejecuta las operaciones sobre una cita (cambio de estado, cancelar, reprogramar, notas) con
 * estado de «ocupado» para evitar envíos duplicados y mensaje de error amigable. Las reglas las
 * valida siempre el servidor; aquí solo se orquesta la llamada y se refresca la agenda después.
 */
export function useAppointmentActions(onChanged: () => void) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const clearError = useCallback(() => setError(null), []);

  const run = useCallback(
    async (appointment: Appointment, request: ActionRequest): Promise<ActionOutcome> => {
      if (busy) return { ok: false };
      setBusy(true);
      setError(null);
      try {
        let result: Appointment;
        let message: string;
        switch (request.type) {
          case "cancel":
            result = await cancelAppointment(appointment.id, request.reason);
            message = ACTION_SUCCESS.cancel;
            break;
          case "reschedule":
            result = await rescheduleAppointment(appointment.id, request.date, request.startTime);
            message = ACTION_SUCCESS.reschedule;
            break;
          case "notes":
            result = await updateAppointmentNotes(appointment.id, request.notes);
            message = "Notas guardadas.";
            break;
          default: {
            const action = SIMPLE_ACTIONS[request.type];
            if (!action) throw new Error(`Acción no soportada: ${request.type}`);
            result = await action(appointment.id);
            message = ACTION_SUCCESS[request.type];
          }
        }
        onChanged();
        return { ok: true, message, result };
      } catch (err) {
        setError(errorMessage(err, "No se pudo completar la acción. Inténtalo de nuevo."));
        return { ok: false };
      } finally {
        setBusy(false);
      }
    },
    [busy, onChanged]
  );

  return { busy, error, clearError, run };
}
