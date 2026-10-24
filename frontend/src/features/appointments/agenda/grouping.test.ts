import { describe, expect, it } from "vitest";

import { groupByDate, monthMatrix } from "@/features/appointments/agenda/grouping";
import { toISODate } from "@/lib/dates";

const item = (id: string, date: string, start: string) => ({ id, appointment_date: date, start_time: `${start}:00` });

describe("groupByDate", () => {
  it("agrupa por día y ordena cada día por hora de inicio", () => {
    const grouped = groupByDate([
      item("c", "2026-10-26", "15:00"),
      item("a", "2026-10-26", "09:00"),
      item("b", "2026-10-27", "08:00"),
    ]);
    expect([...grouped.keys()]).toEqual(["2026-10-26", "2026-10-27"]);
    expect(grouped.get("2026-10-26")?.map((a) => a.id)).toEqual(["a", "c"]);
  });

  it("sin citas devuelve un mapa vacío", () => {
    expect(groupByDate([]).size).toBe(0);
  });
});

describe("monthMatrix", () => {
  it("devuelve semanas completas de lunes a domingo", () => {
    const weeks = monthMatrix(new Date(2026, 9, 15)); // octubre de 2026
    expect(weeks.every((week) => week.length === 7)).toBe(true);
    expect(toISODate(weeks[0][0])).toBe("2026-09-28"); // octubre empieza en jueves
    expect(toISODate(weeks[weeks.length - 1][6])).toBe("2026-11-01");
  });

  it("incluye exactamente los días del mes consultado", () => {
    const days = monthMatrix(new Date(2026, 1, 10)).flat(); // febrero de 2026 (28 días)
    expect(days.filter((day) => day.getMonth() === 1)).toHaveLength(28);
  });

  it("un mes que empieza en lunes no añade una semana previa", () => {
    const weeks = monthMatrix(new Date(2026, 5, 1)); // junio de 2026 empieza en lunes
    expect(toISODate(weeks[0][0])).toBe("2026-06-01");
  });
});
