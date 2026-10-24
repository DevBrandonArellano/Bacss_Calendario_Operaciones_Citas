import { DayHeader } from "@/features/appointments/agenda/ColumnHeader";
import { segmentsForColumn } from "@/features/appointments/agenda/scheduleSegments";
import { TimeGridView, type GridColumn } from "@/features/appointments/agenda/TimeGridView";
import type { AgendaViewProps } from "@/features/appointments/agenda/viewTypes";
import { addDays, startOfWeek, toISODate } from "@/lib/dates";

const MIN_COLUMN_REM = 9;

/** Siete columnas (lunes a domingo). En pantallas estrechas se desplaza en horizontal, sin comprimirse. */
export function WeekView({
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
  const visibleEmployeeCount = new Set(appointments.map((a) => a.employee)).size;

  const columns: GridColumn[] = Array.from({ length: 7 }, (_, offset) => {
    const day = addDays(monday, offset);
    const iso = toISODate(day);
    const dayAppointments = appointments.filter((a) => a.appointment_date === iso);
    return {
      key: iso,
      date: iso,
      employeeId: employeeFilter || undefined,
      appointments: dayAppointments,
      workingSegments: segmentsForColumn(schedules, employees, offset, employeeFilter || undefined),
      header: <DayHeader date={day} isToday={iso === now.date} count={dayAppointments.length} onOpen={() => onOpenDay(iso)} />,
    };
  });

  return (
    <TimeGridView
      columns={columns}
      window={window}
      now={now}
      scrollKey={`week-${toISODate(monday)}`}
      showEmployee={!employeeFilter && visibleEmployeeCount > 1}
      selectedId={selectedId}
      minColumnWidthRem={MIN_COLUMN_REM}
      onSelect={onSelect}
      onSlotSelect={onSlotSelect}
    />
  );
}
