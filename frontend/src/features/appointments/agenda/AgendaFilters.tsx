import { X } from "lucide-react";

import { Button } from "@/components/ui/Button";
import { Field } from "@/components/ui/Field";
import { FILTERS_PANEL_ID } from "@/features/appointments/agenda/AgendaHeader";
import type { AgendaState } from "@/features/appointments/agenda/agendaUrl";
import { ALL_STATUSES, APPOINTMENT_STATUS_STYLE } from "@/features/appointments/status";
import type { AppointmentStatus } from "@/types/appointment";
import type { Employee, Service } from "@/types/service";

interface AgendaFiltersProps {
  state: AgendaState;
  employees: Employee[];
  services: Service[];
  onChange: (patch: Partial<AgendaState>) => void;
  onClear: () => void;
}

export function AgendaFilters({ state, employees, services, onChange, onClear }: AgendaFiltersProps) {
  function toggleStatus(status: AppointmentStatus) {
    const next = state.statuses.includes(status)
      ? state.statuses.filter((s) => s !== status)
      : [...state.statuses, status];
    onChange({ statuses: next });
  }

  return (
    <section
      id={FILTERS_PANEL_ID}
      aria-label="Filtros de la agenda"
      className="mb-4 grid gap-4 rounded-card border border-line bg-surface p-4 shadow-card md:grid-cols-2 xl:grid-cols-4"
    >
      <Field label="Profesional">
        {(control) => (
          <select {...control} value={state.employee} onChange={(event) => onChange({ employee: event.target.value })}>
            <option value="">Todos los profesionales</option>
            {employees.map((employee) => (
              <option key={employee.id} value={employee.id}>
                {employee.full_name}
              </option>
            ))}
          </select>
        )}
      </Field>

      <Field label="Servicio">
        {(control) => (
          <select {...control} value={state.service} onChange={(event) => onChange({ service: event.target.value })}>
            <option value="">Todos los servicios</option>
            {services.map((service) => (
              <option key={service.id} value={service.id}>
                {service.name}
              </option>
            ))}
          </select>
        )}
      </Field>

      <fieldset className="m-0 min-w-0 border-0 p-0 md:col-span-2">
        <legend className="mb-1.5 p-0 text-sm font-medium">Estado de la cita</legend>
        <div className="flex flex-wrap gap-2">
          {ALL_STATUSES.map((status) => {
            const checked = state.statuses.includes(status);
            const style = APPOINTMENT_STATUS_STYLE[status];
            return (
              <label
                key={status}
                className="inline-flex cursor-pointer items-center gap-2 rounded-full border border-line px-3 py-1.5 text-sm font-medium has-[:checked]:border-brand has-[:checked]:bg-brand-soft has-[:focus-visible]:outline-3 has-[:focus-visible]:outline-brand"
              >
                <input
                  type="checkbox"
                  className="size-4 min-h-0 accent-(--color-primary)"
                  checked={checked}
                  onChange={() => toggleStatus(status)}
                />
                <span className={`size-2 rounded-full ${style.dot}`} aria-hidden="true" />
                {style.label}
              </label>
            );
          })}
        </div>
      </fieldset>

      <div className="flex justify-end md:col-span-2 xl:col-span-4">
        <Button variant="ghost" size="sm" onClick={onClear}>
          <X className="size-4" aria-hidden="true" />
          Limpiar filtros
        </Button>
      </div>
    </section>
  );
}

interface ActiveFilterChipsProps {
  state: AgendaState;
  employees: Employee[];
  services: Service[];
  onChange: (patch: Partial<AgendaState>) => void;
}

/** Resumen discreto de los filtros activos, cada uno con su botón para quitarlo. */
export function ActiveFilterChips({ state, employees, services, onChange }: ActiveFilterChipsProps) {
  const chips: { key: string; label: string; remove: () => void }[] = [];

  if (state.employee) {
    const name = employees.find((e) => e.id === state.employee)?.full_name ?? "Profesional";
    chips.push({ key: "employee", label: `Profesional: ${name}`, remove: () => onChange({ employee: "" }) });
  }
  if (state.service) {
    const name = services.find((s) => s.id === state.service)?.name ?? "Servicio";
    chips.push({ key: "service", label: `Servicio: ${name}`, remove: () => onChange({ service: "" }) });
  }
  for (const status of state.statuses) {
    chips.push({
      key: status,
      label: `Estado: ${APPOINTMENT_STATUS_STYLE[status].label}`,
      remove: () => onChange({ statuses: state.statuses.filter((s) => s !== status) }),
    });
  }

  if (chips.length === 0) return null;
  return (
    <ul aria-label="Filtros activos" className="m-0 mb-4 flex list-none flex-wrap gap-2 p-0">
      {chips.map((chip) => (
        <li key={chip.key} className="inline-flex items-center gap-1 rounded-full bg-brand-soft py-1 pl-3 pr-1 text-sm font-medium text-ink">
          {chip.label}
          <button
            type="button"
            aria-label={`Quitar filtro ${chip.label}`}
            onClick={chip.remove}
            className="grid size-6 min-h-0 place-items-center rounded-full border-0 bg-transparent p-0 shadow-none hover:bg-line"
          >
            <X className="size-3.5" aria-hidden="true" />
          </button>
        </li>
      ))}
    </ul>
  );
}
