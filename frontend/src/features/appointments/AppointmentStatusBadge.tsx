import { APPOINTMENT_STATUS_STYLE } from "@/features/appointments/status";
import { cn } from "@/lib/cn";
import type { AppointmentStatus } from "@/types/appointment";

interface AppointmentStatusBadgeProps {
  status: AppointmentStatus;
  /** Texto adicional junto a la etiqueta, p. ej. un contador («: 3»). */
  suffix?: string;
  className?: string;
}

export function AppointmentStatusBadge({ status, suffix, className }: AppointmentStatusBadgeProps) {
  const style = APPOINTMENT_STATUS_STYLE[status];
  const Icon = style.icon;
  return (
    <span
      className={cn("inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold", style.chip, className)}
    >
      <Icon className="size-3.5 shrink-0" aria-hidden="true" />
      {style.label}
      {suffix}
    </span>
  );
}
