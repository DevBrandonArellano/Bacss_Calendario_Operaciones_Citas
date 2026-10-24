import { workingSegments, type Segment } from "@/features/appointments/agenda/timeGrid";
import type { Schedule } from "@/types/schedule";
import type { Employee } from "@/types/service";

/** Une tramos solapados o contiguos. */
export function mergeSegments(segments: Segment[]): Segment[] {
  const sorted = [...segments].sort((a, b) => a.start - b.start);
  const merged: Segment[] = [];
  for (const segment of sorted) {
    const last = merged[merged.length - 1];
    if (last && segment.start <= last.end) last.end = Math.max(last.end, segment.end);
    else merged.push({ ...segment });
  }
  return merged;
}

/**
 * Horario que se dibuja para un profesional: el suyo propio si lo tiene; si no, el de su
 * sucursal. (El motor de disponibilidad además cruza ambos; aquí basta con una guía visual.)
 */
export function effectiveSchedules(schedules: Schedule[], employee: Employee): Schedule[] {
  const own = schedules.filter((s) => s.employee === employee.id);
  if (own.length > 0) return own;
  if (!employee.branch) return [];
  return schedules.filter((s) => s.employee === null && s.branch === employee.branch);
}

/**
 * Tramos laborales de un día de la semana (0 = lunes) para una columna del calendario.
 * - `schedules === null`: horario desconocido → `null` (no se sombrea nada).
 * - `employeeId`: solo los tramos de ese profesional.
 * - sin `employeeId`: unión de los tramos de todos los profesionales (cada uno con sus descansos).
 */
export function segmentsForColumn(
  schedules: Schedule[] | null,
  employees: Employee[],
  weekday: number,
  employeeId?: string
): Segment[] | null {
  if (schedules === null) return null;

  const targets = employeeId ? employees.filter((e) => e.id === employeeId) : employees;
  if (targets.length === 0) {
    // Sin lista de profesionales: se usa el horario de sucursal que haya.
    return mergeSegments(workingSegments(schedules.filter((s) => s.employee === null), weekday));
  }

  return mergeSegments(targets.flatMap((target) => workingSegments(effectiveSchedules(schedules, target), weekday)));
}

/** Horarios que determinan la ventana horaria visible: los del profesional filtrado o todos. */
export function schedulesForWindow(schedules: Schedule[], employees: Employee[], employeeId: string): Schedule[] {
  if (!employeeId) return schedules;
  const employee = employees.find((e) => e.id === employeeId);
  return employee ? effectiveSchedules(schedules, employee) : schedules.filter((s) => s.employee === employeeId);
}
