import { describe, expect, it } from "vitest";

import { buildSlotGroups } from "@/features/appointments/slots";
import type { AvailabilitySlot } from "@/types/appointment";

const slot = (employee: string, start: string, end = "00:00:00"): AvailabilitySlot => ({
  employee_id: employee,
  start_time: `${start}:00`,
  end_time: end,
});

describe("buildSlotGroups", () => {
  it("agrupa los horarios por profesional", () => {
    const groups = buildSlotGroups([slot("e1", "09:00"), slot("e2", "09:00"), slot("e1", "09:15")]);
    expect(groups.map((g) => g.employeeId)).toEqual(["e1", "e2"]);
    expect(groups[0].options.filter((o) => o.available)).toHaveLength(2);
  });

  it("marca como ocupados los huecos entre horarios disponibles", () => {
    const [group] = buildSlotGroups([slot("e1", "09:00"), slot("e1", "09:45")]);
    expect(group.options.map((o) => [o.startTime, o.available])).toEqual([
      ["09:00", true],
      ["09:15", false],
      ["09:30", false],
      ["09:45", true],
    ]);
  });

  it("ordena los horarios cronológicamente aunque lleguen desordenados", () => {
    const [group] = buildSlotGroups([slot("e1", "10:00"), slot("e1", "09:00")]);
    const available = group.options.filter((o) => o.available).map((o) => o.startTime);
    expect(available).toEqual(["09:00", "10:00"]);
  });

  it("sin horarios devuelve una lista vacía", () => {
    expect(buildSlotGroups([])).toEqual([]);
  });

  it("respeta un paso distinto de 15 minutos", () => {
    const [group] = buildSlotGroups([slot("e1", "09:00"), slot("e1", "10:00")], 30);
    expect(group.options.map((o) => o.startTime)).toEqual(["09:00", "09:30", "10:00"]);
  });
});
