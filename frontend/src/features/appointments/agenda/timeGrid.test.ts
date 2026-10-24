import { describe, expect, it } from "vitest";

import {
  PIXELS_PER_MINUTE,
  computeVisibleHours,
  layoutColumn,
  minutesAtOffset,
  minutesOfDay,
  nonWorkingSegments,
  workingSegments,
} from "@/features/appointments/agenda/timeGrid";
import type { Schedule } from "@/types/schedule";

function appointment(id: string, start: string, end: string) {
  return { id, start_time: `${start}:00`, end_time: `${end}:00` };
}

describe("minutesOfDay", () => {
  it("convierte HH:MM y HH:MM:SS a minutos desde medianoche", () => {
    expect(minutesOfDay("00:00")).toBe(0);
    expect(minutesOfDay("09:30")).toBe(570);
    expect(minutesOfDay("17:45:00")).toBe(1065);
  });
});

describe("layoutColumn", () => {
  const window = { startMinute: 8 * 60, endMinute: 18 * 60 };

  it("la altura es proporcional a la duración de la cita", () => {
    const [short, long] = layoutColumn([appointment("a", "09:00", "09:30"), appointment("b", "11:00", "13:00")], window);
    expect(short.height).toBe(30 * PIXELS_PER_MINUTE);
    expect(long.height).toBe(120 * PIXELS_PER_MINUTE);
  });

  it("la posición vertical es relativa al inicio de la ventana visible", () => {
    const [block] = layoutColumn([appointment("a", "09:00", "10:00")], window);
    expect(block.top).toBe(60 * PIXELS_PER_MINUTE);
  });

  it("citas que no se solapan comparten carril único", () => {
    const blocks = layoutColumn([appointment("a", "09:00", "09:30"), appointment("b", "09:30", "10:00")], window);
    expect(blocks.map((b) => [b.lane, b.lanes])).toEqual([
      [0, 1],
      [0, 1],
    ]);
  });

  it("citas solapadas se reparten en carriles lado a lado sin pisarse", () => {
    const blocks = layoutColumn([appointment("a", "09:00", "10:00"), appointment("b", "09:30", "10:30")], window);
    expect(blocks.map((b) => [b.lane, b.lanes])).toEqual([
      [0, 2],
      [1, 2],
    ]);
  });

  it("un grupo de solapes no obliga a estrechar citas posteriores independientes", () => {
    const blocks = layoutColumn(
      [appointment("a", "09:00", "10:00"), appointment("b", "09:15", "10:15"), appointment("c", "11:00", "12:00")],
      window
    );
    expect(blocks.find((b) => b.appointment.id === "c")).toMatchObject({ lane: 0, lanes: 1 });
  });

  it("recorta lo que queda fuera de la ventana visible", () => {
    const [block] = layoutColumn([appointment("a", "07:00", "09:00")], window);
    expect(block.top).toBe(0);
    expect(block.height).toBe(60 * PIXELS_PER_MINUTE);
  });
});

describe("computeVisibleHours", () => {
  const schedule = (start: string, end: string, extra: Partial<Schedule> = {}): Schedule => ({
    id: "s",
    branch: "b1",
    employee: null,
    weekday: 0,
    start_time: `${start}:00`,
    end_time: `${end}:00`,
    is_break: false,
    ...extra,
  });

  it("sin datos usa un horario por defecto", () => {
    expect(computeVisibleHours([], [])).toEqual({ startMinute: 8 * 60, endMinute: 19 * 60 });
  });

  it("se ajusta a los horarios laborales, con una hora de margen redondeada", () => {
    const window = computeVisibleHours([schedule("09:00", "17:00")], []);
    expect(window).toEqual({ startMinute: 8 * 60, endMinute: 18 * 60 });
  });

  it("se amplía para incluir citas fuera del horario laboral", () => {
    const window = computeVisibleHours([schedule("09:00", "17:00")], [appointment("a", "06:30", "07:00"), appointment("b", "20:00", "21:30")]);
    expect(window.startMinute).toBeLessThanOrEqual(6 * 60);
    expect(window.endMinute).toBeGreaterThanOrEqual(22 * 60);
  });

  it("ignora los descansos al calcular la ventana", () => {
    const window = computeVisibleHours([schedule("09:00", "17:00"), schedule("04:00", "05:00", { is_break: true })], []);
    expect(window.startMinute).toBe(8 * 60);
  });
});

describe("workingSegments", () => {
  const base = { id: "x", is_break: false, employee: null as string | null, branch: "b1" as string | null };

  it("devuelve el tramo laboral del día de la semana pedido", () => {
    const schedules: Schedule[] = [
      { ...base, weekday: 0, start_time: "09:00:00", end_time: "17:00:00" },
      { ...base, weekday: 1, start_time: "10:00:00", end_time: "14:00:00" },
    ];
    expect(workingSegments(schedules, 0)).toEqual([{ start: 540, end: 1020 }]);
  });

  it("resta los descansos del tramo laboral", () => {
    const schedules: Schedule[] = [
      { ...base, weekday: 0, start_time: "09:00:00", end_time: "17:00:00" },
      { ...base, weekday: 0, start_time: "13:00:00", end_time: "14:00:00", is_break: true },
    ];
    expect(workingSegments(schedules, 0)).toEqual([
      { start: 540, end: 780 },
      { start: 840, end: 1020 },
    ]);
  });

  it("devuelve vacío si el día no tiene horario", () => {
    expect(workingSegments([], 3)).toEqual([]);
  });
});

describe("nonWorkingSegments", () => {
  const window = { startMinute: 8 * 60, endMinute: 18 * 60 };

  it("devuelve lo que queda antes, entre y después de los tramos laborales", () => {
    const result = nonWorkingSegments(
      [
        { start: 9 * 60, end: 13 * 60 },
        { start: 14 * 60, end: 17 * 60 },
      ],
      window
    );
    expect(result).toEqual([
      { start: 8 * 60, end: 9 * 60 },
      { start: 13 * 60, end: 14 * 60 },
      { start: 17 * 60, end: 18 * 60 },
    ]);
  });

  it("un día sin tramos laborales queda completamente fuera de horario", () => {
    expect(nonWorkingSegments([], window)).toEqual([{ start: 8 * 60, end: 18 * 60 }]);
  });

  it("un tramo que cubre toda la ventana no deja nada fuera de horario", () => {
    expect(nonWorkingSegments([{ start: 7 * 60, end: 19 * 60 }], window)).toEqual([]);
  });
});

describe("minutesAtOffset", () => {
  const window = { startMinute: 8 * 60, endMinute: 18 * 60 };

  it("convierte la posición vertical a minutos, ajustados a bloques de 30 min", () => {
    expect(minutesAtOffset(0, window)).toBe(8 * 60);
    expect(minutesAtOffset(75 * PIXELS_PER_MINUTE, window)).toBe(9 * 60);
    expect(minutesAtOffset(95 * PIXELS_PER_MINUTE, window)).toBe(9 * 60 + 30);
  });

  it("nunca sale de la ventana visible", () => {
    expect(minutesAtOffset(-50, window)).toBe(8 * 60);
    expect(minutesAtOffset(100000, window)).toBe(17 * 60 + 30);
  });
});
