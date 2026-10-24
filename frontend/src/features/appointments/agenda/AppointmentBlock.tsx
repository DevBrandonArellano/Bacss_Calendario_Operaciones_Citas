import { describeAppointment, shortTime } from "@/features/appointments/agenda/describeAppointment";
import { APPOINTMENT_STATUS_STYLE } from "@/features/appointments/status";
import type { PositionedBlock } from "@/features/appointments/agenda/timeGrid";
import { cn } from "@/lib/cn";
import type { Appointment } from "@/types/appointment";

const LANE_GAP_PERCENT = 1.5;
const TWO_LINES_MIN_HEIGHT = 40;
const THREE_LINES_MIN_HEIGHT = 62;

interface AppointmentBlockProps {
  block: PositionedBlock<Appointment>;
  selected: boolean;
  showEmployee: boolean;
  onSelect: (appointment: Appointment) => void;
}

/**
 * Bloque de calendario: alto proporcional a la duración; en bloques pequeños muestra solo lo
 * esencial y el resto se consulta en el panel de detalle. El estado se indica con color,
 * icono y texto (nunca solo color).
 */
export function AppointmentBlock({ block, selected, showEmployee, onSelect }: AppointmentBlockProps) {
  const { appointment, top, height, lane, lanes } = block;
  const style = APPOINTMENT_STATUS_STYLE[appointment.status];
  const Icon = style.icon;
  const laneWidth = 100 / lanes;

  return (
    <button
      type="button"
      onClick={(event) => {
        event.stopPropagation();
        onSelect(appointment);
      }}
      aria-label={describeAppointment(appointment)}
      title={describeAppointment(appointment)}
      className={cn(
        "absolute flex min-h-0 flex-col items-start justify-start gap-0.5 overflow-hidden rounded-lg border-0 border-l-4 px-2 py-1 text-left text-xs leading-tight shadow-none transition-shadow hover:bg-subtle hover:shadow-card",
        style.block,
        selected && "ring-2 ring-brand ring-offset-1 ring-offset-surface"
      )}
      style={{
        top,
        height: height - 2,
        left: `${lane * laneWidth + 0.5}%`,
        width: `${laneWidth - LANE_GAP_PERCENT}%`,
      }}
    >
      <span className="flex w-full items-center gap-1 font-semibold">
        <Icon className="size-3 shrink-0" aria-hidden="true" />
        <span className="truncate">
          {height >= TWO_LINES_MIN_HEIGHT
            ? `${shortTime(appointment.start_time)} – ${shortTime(appointment.end_time)}`
            : `${shortTime(appointment.start_time)} ${appointment.customer_name}`}
        </span>
      </span>
      {height >= TWO_LINES_MIN_HEIGHT && <span className="w-full truncate font-medium">{appointment.customer_name}</span>}
      {height >= THREE_LINES_MIN_HEIGHT && (
        <span className="w-full truncate opacity-90">
          {appointment.service_name}
          {showEmployee ? ` · ${appointment.employee_name}` : ""}
        </span>
      )}
    </button>
  );
}
