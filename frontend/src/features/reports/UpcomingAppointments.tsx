import { Link } from "react-router-dom";

import { AppointmentStatusBadge } from "@/features/appointments/AppointmentStatusBadge";
import { agendaLink } from "@/features/appointments/agenda/agendaUrl";
import { formatDayMonth } from "@/lib/dates";
import type { Appointment } from "@/types/appointment";

interface UpcomingAppointmentsProps {
  appointments: Appointment[];
  today: string;
}

/** Próximas citas: hora, cliente, servicio, profesional, estado y acceso al detalle en la Agenda. */
export function UpcomingAppointments({ appointments, today }: UpcomingAppointmentsProps) {
  return (
    <ul className="m-0 flex list-none flex-col divide-y divide-line p-0">
      {appointments.map((appointment) => (
        <li key={appointment.id} className="flex flex-wrap items-center gap-x-4 gap-y-2 py-3 first:pt-0 last:pb-0">
          <div className="w-16 shrink-0">
            <p className="m-0 text-sm font-bold tabular-nums text-ink">{appointment.start_time.slice(0, 5)}</p>
            <p className="m-0 text-xs text-muted">
              {appointment.appointment_date === today ? "Hoy" : formatDayMonth(appointment.appointment_date)}
            </p>
          </div>
          <div className="min-w-0 flex-1">
            <p className="m-0 truncate text-sm font-semibold text-ink">{appointment.customer_name}</p>
            <p className="m-0 truncate text-xs text-muted">
              {appointment.service_name} · {appointment.employee_name}
            </p>
          </div>
          <AppointmentStatusBadge status={appointment.status} />
          <Link
            to={agendaLink({ view: "day", date: appointment.appointment_date, appointment: appointment.id })}
            className="text-sm font-medium"
            aria-label={`Ver detalle de la cita de ${appointment.customer_name}`}
          >
            Ver
          </Link>
        </li>
      ))}
    </ul>
  );
}
