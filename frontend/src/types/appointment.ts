export type AppointmentStatus =
  | "pending"
  | "confirmed"
  | "waiting"
  | "in_progress"
  | "completed"
  | "cancelled"
  | "no_show"
  | "rescheduled";

export interface Appointment {
  id: string;
  branch: string;
  customer: string;
  service: string;
  employee: string;
  appointment_date: string;
  start_time: string;
  end_time: string;
  duration_minutes: number;
  status: AppointmentStatus;
  notes: string;
  price: string;
  payment_status: string;
  booking_channel: string;
}

export interface CreateAppointmentPayload {
  customer_id: string;
  service_id: string;
  employee_id: string;
  branch_id: string;
  appointment_date: string;
  start_time: string;
  notes?: string;
  booking_channel?: string;
  requires_confirmation?: boolean;
}

export interface AvailabilitySlot {
  employee_id: string;
  start_time: string;
  end_time: string;
}

export interface AvailabilityResponse {
  service_id: string;
  branch_id: string;
  date: string;
  slots: AvailabilitySlot[];
}

export const STATUS_LABELS: Record<AppointmentStatus, string> = {
  pending: "Pendiente",
  confirmed: "Confirmada",
  waiting: "En espera",
  in_progress: "En proceso",
  completed: "Completada",
  cancelled: "Cancelada",
  no_show: "No asistió",
  rescheduled: "Reprogramada",
};
