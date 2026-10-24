import { describe, expect, it } from "vitest";

import { formatCurrency, formatPercentChange } from "@/lib/format";

describe("formatCurrency", () => {
  it("formatea con la moneda del negocio", () => {
    expect(formatCurrency(1250.5, "USD")).toMatch(/1\.?250,50|1,250\.50/);
    expect(formatCurrency(1250.5, "USD")).toContain("$");
  });

  it("acepta importes que llegan como texto del backend", () => {
    expect(formatCurrency("150.00", "USD")).toMatch(/150/);
  });

  it("un importe inválido se muestra como cero, no como NaN", () => {
    expect(formatCurrency("abc", "USD")).not.toContain("NaN");
  });

  it("una moneda inválida no rompe la pantalla", () => {
    expect(() => formatCurrency(10, "???")).not.toThrow();
  });
});

describe("formatPercentChange", () => {
  it("calcula el aumento porcentual", () => {
    expect(formatPercentChange(150, 100)).toEqual({ percent: 50, direction: "up" });
  });

  it("calcula la disminución porcentual", () => {
    expect(formatPercentChange(75, 100)).toEqual({ percent: -25, direction: "down" });
  });

  it("sin variación es plano", () => {
    expect(formatPercentChange(10, 10)).toEqual({ percent: 0, direction: "flat" });
  });

  it("si el período anterior es cero no hay comparación válida", () => {
    expect(formatPercentChange(10, 0)).toBeNull();
    expect(formatPercentChange(0, 0)).toBeNull();
  });

  it("redondea al entero más cercano", () => {
    expect(formatPercentChange(103, 100)?.percent).toBe(3);
    expect(formatPercentChange(2, 3)?.percent).toBe(-33);
  });
});
