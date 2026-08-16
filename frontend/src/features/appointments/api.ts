import { apiClient } from "@/api/client";
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
  status?: string;
  page?: number;
}

export async function listAppointments(params: ListAppointmentsParams): Promise<Paginated<Appointment>> {
  const response = await apiClient.get<Paginated<Appointment>>("/appointments/", { params });
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
