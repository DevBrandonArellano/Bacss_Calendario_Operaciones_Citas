import { DayHeader } from "@/features/appointments/agenda/ColumnHeader";
import { segmentsForColumn } from "@/features/appointments/agenda/scheduleSegments";
import { TimeGridView, type GridColumn } from "@/features/appointments/agenda/TimeGridView";
import type { AgendaViewProps } from "@/features/appointments/agenda/viewTypes";
import { addDays, startOfWeek, toISODate } from "@/lib/dates";

const MIN_COLUMN_REM = 9;

/**
 * Semana de un profesional concreto: sus citas, su horario laboral (lo que queda fuera aparece
 * sombreado) y, por tanto, sus huecos libres. El profesional lo elige la barra de filtros.
 */
export function ProfessionalView({
  date,
  appointments,
  employees,
  schedules,
  window,
  now,
  selectedId,
  employeeFilter,
  onSelect,
  onSlotSelect,
  onOpenDay,
}: AgendaViewProps) {
  const monday = startOfWeek(date);

  const columns: GridColumn[] = Array.from({ length: 7 }, (_, offset) => {
    const day = addDays(monday, offset);
    const iso = toISODate(day);
    const dayAppointments = appointments.filter((a) => a.appointment_date === iso);
    return {
      key: iso,
      date: iso,
      employeeId: employeeFilter,
      appointments: dayAppointments,
      workingSegments: segmentsForColumn(schedules, employees, offset, employeeFilter),
      header: <DayHeader date={day} isToday={iso === now.date} count={dayAppointments.length} onOpen={() => onOpenDay(iso)} />,
    };
  });

  return (
    <TimeGridView
      columns={columns}
      window={window}
      now={now}
      scrollKey={`professional-${employeeFilter}-${toISODate(monday)}`}
      showEmployee={false}
      selectedId={selectedId}
      minColumnWidthRem={MIN_COLUMN_REM}
      onSelect={onSelect}
      onSlotSelect={onSlotSelect}
    />
  );
}
