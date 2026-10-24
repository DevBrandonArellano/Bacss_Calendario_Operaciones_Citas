import { useCallback } from "react";

import { listAllAppointments } from "@/features/appointments/api";
import { computeRange } from "@/features/appointments/agenda/agendaRange";
import type { AgendaState } from "@/features/appointments/agenda/agendaUrl";
import { listEmployees } from "@/features/employees/api";
import { listAllSchedules } from "@/features/scheduling/api";
import { listServices } from "@/features/services/api";
import { useAsyncResource, type AsyncState } from "@/hooks/useAsyncResource";
import { parseISODate, toISODate } from "@/lib/dates";
import { MAX_PAGE_SIZE, fetchAllPages, type AllPagesResult } from "@/lib/pagination";
import type { Appointment } from "@/types/appointment";
import type { Schedule } from "@/types/schedule";
import type { Employee, Service } from "@/types/service";

/** Vista «por profesional» sin profesional elegido: no hay nada que consultar todavía. */
export function needsEmployee(state: AgendaState): boolean {
  return state.view === "professional" && !state.employee;
}

/** Resultado de la consulta de citas, etiquetado con la consulta que lo produjo. */
export interface AgendaAppointments extends AllPagesResult<Appointment> {
  queryKey: string;
}

/**
 * Citas del período visible con los filtros activos. Descarta respuestas antiguas si el usuario
 * cambia de fecha o de filtros mientras hay una petición en curso (useAsyncResource).
 *
 * Los datos de una consulta anterior se conservan mientras se recarga la MISMA consulta (evita
 * parpadeos tras una acción), pero si ya no corresponden al período/filtros actuales se tratan como
 * «cargando»: así nada decide (p. ej. cerrar el panel de una cita) a partir de una lista que no es la actual.
 */
export function useAgendaAppointments(state: AgendaState): [AsyncState<AgendaAppointments>, () => void] {
  const range = computeRange(state.view, parseISODate(state.date));
  const from = toISODate(range.from);
  const to = toISODate(range.to);
  const statusFilter = state.statuses.join(",");
  const queryKey = [from, to, state.employee, state.service, statusFilter].join("|");

  const load = useCallback(
    () =>
      listAllAppointments({
        appointment_date__gte: from,
        appointment_date__lte: to,
        employee: state.employee || undefined,
        service: state.service || undefined,
        status__in: statusFilter || undefined,
      }).then((result) => ({ ...result, queryKey })),
    [from, to, state.employee, state.service, statusFilter, queryKey]
  );

  const [resource, reload] = useAsyncResource(load, !needsEmployee(state));
  const isStale = resource.status === "ready" && resource.data.queryKey !== queryKey;
  return [isStale ? { status: "loading" } : resource, reload];
}

const loadEmployees = () =>
  fetchAllPages((page) => listEmployees({ page, page_size: MAX_PAGE_SIZE, is_active: true })).then((result) => result.results);
const loadServices = () =>
  fetchAllPages((page) => listServices({ page, page_size: MAX_PAGE_SIZE, ordering: "name" })).then((result) => result.results);
const loadSchedules = () => listAllSchedules().then((result) => result.results);

/** Catálogos para filtros y rejilla. Cada uno falla de forma independiente (p. ej. sin permiso). */
export function useAgendaCatalogs(): {
  employees: AsyncState<Employee[]>;
  services: AsyncState<Service[]>;
  schedules: AsyncState<Schedule[]>;
} {
  const [employees] = useAsyncResource(useCallback(loadEmployees, []));
  const [services] = useAsyncResource(useCallback(loadServices, []));
  const [schedules] = useAsyncResource(useCallback(loadSchedules, []));
  return { employees, services, schedules };
}

export function dataOrEmpty<T>(state: AsyncState<T[]>): T[] {
  return state.status === "ready" ? state.data : [];
}
