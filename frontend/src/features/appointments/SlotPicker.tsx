import { buildSlotGroups } from "@/features/appointments/slots";
import { cn } from "@/lib/cn";
import type { AvailabilitySlot } from "@/types/appointment";

interface SlotPickerProps {
  slots: AvailabilitySlot[];
  selected: AvailabilitySlot | null;
  employeeNames: Record<string, string>;
  /** Mostrar el nombre del profesional sobre cada grupo (cuando hay más de uno). */
  showEmployeeNames: boolean;
  onSelect: (slot: AvailabilitySlot) => void;
}

/** Horarios en bloques de 15 min. Los libres son botones; los ocupados se ven deshabilitados y rotulados. */
export function SlotPicker({ slots, selected, employeeNames, showEmployeeNames, onSelect }: SlotPickerProps) {
  const groups = buildSlotGroups(slots);

  return (
    <div className="flex flex-col gap-4">
      {groups.map((group) => (
        <div key={group.employeeId} role="group" aria-label={`Horarios de ${employeeNames[group.employeeId] ?? "profesional"}`}>
          {showEmployeeNames && (
            <p className="m-0 mb-2 text-sm font-semibold text-ink">{employeeNames[group.employeeId] ?? "Profesional"}</p>
          )}
          <div className="grid grid-cols-[repeat(auto-fill,minmax(5rem,1fr))] gap-2">
            {group.options.map((option) => {
              const isSelected =
                option.slot !== undefined &&
                selected?.employee_id === option.slot.employee_id &&
                selected.start_time === option.slot.start_time;
              return (
                <button
                  key={option.startTime}
                  type="button"
                  disabled={!option.available}
                  aria-pressed={option.available ? isSelected : undefined}
                  aria-label={option.available ? `${option.startTime}` : `${option.startTime}, ocupado`}
                  onClick={() => option.slot && onSelect(option.slot)}
                  className={cn(
                    "min-h-10 rounded-lg px-2 text-sm font-semibold tabular-nums shadow-none",
                    !option.available && "border-dashed bg-subtle text-muted line-through opacity-70",
                    isSelected && "border-brand bg-brand text-on-brand hover:bg-brand-hover"
                  )}
                >
                  {option.startTime}
                </button>
              );
            })}
          </div>
        </div>
      ))}
      <p className="m-0 text-xs text-muted">Los horarios tachados están ocupados o fuera del horario laboral.</p>
    </div>
  );
}
