import { describe, expect, it } from "vitest";

import { periodRange, sumSeries, splitByRange } from "@/features/reports/period";

describe("periodRange", () => {
  it("hoy: un solo día y el día anterior como comparación", () => {
    expect(periodRange("today", "2026-10-24")).toEqual({
      from: "2026-10-24",
      to: "2026-10-24",
      previousFrom: "2026-10-23",
      previousTo: "2026-10-23",
    });
  });

  it("7 días: incluye hoy y compara con los 7 anteriores", () => {
    expect(periodRange("7d", "2026-10-24")).toEqual({
      from: "2026-10-18",
      to: "2026-10-24",
      previousFrom: "2026-10-11",
      previousTo: "2026-10-17",
    });
  });

  it("30 días cruza el cambio de mes sin errores", () => {
    const range = periodRange("30d", "2026-03-05");
    expect(range.from).toBe("2026-02-04");
    expect(range.previousTo).toBe("2026-02-03");
    expect(range.previousFrom).toBe("2026-01-05");
  });

  it("este mes: del día 1 a hoy, comparado con el mismo tramo del mes anterior", () => {
    expect(periodRange("month", "2026-10-24")).toEqual({
      from: "2026-10-01",
      to: "2026-10-24",
      previousFrom: "2026-09-01",
      previousTo: "2026-09-24",
    });
  });

  it("este mes: si el mes anterior es más corto, el tramo previo no se desborda", () => {
    const range = periodRange("month", "2026-03-31");
    expect(range.previousFrom).toBe("2026-02-01");
    expect(range.previousTo).toBe("2026-02-28");
  });
});

describe("sumSeries / splitByRange", () => {
  const points = [
    { period: "2026-10-10", value: 2 },
    { period: "2026-10-18", value: 3 },
    { period: "2026-10-24", value: 5 },
  ];

  it("suma los valores", () => {
    expect(sumSeries(points)).toBe(10);
    expect(sumSeries([])).toBe(0);
  });

  it("reparte una serie entre el período actual y el anterior", () => {
    const range = periodRange("7d", "2026-10-24");
    const { current, previous } = splitByRange(points, range);
    expect(current.map((p) => p.period)).toEqual(["2026-10-18", "2026-10-24"]);
    expect(previous.map((p) => p.period)).toEqual([]);
  });

  it("el límite del rango es inclusivo en ambos extremos", () => {
    const range = periodRange("7d", "2026-10-24");
    const { current, previous } = splitByRange(
      [
        { period: "2026-10-11", value: 1 },
        { period: "2026-10-17", value: 1 },
        { period: "2026-10-18", value: 1 },
      ],
      range
    );
    expect(previous).toHaveLength(2);
    expect(current).toHaveLength(1);
  });
});
