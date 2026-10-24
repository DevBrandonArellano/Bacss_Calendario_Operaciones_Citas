import { ACTIVE_STATUSES } from "@/features/appointments/status";
import type { AppointmentStatus } from "@/types/appointment";

export type AppointmentAction = "confirm" | "start" | "complete" | "no_show" | "reschedule" | "cancel";

export const ACTION_LABELS: Record<AppointmentAction, string> = {
  confirm: "Confirmar",
  start: "Iniciar",
  complete: "Marcar como completada",
  no_show: "Marcar como no asistida",
  reschedule: "Reprogramar",
  cancel: "Cancelar cita",
};

/** Mensaje de éxito tras ejecutar cada acción. */
export const ACTION_SUCCESS: Record<AppointmentAction, string> = {
  confirm: "Cita confirmada.",
  start: "Cita iniciada.",
  complete: "Cita marcada como completada.",
  no_show: "Cita marcada como no asistida.",
  reschedule: "Cita reprogramada.",
  cancel: "Cita cancelada.",
};

/**
 * Acciones ofrecidas según el estado. Espejo de `VALID_TRANSITIONS` (backend): la UI solo
 * muestra lo que el servidor aceptaría, pero el servidor sigue siendo quien valida.
 */
const ACTIONS_BY_STATUS: Record<AppointmentStatus, AppointmentAction[]> = {
  pending: ["confirm", "no_show", "cancel"],
  confirmed: ["start", "reschedule", "no_show", "cancel"],
  waiting: ["start", "cancel"],
  in_progress: ["complete"],
  completed: [],
  cancelled: [],
  no_show: [],
  rescheduled: [],
};

export function availableActions(status: AppointmentStatus): AppointmentAction[] {
  return ACTIONS_BY_STATUS[status];
}

/** Las notas solo se editan mientras la cita sigue abierta (mismo criterio que el backend). */
export function canEditNotes(status: AppointmentStatus): boolean {
  return ACTIVE_STATUSES.includes(status);
}
