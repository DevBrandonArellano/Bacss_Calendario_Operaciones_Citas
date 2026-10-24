import { describe, expect, it } from "vitest";

import {
  effectiveSchedules,
  mergeSegments,
  schedulesForWindow,
  segmentsForColumn,
} from "@/features/appointments/agenda/scheduleSegments";
import type { Schedule } from "@/types/schedule";
import type { Employee } from "@/types/service";

const schedule = (overrides: Partial<Schedule>): Schedule => ({
  id: Math.random().toString(),
  branch: null,
  employee: null,
  weekday: 0,
  start_time: "09:00:00",
  end_time: "17:00:00",
  is_break: false,
  ...overrides,
});

const employee = (id: string, branch: string | null = "b1"): Employee => ({
  id,
  user: null,
  branch,
  first_name: id,
  last_name: "",
  full_name: id,
  specialty: "",
  is_active: true,
  services: [],
});

describe("mergeSegments", () => {
  it("une tramos que se solapan o se tocan", () => {
    expect(
      mergeSegments([
        { start: 540, end: 600 },
        { start: 590, end: 700 },
        { start: 700, end: 720 },
        { start: 800, end: 900 },
      ])
    ).toEqual([
      { start: 540, end: 720 },
      { start: 800, end: 900 },
    ]);
  });

  it("sin tramos devuelve vacío", () => {
    expect(mergeSegments([])).toEqual([]);
  });
});

describe("effectiveSchedules", () => {
  const all = [
    schedule({ branch: "b1", start_time: "08:00:00", end_time: "18:00:00" }),
    schedule({ employee: "e1", start_time: "10:00:00", end_time: "14:00:00" }),
  ];

  it("usa el horario propio del profesional si lo tiene", () => {
    expect(effectiveSchedules(all, employee("e1"))).toHaveLength(1);
    expect(effectiveSchedules(all, employee("e1"))[0].employee).toBe("e1");
  });

  it("si no tiene horario propio usa el de su sucursal", () => {
    const result = effectiveSchedules(all, employee("e2", "b1"));
    expect(result).toHaveLength(1);
    expect(result[0].branch).toBe("b1");
  });

  it("sin sucursal ni horario propio no hay horario", () => {
    expect(effectiveSchedules(all, employee("e3", null))).toEqual([]);
  });
});

describe("segmentsForColumn", () => {
  const schedules = [
    schedule({ employee: "e1", start_time: "09:00:00", end_time: "13:00:00" }),
    schedule({ employee: "e2", start_time: "12:00:00", end_time: "18:00:00" }),
  ];
  const employees = [employee("e1"), employee("e2")];

  it("un profesional concreto usa solo sus tramos", () => {
    expect(segmentsForColumn(schedules, employees, 0, "e1")).toEqual([{ start: 540, end: 780 }]);
  });

  it("sin profesional concreto es la unión de quienes trabajan ese día", () => {
    expect(segmentsForColumn(schedules, employees, 0)).toEqual([{ start: 540, end: 1080 }]);
  });

  it("devuelve null cuando el horario se desconoce (no se sombrea nada)", () => {
    expect(segmentsForColumn(null, employees, 0)).toBeNull();
  });

  it("un día sin horario devuelve lista vacía (día no laborable)", () => {
    expect(segmentsForColumn(schedules, employees, 3)).toEqual([]);
  });

  it("un descanso de un profesional no recorta el horario de otro", () => {
    const withBreak = [
      schedule({ employee: "e1", start_time: "09:00:00", end_time: "17:00:00" }),
      schedule({ employee: "e1", start_time: "12:00:00", end_time: "13:00:00", is_break: true }),
      schedule({ employee: "e2", start_time: "09:00:00", end_time: "17:00:00" }),
    ];
    expect(segmentsForColumn(withBreak, employees, 0)).toEqual([{ start: 540, end: 1020 }]);
  });
});

describe("schedulesForWindow", () => {
  const all = [schedule({ branch: "b1" }), schedule({ employee: "e1" }), schedule({ employee: "e9" })];

  it("sin profesional filtrado usa todos los horarios", () => {
    expect(schedulesForWindow(all, [employee("e1")], "")).toHaveLength(3);
  });

  it("con un profesional conocido usa sus horarios efectivos", () => {
    expect(schedulesForWindow(all, [employee("e1")], "e1")).toEqual([all[1]]);
  });

  it("con un profesional que aún no cargó usa sus horarios propios sin romper", () => {
    expect(schedulesForWindow(all, [], "e9")).toEqual([all[2]]);
  });
});
