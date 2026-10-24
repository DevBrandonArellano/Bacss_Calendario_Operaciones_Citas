import type { AvailabilitySlot } from "@/types/appointment";
import type { Employee, Service } from "@/types/service";

/** Servicios activos que se ofrecen en la sucursal (sin sucursales asignadas = disponible en todas). */
export function servicesForBranch(services: Service[], branchId: string): Service[] {
  return services.filter(
    (service) => service.status === "active" && (!branchId || service.branches.length === 0 || service.branches.includes(branchId))
  );
}

/** Profesionales activos que ofrecen el servicio y trabajan en la sucursal (o no tienen una asignada). */
export function employeesForService(employees: Employee[], serviceId: string, branchId: string): Employee[] {
  if (!serviceId) return [];
  return employees.filter(
    (employee) =>
      employee.is_active &&
      employee.services.includes(serviceId) &&
      (!branchId || employee.branch === null || employee.branch === branchId)
  );
}

export interface BookingDraft {
  customerId: string;
  branchId: string;
  serviceId: string;
  hasSlot: boolean;
}

export type BookingField = "customer" | "branch" | "service" | "slot";

/** Validación de campos obligatorios en el cliente. El servidor valida siempre de nuevo (disponibilidad, permisos). */
export function validateBooking(draft: BookingDraft): Partial<Record<BookingField, string>> {
  const errors: Partial<Record<BookingField, string>> = {};
  if (!draft.customerId) errors.customer = "Selecciona un cliente de la lista.";
  if (!draft.branchId) errors.branch = "Selecciona una sucursal.";
  if (!draft.serviceId) errors.service = "Selecciona un servicio.";
  if (!draft.hasSlot) errors.slot = "Elige un horario disponible.";
  return errors;
}

/** Busca el horario libre de una hora concreta (y profesional, si se indica); `time` es «HH:MM». */
export function matchSlot(slots: AvailabilitySlot[], time: string, employeeId: string): AvailabilitySlot | undefined {
  return slots.find(
    (slot) => slot.start_time.slice(0, 5) === time && (!employeeId || slot.employee_id === employeeId)
  );
}
