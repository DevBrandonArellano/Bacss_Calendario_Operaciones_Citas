import { formatMinutes, minutesOfDay } from "@/features/appointments/agenda/timeGrid";
import type { AvailabilitySlot } from "@/types/appointment";

/** Paso del motor de disponibilidad (`DEFAULT_SLOT_STEP_MINUTES` en el backend). */
export const SLOT_STEP_MINUTES = 15;

export interface SlotOption {
  /** «HH:MM». */
  startTime: string;
  available: boolean;
  slot?: AvailabilitySlot;
}

export interface SlotGroup {
  employeeId: string;
  options: SlotOption[];
}

/**
 * Agrupa los horarios libres por profesional y rellena los huecos intermedios como «ocupados», para
 * que el usuario vea claramente qué horas no están disponibles (el backend solo devuelve las libres).
 */
export function buildSlotGroups(slots: AvailabilitySlot[], step: number = SLOT_STEP_MINUTES): SlotGroup[] {
  const byEmployee = new Map<string, AvailabilitySlot[]>();
  for (const slot of slots) {
    const list = byEmployee.get(slot.employee_id) ?? [];
    list.push(slot);
    byEmployee.set(slot.employee_id, list);
  }

  return [...byEmployee.entries()].map(([employeeId, employeeSlots]) => {
    const byStart = new Map(employeeSlots.map((slot) => [minutesOfDay(slot.start_time), slot]));
    const starts = [...byStart.keys()].sort((a, b) => a - b);
    const options: SlotOption[] = [];
    for (let minutes = starts[0]; minutes <= starts[starts.length - 1]; minutes += step) {
      const slot = byStart.get(minutes);
      options.push({ startTime: formatMinutes(minutes), available: Boolean(slot), slot });
    }
    return { employeeId, options };
  });
}
