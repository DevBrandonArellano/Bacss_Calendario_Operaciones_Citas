import { DayHeader, EmployeeHeader } from "@/features/appointments/agenda/ColumnHeader";
import { segmentsForColumn } from "@/features/appointments/agenda/scheduleSegments";
import { TimeGridView, type GridColumn } from "@/features/appointments/agenda/TimeGridView";
import type { AgendaViewProps } from "@/features/appointments/agenda/viewTypes";
import { toISODate } from "@/lib/dates";

const MIN_COLUMN_REM_MULTI = 11;
const MIN_COLUMN_REM_SINGLE = 16;

/**
 * Un día con una columna por profesional (vista de recursos): permite ver a la vez quién está
 * libre y quién ocupado. Con un solo profesional (o sin lista) usa una columna ancha.
 */
export function DayView({
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
}: AgendaViewProps) {
  const iso = toISODate(date);
  const weekday = (date.getDay() + 6) % 7;
  const shown = employeeFilter ? employees.filter((e) => e.id === employeeFilter) : employees;

  // Citas de profesionales que ya no están activos (o catálogo no disponible) no deben perderse.
  const knownIds = new Set(shown.map((e) => e.id));
  const orphaned = appointments.filter((a) => !knownIds.has(a.employee));
  const useEmployeeColumns = shown.length > 1;

  const columns: GridColumn[] = useEmployeeColumns
    ? shown.map((employee) => {
        const own = appointments.filter((a) => a.employee === employee.id);
        return {
          key: employee.id,
          date: iso,
          employeeId: employee.id,
          appointments: own,
          workingSegments: segmentsForColumn(schedules, employees, weekday, employee.id),
          header: <EmployeeHeader name={employee.full_name} specialty={employee.specialty} count={own.length} />,
        };
      })
    : [
        {
          key: iso,
          date: iso,
          employeeId: shown[0]?.id,
          appointments,
          workingSegments: segmentsForColumn(schedules, employees, weekday, shown[0]?.id),
          header: <DayHeader date={date} isToday={iso === now.date} count={appointments.length} />,
        },
      ];

  if (useEmployeeColumns && orphaned.length > 0) {
    columns.push({
      key: "otros",
      date: iso,
      appointments: orphaned,
      workingSegments: null,
      header: <EmployeeHeader name="Otros" specialty="Profesionales no listados" count={orphaned.length} />,
    });
  }

  return (
    <TimeGridView
      columns={columns}
      window={window}
      now={now}
      scrollKey={`day-${iso}-${employeeFilter}`}
      showEmployee={!useEmployeeColumns && new Set(appointments.map((a) => a.employee)).size > 1}
      selectedId={selectedId}
      minColumnWidthRem={useEmployeeColumns ? MIN_COLUMN_REM_MULTI : MIN_COLUMN_REM_SINGLE}
      onSelect={onSelect}
      onSlotSelect={onSlotSelect}
    />
  );
}
