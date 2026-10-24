import { describe, expect, it } from "vitest";

import {
  DEFAULT_VIEW,
  agendaLink,
  hasActiveFilters,
  parseAgendaParams,
  toSearchParams,
} from "@/features/appointments/agenda/agendaUrl";

const TODAY = "2026-10-24";

describe("parseAgendaParams", () => {
  it("sin parámetros usa vista por defecto, hoy y sin filtros", () => {
    expect(parseAgendaParams(new URLSearchParams(), TODAY)).toEqual({
      view: DEFAULT_VIEW,
      date: TODAY,
      employee: "",
      service: "",
      statuses: [],
      appointment: "",
    });
  });

  it("lee vista, fecha y filtros de la URL", () => {
    const params = new URLSearchParams("view=day&date=2026-11-02&employee=e1&service=s1&status=pending,confirmed&appointment=a9");
    expect(parseAgendaParams(params, TODAY)).toEqual({
      view: "day",
      date: "2026-11-02",
      employee: "e1",
      service: "s1",
      statuses: ["pending", "confirmed"],
      appointment: "a9",
    });
  });

  it("descarta valores inválidos en vez de romper la pantalla", () => {
    const params = new URLSearchParams("view=galaxia&date=ayer&status=pending,inventado");
    const parsed = parseAgendaParams(params, TODAY);
    expect(parsed.view).toBe(DEFAULT_VIEW);
    expect(parsed.date).toBe(TODAY);
    expect(parsed.statuses).toEqual(["pending"]);
  });

  it("usa la vista por defecto indicada (p. ej. día en móvil) cuando la URL no trae una", () => {
    expect(parseAgendaParams(new URLSearchParams(), TODAY, "day").view).toBe("day");
    expect(parseAgendaParams(new URLSearchParams("view=month"), TODAY, "day").view).toBe("month");
  });

  it("rechaza fechas imposibles como 2026-02-31", () => {
    expect(parseAgendaParams(new URLSearchParams("date=2026-02-31"), TODAY).date).toBe(TODAY);
  });
});

describe("toSearchParams", () => {
  it("omite lo vacío para conservar URLs limpias, pero siempre escribe la vista", () => {
    const search = toSearchParams({ view: "week", date: TODAY, employee: "", service: "", statuses: [], appointment: "" });
    expect(search.toString()).toBe(`view=week&date=${TODAY}`);
  });

  it("incluye vista no predeterminada, filtros y cita abierta", () => {
    const search = toSearchParams({
      view: "day",
      date: TODAY,
      employee: "e1",
      service: "",
      statuses: ["pending", "confirmed"],
      appointment: "a1",
    });
    expect(search.get("view")).toBe("day");
    expect(search.get("employee")).toBe("e1");
    expect(search.get("status")).toBe("pending,confirmed");
    expect(search.get("appointment")).toBe("a1");
  });

  it("ida y vuelta conserva el estado", () => {
    const state = { view: "month" as const, date: "2026-12-01", employee: "e2", service: "s3", statuses: ["cancelled" as const], appointment: "" };
    expect(parseAgendaParams(toSearchParams(state), TODAY)).toEqual(state);
  });
});

describe("agendaLink", () => {
  it("construye un enlace a /citas con los parámetros indicados", () => {
    expect(agendaLink({ view: "day", date: "2026-10-30", appointment: "a1" })).toBe(
      "/citas?view=day&date=2026-10-30&appointment=a1"
    );
  });

  it("sin parámetros enlaza a /citas", () => {
    expect(agendaLink({})).toBe("/citas");
  });
});

describe("hasActiveFilters", () => {
  it("detecta cualquier filtro activo, pero no la vista ni la fecha", () => {
    const base = { view: "week" as const, date: TODAY, employee: "", service: "", statuses: [], appointment: "" };
    expect(hasActiveFilters(base)).toBe(false);
    expect(hasActiveFilters({ ...base, employee: "e1" })).toBe(true);
    expect(hasActiveFilters({ ...base, statuses: ["pending"] })).toBe(true);
  });
});
