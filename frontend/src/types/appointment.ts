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
  branch_name: string;
  customer: string;
  customer_name: string;
  service: string;
  service_name: string;
  employee: string;
  employee_name: string;
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

export const PAYMENT_STATUS_LABELS: Record<string, string> = {
  unpaid: "Sin pagar",
  partial: "Pago parcial",
  paid: "Pagada",
  refunded: "Reembolsada",
};

export const BOOKING_CHANNEL_LABELS: Record<string, string> = {
  online: "Reserva online",
  staff: "Personal del negocio",
  phone: "Teléfono",
  api: "Integración externa",
};
