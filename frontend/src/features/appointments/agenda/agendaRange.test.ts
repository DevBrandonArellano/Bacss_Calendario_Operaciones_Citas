import { describe, expect, it } from "vitest";

import { computeRange, rangeLabel, stepDate } from "@/features/appointments/agenda/agendaRange";
import { toISODate } from "@/lib/dates";

const WEDNESDAY = new Date(2026, 9, 28); // 28 oct 2026 (miércoles)

describe("computeRange", () => {
  it("día: solo la fecha seleccionada", () => {
    const range = computeRange("day", WEDNESDAY);
    expect([toISODate(range.from), toISODate(range.to)]).toEqual(["2026-10-28", "2026-10-28"]);
  });

  it("semana: de lunes a domingo", () => {
    const range = computeRange("week", WEDNESDAY);
    expect([toISODate(range.from), toISODate(range.to)]).toEqual(["2026-10-26", "2026-11-01"]);
  });

  it("mes: del primero al último día, incluso en febrero bisiesto", () => {
    expect(
      [computeRange("month", WEDNESDAY)].map((r) => [toISODate(r.from), toISODate(r.to)])[0]
    ).toEqual(["2026-10-01", "2026-10-31"]);
    const leap = computeRange("month", new Date(2028, 1, 10));
    expect(toISODate(leap.to)).toBe("2028-02-29");
  });

  it("profesional usa la misma semana que la vista semanal", () => {
    expect(computeRange("professional", WEDNESDAY)).toEqual(computeRange("week", WEDNESDAY));
  });

  it("lista: 30 días desde la fecha", () => {
    const range = computeRange("list", WEDNESDAY);
    expect(toISODate(range.to)).toBe("2026-11-27");
  });
});

describe("stepDate", () => {
  it("día: ±1 día", () => {
    expect(toISODate(stepDate("day", WEDNESDAY, 1))).toBe("2026-10-29");
    expect(toISODate(stepDate("day", WEDNESDAY, -1))).toBe("2026-10-27");
  });

  it("semana: ±7 días", () => {
    expect(toISODate(stepDate("week", WEDNESDAY, 1))).toBe("2026-11-04");
  });

  it("mes: ±1 mes sin desbordar (31 de octubre → noviembre)", () => {
    const next = stepDate("month", new Date(2026, 9, 31), 1);
    expect([next.getFullYear(), next.getMonth()]).toEqual([2026, 10]);
    const previous = stepDate("month", new Date(2026, 2, 31), -1);
    expect([previous.getFullYear(), previous.getMonth()]).toEqual([2026, 1]);
  });
});

describe("rangeLabel", () => {
  it("día: fecha completa", () => {
    expect(rangeLabel("day", WEDNESDAY)).toMatch(/28/);
  });

  it("semana dentro del mismo mes: un solo mes", () => {
    const label = rangeLabel("week", new Date(2026, 9, 14));
    expect(label).toMatch(/12/);
    expect(label).toMatch(/18/);
  });

  it("mes: nombre del mes y año", () => {
    expect(rangeLabel("month", WEDNESDAY).toLowerCase()).toContain("octubre");
    expect(rangeLabel("month", WEDNESDAY)).toContain("2026");
  });
});
