import { APPOINTMENT_STATUS_STYLE } from "@/features/appointments/status";
import type { Appointment } from "@/types/appointment";

export function shortTime(time: string): string {
  return time.slice(0, 5);
}

/** Texto completo, usado como nombre accesible y tooltip nativo (el bloque puede ser pequeño). */
export function describeAppointment(appointment: Appointment): string {
  const style = APPOINTMENT_STATUS_STYLE[appointment.status];
  return `${shortTime(appointment.start_time)} a ${shortTime(appointment.end_time)}, ${appointment.customer_name}, ${appointment.service_name}, con ${appointment.employee_name}, ${style.label}`;
}
