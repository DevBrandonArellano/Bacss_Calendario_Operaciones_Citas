import { CalendarDays, Clock, Scissors, User } from "lucide-react";

import { AppointmentStatusBadge } from "@/features/appointments/AppointmentStatusBadge";
import { formatLongDate } from "@/lib/dates";
import type { Appointment } from "@/types/appointment";

/** Resumen compacto de una cita, reutilizado en los diálogos de cancelar y reprogramar. */
export function AppointmentSummary({ appointment }: { appointment: Appointment }) {
  return (
    <div className="flex flex-col gap-2 rounded-xl border border-line bg-subtle p-4 text-sm">
      <div className="flex items-center justify-between gap-3">
        <span className="flex items-center gap-2 font-semibold text-ink">
          <User className="size-4 text-muted" aria-hidden="true" />
          {appointment.customer_name}
        </span>
        <AppointmentStatusBadge status={appointment.status} />
      </div>
      <span className="flex items-center gap-2 text-muted">
        <Scissors className="size-4" aria-hidden="true" />
        {appointment.service_name} · {appointment.employee_name}
      </span>
      <span className="flex items-center gap-2 text-muted">
        <CalendarDays className="size-4" aria-hidden="true" />
        {formatLongDate(appointment.appointment_date)}
      </span>
      <span className="flex items-center gap-2 text-muted">
        <Clock className="size-4" aria-hidden="true" />
        {appointment.start_time.slice(0, 5)} – {appointment.end_time.slice(0, 5)} ({appointment.duration_minutes} min)
      </span>
    </div>
  );
}
