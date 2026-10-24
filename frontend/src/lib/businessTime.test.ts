import { describe, expect, it } from "vitest";

import { nowInTimeZone } from "@/lib/businessTime";

describe("nowInTimeZone", () => {
  const instant = new Date("2026-10-24T03:30:00Z"); // 22:30 del día anterior en Guayaquil (UTC-5)

  it("usa la fecha y hora locales del negocio, no las del navegador ni UTC", () => {
    expect(nowInTimeZone("America/Guayaquil", instant)).toEqual({ date: "2026-10-23", minutes: 22 * 60 + 30 });
  });

  it("el mismo instante en otra zona da otra fecha", () => {
    expect(nowInTimeZone("Asia/Tokyo", instant)).toEqual({ date: "2026-10-24", minutes: 12 * 60 + 30 });
  });

  it("medianoche se representa como hora 0 (no 24)", () => {
    expect(nowInTimeZone("UTC", new Date("2026-01-01T00:05:00Z")).minutes).toBe(5);
  });

  it("una zona inválida cae en la zona por defecto sin lanzar", () => {
    expect(() => nowInTimeZone("No/Existe", instant)).not.toThrow();
  });
});
