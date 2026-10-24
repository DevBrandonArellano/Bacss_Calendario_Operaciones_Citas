import { describe, expect, it } from "vitest";

import { ACTION_LABELS, availableActions, canEditNotes } from "@/features/appointments/agenda/appointmentActions";
import { ALL_STATUSES } from "@/features/appointments/status";

describe("availableActions (espejo de VALID_TRANSITIONS del backend)", () => {
  it.each([
    ["pending", ["confirm", "no_show", "cancel"]],
    ["confirmed", ["start", "reschedule", "no_show", "cancel"]],
    ["waiting", ["start", "cancel"]],
    ["in_progress", ["complete"]],
    ["completed", []],
    ["cancelled", []],
    ["no_show", []],
    ["rescheduled", []],
  ] as const)("estado %s", (status, expected) => {
    expect(availableActions(status)).toEqual(expected);
  });

  it("solo una cita confirmada se puede reprogramar (una pendiente no: el backend responde 409)", () => {
    expect(availableActions("pending")).not.toContain("reschedule");
    expect(availableActions("confirmed")).toContain("reschedule");
  });

  it("cada acción tiene una etiqueta legible", () => {
    for (const status of ALL_STATUSES) {
      for (const action of availableActions(status)) {
        expect(ACTION_LABELS[action].length).toBeGreaterThan(0);
      }
    }
  });
});

describe("canEditNotes", () => {
  it("solo las citas abiertas admiten editar notas", () => {
    expect(canEditNotes("pending")).toBe(true);
    expect(canEditNotes("in_progress")).toBe(true);
    expect(canEditNotes("completed")).toBe(false);
    expect(canEditNotes("cancelled")).toBe(false);
  });
});
