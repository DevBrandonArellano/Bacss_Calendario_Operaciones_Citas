import { describe, expect, it } from "vitest";

import { fillDays, niceScale } from "@/components/charts/chartScale";

describe("niceScale", () => {
  it("elige un máximo redondo y marcas equidistantes", () => {
    const scale = niceScale(7);
    expect(scale.max).toBeGreaterThanOrEqual(7);
    const steps = scale.ticks.slice(1).map((tick, i) => tick - scale.ticks[i]);
    expect(new Set(steps).size).toBe(1);
    expect(scale.ticks[0]).toBe(0);
    expect(scale.ticks[scale.ticks.length - 1]).toBe(scale.max);
  });

  it("sin datos devuelve una escala mínima usable", () => {
    expect(niceScale(0).max).toBeGreaterThan(0);
    expect(niceScale(-5).max).toBeGreaterThan(0);
  });

  it("escala bien cifras grandes y decimales pequeños", () => {
    expect(niceScale(1280).max).toBeGreaterThanOrEqual(1280);
    expect(niceScale(0.7).max).toBeGreaterThanOrEqual(0.7);
  });
});

describe("niceScale con enteros (conteos)", () => {
  it("nunca produce marcas decimales", () => {
    for (const max of [1, 2, 3, 5, 7, 12, 40]) {
      const { ticks } = niceScale(max, { integer: true });
      expect(ticks.every(Number.isInteger), `max ${max}: ${ticks}`).toBe(true);
      expect(ticks[ticks.length - 1]).toBeGreaterThanOrEqual(max);
    }
  });

  it("para un máximo de 2 usa 0, 1, 2", () => {
    expect(niceScale(2, { integer: true }).ticks).toEqual([0, 1, 2]);
  });
});

describe("fillDays", () => {
  it("rellena con cero los días sin registros, en orden", () => {
    const filled = fillDays([{ period: "2026-10-02", value: 4 }], "2026-10-01", "2026-10-04");
    expect(filled).toEqual([
      { period: "2026-10-01", value: 0 },
      { period: "2026-10-02", value: 4 },
      { period: "2026-10-03", value: 0 },
      { period: "2026-10-04", value: 0 },
    ]);
  });

  it("ignora puntos fuera del rango", () => {
    const filled = fillDays([{ period: "2026-09-30", value: 9 }], "2026-10-01", "2026-10-02");
    expect(filled.map((p) => p.value)).toEqual([0, 0]);
  });

  it("un rango de un solo día devuelve un punto", () => {
    expect(fillDays([], "2026-10-24", "2026-10-24")).toEqual([{ period: "2026-10-24", value: 0 }]);
  });
});
