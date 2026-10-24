import { apiClient } from "@/api/client";
import { MAX_PAGE_SIZE, fetchAllPages, type AllPagesResult } from "@/lib/pagination";
import type { Paginated } from "@/types/api";
import type {
  Appointment,
  AvailabilityResponse,
  CreateAppointmentPayload,
} from "@/types/appointment";

export interface ListAppointmentsParams {
  appointment_date__gte?: string;
  appointment_date__lte?: string;
  employee?: string;
  branch?: string;
  customer?: string;
  service?: string;
  status?: string;
  /** Lista de estados separados por coma, p. ej. «pending,confirmed». */
  status__in?: string;
  page?: number;
  page_size?: number;
}

export async function listAppointments(params: ListAppointmentsParams): Promise<Paginated<Appointment>> {
  const response = await apiClient.get<Paginated<Appointment>>("/appointments/", { params });
  return response.data;
}

/** Todas las citas de un rango (recorre las páginas): una semana o un mes superan los 20 por página. */
export async function listAllAppointments(
  params: Omit<ListAppointmentsParams, "page" | "page_size">
): Promise<AllPagesResult<Appointment>> {
  return fetchAllPages((page) => listAppointments({ ...params, page, page_size: MAX_PAGE_SIZE }));
}

export async function updateAppointmentNotes(id: string, notes: string): Promise<Appointment> {
  const response = await apiClient.patch<Appointment>(`/appointments/${id}/notes/`, { notes });
  return response.data;
}

export async function createAppointment(payload: CreateAppointmentPayload): Promise<Appointment> {
  const response = await apiClient.post<Appointment>("/appointments/", payload);
  return response.data;
}

export async function confirmAppointment(id: string): Promise<Appointment> {
  const response = await apiClient.post<Appointment>(`/appointments/${id}/confirm/`);
  return response.data;
}

export async function startAppointment(id: string): Promise<Appointment> {
  const response = await apiClient.post<Appointment>(`/appointments/${id}/start/`);
  return response.data;
}

export async function completeAppointment(id: string): Promise<Appointment> {
  const response = await apiClient.post<Appointment>(`/appointments/${id}/complete/`);
  return response.data;
}

export async function markNoShow(id: string): Promise<Appointment> {
  const response = await apiClient.post<Appointment>(`/appointments/${id}/no-show/`);
  return response.data;
}

export async function cancelAppointment(id: string, reason: string): Promise<Appointment> {
  const response = await apiClient.post<Appointment>(`/appointments/${id}/cancel/`, { reason });
  return response.data;
}

export async function rescheduleAppointment(
  id: string,
  appointment_date: string,
  start_time: string
): Promise<Appointment> {
  const response = await apiClient.post<Appointment>(`/appointments/${id}/reschedule/`, {
    appointment_date,
    start_time,
  });
  return response.data;
}

export async function getAvailability(params: {
  service_id: string;
  branch_id: string;
  date: string;
  employee_id?: string;
}): Promise<AvailabilityResponse> {
  const response = await apiClient.get<AvailabilityResponse>("/availability/", { params });
  return response.data;
}
