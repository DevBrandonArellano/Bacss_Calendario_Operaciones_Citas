import { describe, expect, it } from "vitest";

import { employeesForService, matchSlot, servicesForBranch, validateBooking } from "@/features/appointments/bookingRules";
import type { AvailabilitySlot } from "@/types/appointment";
import type { Employee, Service } from "@/types/service";

const service = (id: string, branches: string[] = []): Service => ({
  id,
  name: id,
  category: "",
  duration_minutes: 30,
  price: "10.00",
  status: "active",
  branches,
});

const employee = (id: string, services: string[], branch: string | null = "b1", is_active = true): Employee => ({
  id,
  user: null,
  branch,
  first_name: id,
  last_name: "",
  full_name: id,
  specialty: "",
  is_active,
  services,
});

describe("servicesForBranch", () => {
  it("un servicio sin sucursales asignadas está disponible en todas", () => {
    expect(servicesForBranch([service("s1")], "b1")).toHaveLength(1);
  });

  it("filtra los servicios que no se ofrecen en la sucursal", () => {
    const result = servicesForBranch([service("s1", ["b1"]), service("s2", ["b2"])], "b1");
    expect(result.map((s) => s.id)).toEqual(["s1"]);
  });

  it("sin sucursal elegida no filtra", () => {
    expect(servicesForBranch([service("s1", ["b2"])], "")).toHaveLength(1);
  });

  it("excluye servicios inactivos", () => {
    expect(servicesForBranch([{ ...service("s1"), status: "inactive" }], "b1")).toEqual([]);
  });
});

describe("employeesForService", () => {
  const employees = [
    employee("e1", ["s1"]),
    employee("e2", ["s2"]),
    employee("e3", ["s1"], "b2"),
    employee("e4", ["s1"], null),
    employee("e5", ["s1"], "b1", false),
  ];

  it("solo profesionales activos que ofrecen el servicio", () => {
    expect(employeesForService(employees, "s1", "").map((e) => e.id)).toEqual(["e1", "e3", "e4"]);
  });

  it("con sucursal, descarta a quienes trabajan en otra (sin sucursal asignada sí participan)", () => {
    expect(employeesForService(employees, "s1", "b1").map((e) => e.id)).toEqual(["e1", "e4"]);
  });

  it("sin servicio elegido no hay profesionales que ofrecer", () => {
    expect(employeesForService(employees, "", "b1")).toEqual([]);
  });
});

describe("validateBooking", () => {
  it("un borrador completo no tiene errores", () => {
    expect(validateBooking({ customerId: "c", branchId: "b", serviceId: "s", hasSlot: true })).toEqual({});
  });

  it("indica cada campo obligatorio que falta, con mensaje claro", () => {
    const errors = validateBooking({ customerId: "", branchId: "", serviceId: "", hasSlot: false });
    expect(Object.keys(errors).sort()).toEqual(["branch", "customer", "service", "slot"]);
    expect(errors.customer).toMatch(/cliente/i);
    expect(errors.slot).toMatch(/horario/i);
  });
});

describe("matchSlot", () => {
  const slots: AvailabilitySlot[] = [
    { employee_id: "e1", start_time: "10:00:00", end_time: "10:30:00" },
    { employee_id: "e2", start_time: "10:00:00", end_time: "10:30:00" },
    { employee_id: "e1", start_time: "10:15:00", end_time: "10:45:00" },
  ];

  it("encuentra el horario por hora y profesional", () => {
    expect(matchSlot(slots, "10:00", "e2")?.employee_id).toBe("e2");
  });

  it("sin profesional indicado devuelve el primer horario de esa hora", () => {
    expect(matchSlot(slots, "10:00", "")?.employee_id).toBe("e1");
  });

  it("devuelve undefined si la hora ya no está libre", () => {
    expect(matchSlot(slots, "11:00", "e1")).toBeUndefined();
  });
});
