import { AGENDA_VIEWS, type AgendaView } from "@/features/appointments/agenda/agendaRange";
import { ALL_STATUSES } from "@/features/appointments/status";
import type { AppointmentStatus } from "@/types/appointment";

export const DEFAULT_VIEW: AgendaView = "week";

/** Estado completo de la Agenda que se refleja en la URL (compartible y recuperable). */
export interface AgendaState {
  view: AgendaView;
  /** Fecha de referencia «YYYY-MM-DD». */
  date: string;
  employee: string;
  service: string;
  statuses: AppointmentStatus[];
  /** Cita abierta en el panel de detalle. */
  appointment: string;
}

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

function isRealDate(value: string): boolean {
  if (!ISO_DATE.test(value)) return false;
  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(year, month - 1, day);
  return date.getFullYear() === year && date.getMonth() === month - 1 && date.getDate() === day;
}

/** Lee la URL tolerando valores inválidos: lo que no sea válido vuelve a su valor por defecto. */
export function parseAgendaParams(
  params: URLSearchParams,
  today: string,
  defaultView: AgendaView = DEFAULT_VIEW
): AgendaState {
  const view = params.get("view");
  const date = params.get("date") ?? "";
  const statuses = (params.get("status") ?? "")
    .split(",")
    .filter((status): status is AppointmentStatus => (ALL_STATUSES as string[]).includes(status));

  return {
    view: AGENDA_VIEWS.includes(view as AgendaView) ? (view as AgendaView) : defaultView,
    date: isRealDate(date) ? date : today,
    employee: params.get("employee") ?? "",
    service: params.get("service") ?? "",
    statuses,
    appointment: params.get("appointment") ?? "",
  };
}

/** Serializa el estado omitiendo lo vacío. La vista siempre se escribe: su valor por defecto depende del dispositivo. */
export function toSearchParams(state: AgendaState): URLSearchParams {
  const params = new URLSearchParams();
  params.set("view", state.view);
  if (state.date) params.set("date", state.date);
  if (state.employee) params.set("employee", state.employee);
  if (state.service) params.set("service", state.service);
  if (state.statuses.length > 0) params.set("status", state.statuses.join(","));
  if (state.appointment) params.set("appointment", state.appointment);
  return params;
}

/** Enlace a la Agenda desde otras pantallas (Dashboard, acciones rápidas...). */
export function agendaLink(state: Partial<AgendaState>): string {
  const params = new URLSearchParams();
  // El orden fijo mantiene los enlaces predecibles (y testeables).
  if (state.view) params.set("view", state.view);
  if (state.date) params.set("date", state.date);
  if (state.employee) params.set("employee", state.employee);
  if (state.service) params.set("service", state.service);
  if (state.statuses?.length) params.set("status", state.statuses.join(","));
  if (state.appointment) params.set("appointment", state.appointment);
  const query = params.toString();
  return query ? `/citas?${query}` : "/citas";
}

export function hasActiveFilters(state: AgendaState): boolean {
  return Boolean(state.employee || state.service || state.statuses.length > 0);
}
